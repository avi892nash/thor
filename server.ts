import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { WizLightManager } from './lib/wizLightManager.js';
import { RoomsData, NetworkInterface } from './shared/types.js';

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

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from React build
app.use(express.static(path.join(__dirname, '../client/build')));


// Global state - JSON is the source of truth
let roomsData: RoomsData = { rooms: [] };
let wizLightManager = new WizLightManager();

// Load rooms data from JSON file
const loadRoomsData = async (): Promise<void> => {
  try {
    const roomsPath = path.join(process.cwd(), 'client', 'src', 'data', 'rooms.json');
    const data = await fs.readFile(roomsPath, 'utf8');
    roomsData = JSON.parse(data);
  } catch (error) {
    console.warn('Could not load rooms data, using empty rooms:', error);
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

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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
    console.log(`Discovering lights on subnet ${subnet}...`);
    
    const devices = await wizLightManager.discoverDevices(timeout, subnet);
    
    console.log(`Found ${devices.length} lights`);
    
    
    res.json({
      success: true,
      lights: devices,
      count: devices.length,
      subnet: subnet
    });
  } catch (error: unknown) {
    console.error('Discovery error:', error);
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
    
    console.log(`${action} request for lights:`, allLights.map(l => l.ip));
    
    // Use batch operations from WizLightManager
    const results = state ? 
      await wizLightManager.turnOnAll() : 
      await wizLightManager.turnOffAll();
    
    const successCount = results.filter(r => r.success).length;
    const failedResults = results.filter(r => !r.success);
    
    if (failedResults.length > 0) {
      console.log('Some lights failed:', failedResults);
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
    console.error(`All lights ${action} error:`, error);
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
    
    console.log(`${action} request for light ${ip}`);
    
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
      console.error(`Command failed for light ${ip}:`, commandError);
      res.json({ 
        success: false, 
        ip, 
        error: commandError instanceof Error ? commandError.message : 'Command failed'
      });
    }
  } catch (error: unknown) {
    console.error(`Error controlling light ${req.params['ip']}:`, error);
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
    
    console.log(`Updating light ${ip} with properties:`, req.body);
    
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
      console.error(`Command failed for light ${ip}:`, commandError);
      res.json({ 
        success: false, 
        ip, 
        error: commandError instanceof Error ? commandError.message : 'Command failed',
        properties: req.body
      });
    }
  } catch (error: unknown) {
    console.error(`Error updating light ${req.params['ip']}:`, error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});


// Room management API
app.post('/api/rooms', async (req: Request, res: Response) => {
  try {
    const roomsPath = path.join(process.cwd(), 'client', 'src', 'data', 'rooms.json');
    await fs.writeFile(roomsPath, JSON.stringify(req.body, null, 2));
    
    // Update global roomsData variable
    roomsData = req.body;
    
    res.json({ success: true, message: 'Rooms saved successfully' });
  } catch (error: unknown) {
    console.error('Error writing rooms file:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

app.get('/api/rooms', (_req: Request, res: Response) => {
  res.json(roomsData);
});

// Catch-all handler: send back React's index.html file for non-API routes
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});


// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  
  // Close HTTP server
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

const PORT = process.env['PORT'] || 3001;

server.listen(PORT, async () => {
  console.log(`🚀 WiZ Lights Server running on port ${PORT}`);
  console.log('🔍 Use POST /api/discover to find lights on your network');
  console.log('💡 Use /api/lights/* endpoints for light management');
  
  // Load rooms data on startup
  await loadRoomsData();
  console.log(`📋 Loaded ${roomsData.rooms.length} rooms from JSON`);
});