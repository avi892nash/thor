import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import http from 'http';
import os from 'os';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { WizLightManager } from './lib/wizLightManager.js';
import { RoomsData, NetworkInterface } from './shared/types.js';
import { logger } from './lib/logger.js';
import {
  initAuth,
  isBootstrapped,
  createUser,
  verifyPassword,
  signToken,
} from './lib/auth.js';
import { requireAuth } from './lib/authMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


interface LightDevice {
  ip: string;
  port: number;
  response: Record<string, unknown>;
  mac?: string | undefined;
  state?: boolean | undefined;
  rssi?: number | undefined;
  method: string;
}




interface DiscoveryRequest {
  subnet?: string;
  timeout?: number;
}





const app = express();
const server = http.createServer(app);

const ALLOWED_ORIGINS = (process.env['ALLOWED_ORIGINS'] || 'http://localhost:3000').split(',');

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json());

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : 'info';
    logger[level](`${req.method} ${req.path} → ${res.statusCode} (${ms}ms)`);
  });
  next();
});

// Global state - JSON is the source of truth
let roomsData: RoomsData = { rooms: [] };
let wizLightManager = new WizLightManager();

// Resolve data directory — use DATA_DIR env var (set by .deb install) or fallback to local
const dataDir = process.env['DATA_DIR'] || join(__dirname, '../data');

// Load rooms data from JSON file
const loadRoomsData = async (): Promise<void> => {
  try {
    const roomsPath = join(dataDir, 'rooms.json');
    const data = await fs.readFile(roomsPath, 'utf8');
    roomsData = JSON.parse(data);
  } catch (error) {
    logger.warn('Could not load rooms data, using empty rooms', error);
    roomsData = { rooms: [] };
  }
};

// Helper function to get all lights from JSON data
const getAllLights = (): LightDevice[] => {
  return roomsData.rooms.flatMap(room => {
    const roomDevices = room.devices
      .filter(device => device.type === 'wiz_light')
      .map(device => ({
        ip: device.ip,
        port: device.port,
        response: device.properties || {},
        mac: device.mac,
        state: device.state,
        rssi: undefined,
        method: 'json'
      }));
    return roomDevices;
  });
};

// Network utility functions
const getNetworkInterfaces = (): NetworkInterface[] => {
  const interfaces = os.networkInterfaces();
  const validInterfaces: NetworkInterface[] = [];
  
  for (const [name, addresses] of Object.entries(interfaces)) {
    if (!addresses) continue;
    
    for (const addr of addresses) {
      if (!addr.internal && addr.family === 'IPv4' && addr.address !== '127.0.0.1') {
        const network = calculateNetworkInfo(addr.address, addr.netmask);
        validInterfaces.push({ name, address: addr.address, netmask: addr.netmask, ...network });
      }
    }
  }
  
  return validInterfaces;
};

const calculateNetworkInfo = (ip: string, netmask: string): { network: string; broadcast: string; cidr: number } => {
  const ipParts = ip.split('.').map(Number);
  const maskParts = netmask.split('.').map(Number);
  
  const networkParts = ipParts.map((part, i) => part & maskParts[i]!);
  const broadcastParts = ipParts.map((part, i) => part | (255 - maskParts[i]!));
  const cidr = maskParts.reduce((acc, part) => acc + part.toString(2).split('1').length - 1, 0);
  
  return {
    network: networkParts.join('.'),
    broadcast: broadcastParts.join('.'),
    cidr
  };
};

const getPrimaryBroadcastAddress = (): string => {
  const interfaces = getNetworkInterfaces();
  const priorities = ['192.168.', '10.', '172.'];
  
  for (const priority of priorities) {
    const found = interfaces.find(iface => iface.address.startsWith(priority));
    if (found) return found.broadcast;
  }
  
  return interfaces.length > 0 ? interfaces[0]!.broadcast : '192.168.1.255';
};



// API Routes

// Health check (no authentication required)
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env['npm_package_version'] || '1.0.0',
  });
});

// Frontend URL — returns the versioned frontend URL for the loader (no auth required)
app.get('/frontend', (_req: Request, res: Response) => {
  const baseUrl = process.env['FRONTEND_BASE_URL'] || 'https://devshram.com/projects/thor';
  const version = process.env['npm_package_version'] || '1.0.0';
  res.json({ url: `${baseUrl}/v${version}/`, version });
});

// ── Auth routes ────────────────────────────────────────────────────────────

app.get('/auth/status', (_req: Request, res: Response) => {
  res.json({ bootstrapped: isBootstrapped() });
});

app.post('/auth/register', async (req: Request, res: Response, next: NextFunction) => {
  // Open while no users exist (bootstrap); otherwise require a valid token
  if (isBootstrapped()) {
    return requireAuth(req, res, () => handleRegister(req, res));
  }
  return handleRegister(req, res, next);
});

const handleRegister = async (req: Request, res: Response, _next?: NextFunction): Promise<void> => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) {
      res.status(400).json({ success: false, error: 'username and password are required' });
      return;
    }
    const user = await createUser(username, password);
    const token = signToken(user);
    logger.info(`Registered user '${user.username}'`);
    res.json({ success: true, token, user });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'register failed';
    res.status(400).json({ success: false, error: message });
  }
};

app.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) {
      res.status(400).json({ success: false, error: 'username and password are required' });
      return;
    }
    const user = await verifyPassword(username, password);
    if (!user) {
      res.status(401).json({ success: false, error: 'invalid credentials' });
      return;
    }
    const token = signToken(user);
    res.json({ success: true, token, user });
  } catch (err: unknown) {
    logger.error('Login error', err);
    res.status(500).json({ success: false, error: 'internal error' });
  }
});

app.get('/auth/me', requireAuth, (req: Request, res: Response) => {
  res.json({ success: true, user: req.user });
});

// All /api routes require a valid JWT
app.use('/api', requireAuth);

// Get network information
app.get('/api/network', (_req: Request, res: Response) => {
  try {
    const interfaces = getNetworkInterfaces();
    const primaryBroadcast = getPrimaryBroadcastAddress();
    
    res.json({
      success: true,
      interfaces,
      primaryBroadcast,
      recommendedSubnet: primaryBroadcast
    });
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});


// Discover lights
app.post('/api/discover', async (req: Request<object, object, DiscoveryRequest>, res: Response) => {
  try {
    // Use dynamic broadcast address if no subnet provided
    const defaultSubnet = getPrimaryBroadcastAddress();
    const { subnet = defaultSubnet, timeout = 3000 } = req.body;
    logger.info(`Discovering lights on subnet ${subnet}...`);
    
    const devices = await wizLightManager.discoverDevices(timeout, subnet);
    
    logger.info(`Found ${devices.length} lights`);
    
    
    res.json({
      success: true,
      lights: devices,
      count: devices.length,
      subnet: subnet
    });
  } catch (error: unknown) {
    logger.error('Discovery error', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});




// Batch operations helper
const controlAllLights = async (_req: Request, res: Response, action: string, state: boolean): Promise<void> => {
  try {
    const allLights = getAllLights();
    if (allLights.length === 0) {
      res.status(400).json({
        success: false,
        error: 'No lights found in JSON data.'
      });
      return;
    }
    
    // Add lights to manager if they're not already there
    for (const light of allLights) {
      if (!wizLightManager.getLight(light.ip)) {
        await wizLightManager.addLight(light.ip, light.port);
      }
    }
    
    logger.info(`${action} all lights`, { ips: allLights.map(l => l.ip) });
    
    // Use batch operations from WizLightManager
    const results = state ? 
      await wizLightManager.turnOnAll() : 
      await wizLightManager.turnOffAll();
    
    const successCount = results.filter(r => r.success).length;
    const failedResults = results.filter(r => !r.success);
    
    if (failedResults.length > 0) {
      logger.warn('Some lights failed', failedResults);
    }
    
    res.json({
      success: successCount > 0,
      results: results.map((result) => ({
        ip: result.ip,
        success: result.success,
        error: result.error || null
      })),
      message: `${successCount}/${results.length} lights ${action === 'turnOn' ? 'turned on' : 'turned off'} successfully`
    });
  } catch (error: unknown) {
    logger.error(`All lights ${action} error`, error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

// Light control helper
const controlLight = async (req: Request, res: Response, action: string, stateValue: boolean): Promise<void> => {
  try {
    const { ip } = req.params;
    if (!ip) {
      res.status(400).json({ success: false, error: 'IP parameter is required' });
      return;
    }
    
    // Check if light exists in JSON data
    const allLights = getAllLights();
    const lightData = allLights.find(l => l.ip === ip);
    if (!lightData) {
      res.status(404).json({ success: false, error: 'Light not found in JSON data' });
      return;
    }
    
    logger.info(`${action} light ${ip}`);
    
    // Get or add light to manager
    let light = wizLightManager.getLight(ip);
    if (!light) {
      light = await wizLightManager.addLight(ip, lightData.port);
    }
    
    // Use individual light methods
    try {
      const success = stateValue ? await light.turnOn() : await light.turnOff();
      
      if (success) {
        // Update the light's state in JSON data
        lightData.state = stateValue;
        res.json({ success: true, ip, state: stateValue });
      } else {
        res.json({ 
          success: false, 
          ip, 
          error: 'Light did not respond or command failed'
        });
      }
    } catch (commandError) {
      logger.error(`Command failed for light ${ip}`, commandError);
      res.json({
        success: false,
        ip,
        error: commandError instanceof Error ? commandError.message : 'Command failed'
      });
    }
  } catch (error: unknown) {
    logger.error(`Error controlling light ${req.params['ip']}`, error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

// Light control endpoints (individual lights) - MUST come before /all routes
app.post('/api/lights/:ip/on', (req: Request, res: Response) => controlLight(req, res, 'turnOn', true));
app.post('/api/lights/:ip/off', (req: Request, res: Response) => controlLight(req, res, 'turnOff', false));

// Batch operations (defined AFTER individual routes to avoid route conflicts)
app.post('/api/lights/all/on', (req: Request, res: Response) => controlAllLights(req, res, 'turnOn', true));
app.post('/api/lights/all/off', (req: Request, res: Response) => controlAllLights(req, res, 'turnOff', false));

// Unified light properties update endpoint
app.post('/api/lights/:ip/update', async (req: Request, res: Response) => {
  try {
    const { ip } = req.params;
    if (!ip) {
      res.status(400).json({ success: false, error: 'IP parameter is required' });
      return;
    }
    
    // Check if light exists in JSON data
    const allLights = getAllLights();
    const lightData = allLights.find(l => l.ip === ip);
    if (!lightData) {
      res.status(404).json({ success: false, error: 'Light not found in JSON data' });
      return;
    }
    
    logger.info(`Updating light ${ip}`, req.body);
    
    // Get or add light to manager
    let light = wizLightManager.getLight(ip);
    if (!light) {
      light = await wizLightManager.addLight(ip, lightData.port);
    }
    
    // Use individual light methods to update properties
    try {
      const success = await light.updateProperties(req.body);
      
      if (success) {
        // Update the light's state if the command was successful
        lightData.state = true;
        if (req.body.brightness !== undefined && lightData.response) {
          lightData.response = { ...lightData.response, dimming: req.body.brightness };
        }
        
        res.json({ 
          success: true, 
          ip, 
          state: lightData.state,
          properties: req.body
        });
      } else {
        res.json({ 
          success: false, 
          ip, 
          error: 'Light did not respond or command failed',
          properties: req.body
        });
      }
    } catch (commandError) {
      logger.error(`Command failed for light ${ip}`, commandError);
      res.json({
        success: false,
        ip,
        error: commandError instanceof Error ? commandError.message : 'Command failed',
        properties: req.body
      });
    }
  } catch (error: unknown) {
    logger.error(`Error updating light ${req.params['ip']}`, error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});


// Get light status endpoint - polls actual device state
app.get('/api/lights/:ip/status', async (req: Request, res: Response) => {
  try {
    const { ip } = req.params;
    if (!ip) {
      res.status(400).json({ success: false, error: 'IP parameter is required' });
      return;
    }

    // Check if light exists in JSON data
    const allLights = getAllLights();
    const lightData = allLights.find(l => l.ip === ip);
    if (!lightData) {
      res.status(404).json({ success: false, error: 'Light not found in JSON data' });
      return;
    }

    // Use testSingleIP to get actual device status
    const result = await WizLightManager.testSingleIP(ip, 2000);

    if (result.success && result.response) {
      res.json({
        success: true,
        ip,
        mac: result.response['mac'] as string | undefined,
        state: result.response['state'] as boolean | undefined,
        brightness: result.response['dimming'] as number | undefined,
        temperature: result.response['temp'] as number | undefined,
        sceneId: result.response['sceneId'] as number | undefined,
        r: result.response['r'] as number | undefined,
        g: result.response['g'] as number | undefined,
        b: result.response['b'] as number | undefined,
        rssi: result.response['rssi'] as number | undefined,
      });
    } else {
      res.json({
        success: false,
        ip,
        error: result.error || 'Device not responding',
        offline: true
      });
    }
  } catch (error: unknown) {
    logger.error(`Error getting status for light ${req.params['ip']}`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Batch status check for multiple lights
app.post('/api/lights/status', async (req: Request, res: Response) => {
  try {
    const { ips } = req.body as { ips: string[] };
    if (!ips || !Array.isArray(ips)) {
      res.status(400).json({ success: false, error: 'IPs array is required' });
      return;
    }

    const results = await Promise.all(
      ips.map(async (ip) => {
        const result = await WizLightManager.testSingleIP(ip, 2000);
        if (result.success && result.response) {
          return {
            ip,
            success: true,
            mac: result.response['mac'] as string | undefined,
            state: result.response['state'] as boolean | undefined,
            brightness: result.response['dimming'] as number | undefined,
            temperature: result.response['temp'] as number | undefined,
            sceneId: result.response['sceneId'] as number | undefined,
            r: result.response['r'] as number | undefined,
            g: result.response['g'] as number | undefined,
            b: result.response['b'] as number | undefined,
          };
        }
        return { ip, success: false, offline: true };
      })
    );

    res.json({ success: true, results });
  } catch (error: unknown) {
    logger.error('Error getting batch status', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Room management API
app.post('/api/rooms', async (req: Request, res: Response) => {
  try {
    const roomsPath = join(dataDir, 'rooms.json');
    await fs.writeFile(roomsPath, JSON.stringify(req.body, null, 2));

    // Update global roomsData variable
    roomsData = req.body;

    res.json({ success: true, message: 'Rooms saved successfully' });
  } catch (error: unknown) {
    logger.error('Error writing rooms file', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/rooms', (_req: Request, res: Response) => {
  res.json(roomsData);
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});


// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

const PORT = process.env['PORT'] || 3001;

server.listen(PORT, async () => {
  logger.info(`Thor server started on port ${PORT} — logging to ${logger.logFile}`);
  await loadRoomsData();
  logger.info(`Loaded ${roomsData.rooms.length} rooms from JSON`);
  await initAuth(dataDir);
});