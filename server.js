import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import os from 'os';
import { WizLight, WizDiscovery } from './lib/wizLight.js';
import { RhythmController } from './lib/rhythmController.js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(cors());
app.use(express.json());

// Serve React app
app.use(express.static(path.join(process.cwd(), 'client/build')));

// Global state
let discoveredLights = [];
let connectedLights = new Map(); // IP -> WizLight instance
let rhythmController = new RhythmController();

// Network utility functions
function getNetworkInterfaces() {
  const interfaces = os.networkInterfaces();
  const validInterfaces = [];
  
  for (const [name, addresses] of Object.entries(interfaces)) {
    if (addresses) {
      for (const addr of addresses) {
        // Skip loopback, internal, and IPv6 addresses
        if (!addr.internal && addr.family === 'IPv4' && addr.address !== '127.0.0.1') {
          const network = calculateNetworkInfo(addr.address, addr.netmask);
          validInterfaces.push({
            name,
            address: addr.address,
            netmask: addr.netmask,
            broadcast: network.broadcast,
            network: network.network,
            cidr: network.cidr
          });
        }
      }
    }
  }
  
  return validInterfaces;
}

function calculateNetworkInfo(ip, netmask) {
  const ipParts = ip.split('.').map(Number);
  const maskParts = netmask.split('.').map(Number);
  
  // Calculate network address
  const networkParts = ipParts.map((part, i) => part & maskParts[i]);
  
  // Calculate broadcast address
  const broadcastParts = ipParts.map((part, i) => part | (255 - maskParts[i]));
  
  // Calculate CIDR notation
  const cidr = maskParts.reduce((acc, part) => {
    return acc + part.toString(2).split('1').length - 1;
  }, 0);
  
  return {
    network: networkParts.join('.'),
    broadcast: broadcastParts.join('.'),
    cidr
  };
}

function getPrimaryBroadcastAddress() {
  const interfaces = getNetworkInterfaces();
  
  // Prefer common network ranges
  const priorities = ['192.168.', '10.', '172.'];
  
  for (const priority of priorities) {
    const found = interfaces.find(iface => iface.address.startsWith(priority));
    if (found) return found.broadcast;
  }
  
  // Return first available if no priority match
  return interfaces.length > 0 ? interfaces[0].broadcast : '192.168.1.255';
}

// WebSocket connections for real-time updates
const wsConnections = new Set();

wss.on('connection', (ws) => {
  wsConnections.add(ws);
  console.log('WebSocket client connected');
  
  // Send complete current state to new client for sync
  const connectedLightsArray = Array.from(connectedLights.keys());
  const lightStates = Object.fromEntries(
    Array.from(connectedLights.entries()).map(([ip, light]) => [ip, light.state.state || false])
  );
  
  // Send discovery data
  ws.send(JSON.stringify({
    type: 'discovery',
    data: { lights: discoveredLights }
  }));
  
  // Send connected lights
  connectedLightsArray.forEach(ip => {
    ws.send(JSON.stringify({
      type: 'lightConnected',
      data: { ip }
    }));
  });
  
  // Send current light states
  Object.entries(lightStates).forEach(([ip, state]) => {
    ws.send(JSON.stringify({
      type: 'lightStateChanged',
      data: { ip, state }
    }));
  });
  
  // Send rhythm status
  ws.send(JSON.stringify({
    type: 'rhythmStatus',
    data: { status: rhythmController.getStatus() }
  }));
  
  console.log(`Synced state to new client: ${discoveredLights.length} discovered, ${connectedLightsArray.length} connected lights`);
  
  ws.on('close', () => {
    wsConnections.delete(ws);
    console.log('WebSocket client disconnected');
  });
});

// Broadcast to all WebSocket clients
function broadcast(message) {
  wsConnections.forEach(ws => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
    }
  });
}

// API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get network information
app.get('/api/network', (req, res) => {
  try {
    const interfaces = getNetworkInterfaces();
    const primaryBroadcast = getPrimaryBroadcastAddress();
    
    res.json({
      success: true,
      interfaces,
      primaryBroadcast,
      recommendedSubnet: primaryBroadcast
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test UDP communication with specific IP
app.post('/api/test/:ip', async (req, res) => {
  try {
    const { ip } = req.params;
    const testLight = new WizLight(ip);
    
    console.log(`Testing UDP communication with ${ip}:38899`);
    
    // Try to get pilot (light state)
    const result = await testLight.sendCommand('getPilot');
    
    res.json({
      success: true,
      message: `Successfully communicated with ${ip}`,
      ip,
      method: 'getPilot'
    });
  } catch (error) {
    console.error(`Test failed for ${ip}:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      ip: req.params.ip
    });
  }
});

// Discover lights
app.post('/api/discover', async (req, res) => {
  try {
    // Use dynamic broadcast address if no subnet provided
    const defaultSubnet = getPrimaryBroadcastAddress();
    const { subnet = defaultSubnet, timeout = 3000 } = req.body;
    console.log(`Discovering lights on subnet ${subnet}...`);
    
    const devices = await WizDiscovery.discover(timeout, subnet);
    discoveredLights = devices;
    
    console.log(`Found ${devices.length} lights`);
    
    broadcast({
      type: 'discovery',
      data: { lights: devices }
    });
    
    res.json({
      success: true,
      lights: devices,
      count: devices.length,
      subnet: subnet
    });
  } catch (error) {
    console.error('Discovery error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get discovered lights
app.get('/api/lights', (req, res) => {
  // Add current state information to lights
  const lightsWithState = discoveredLights.map(light => {
    const connectedLight = connectedLights.get(light.ip);
    return {
      ...light,
      state: connectedLight ? connectedLight.state.state : false,
      connected: connectedLights.has(light.ip)
    };
  });

  res.json({
    success: true,
    lights: lightsWithState,
    connected: Array.from(connectedLights.keys()),
    states: Object.fromEntries(
      Array.from(connectedLights.entries()).map(([ip, light]) => [ip, light.state.state || false])
    )
  });
});

// Debug endpoint to check connected lights
app.get('/api/debug/connected', (req, res) => {
  res.json({
    success: true,
    connectedCount: connectedLights.size,
    connectedIPs: Array.from(connectedLights.keys()),
    discoveredCount: discoveredLights.length,
    discoveredIPs: discoveredLights.map(l => l.ip)
  });
});

// Connect to a specific light
app.post('/api/lights/:ip/connect', async (req, res) => {
  try {
    const { ip } = req.params;
    
    if (connectedLights.has(ip)) {
      const existingLight = connectedLights.get(ip);
      return res.json({
        success: true,
        message: 'Light already connected',
        ip,
        state: existingLight.state.state || false
      });
    }
    
    const light = new WizLight(ip);
    await light.connect();
    
    // Try to get initial state
    try {
      await light.getState();
    } catch (error) {
      console.warn(`Could not get initial state for ${ip}, defaulting to off`);
      light.state.state = false;
    }
    
    // Listen for state changes
    light.on('stateChange', (state) => {
      broadcast({
        type: 'lightStateChanged',
        data: { ip, state: state.state }
      });
    });
    
    connectedLights.set(ip, light);
    
    console.log(`Light ${ip} connected successfully`);
    console.log(`Total connected lights: ${connectedLights.size}`);
    console.log(`Connected light IPs: ${Array.from(connectedLights.keys())}`);
    
    // Broadcast connection event
    broadcast({
      type: 'lightConnected',
      data: { ip }
    });
    
    // Broadcast initial state
    broadcast({
      type: 'lightStateChanged',
      data: { ip, state: light.state.state || false }
    });
    
    res.json({
      success: true,
      message: 'Light connected successfully',
      ip,
      state: light.state.state || false
    });
  } catch (error) {
    console.error(`Error connecting to light ${req.params.ip}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Disconnect from a light
app.post('/api/lights/:ip/disconnect', (req, res) => {
  const { ip } = req.params;
  const light = connectedLights.get(ip);
  
  if (light) {
    light.disconnect();
    connectedLights.delete(ip);
    rhythmController.removeLight(ip);
  }
  
  res.json({
    success: true,
    message: 'Light disconnected',
    ip
  });
});

// Batch operations (must be defined BEFORE individual routes to avoid route conflicts)
app.post('/api/lights/all/on', async (req, res) => {
  try {
    console.log('All lights on request received');
    console.log('Connected lights:', Array.from(connectedLights.keys()));
    console.log('Connected lights count:', connectedLights.size);
    
    if (connectedLights.size === 0) {
      return res.status(400).json({
        success: false,
        error: 'No lights connected. Please connect to lights first.'
      });
    }
    
    const lightIps = Array.from(connectedLights.keys());
    const lights = Array.from(connectedLights.values());
    
    console.log('Attempting to turn on lights:', lightIps);
    
    const results = await Promise.allSettled(
      lights.map(light => light.turnOn())
    );
    
    console.log('Turn on results:', results);
    
    // Broadcast state changes for successful operations
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        broadcast({
          type: 'lightStateChanged',
          data: { ip: lightIps[index], state: true }
        });
      }
    });
    
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const failedResults = results.filter(r => r.status === 'rejected' || !r.value);
    
    if (failedResults.length > 0) {
      console.log('Some lights failed:', failedResults);
    }
    
    res.json({
      success: successCount > 0,
      results: results.map((result, index) => ({
        ip: lightIps[index],
        success: result.status === 'fulfilled' && result.value,
        error: result.status === 'rejected' ? result.reason?.message : null
      })),
      message: `${successCount}/${results.length} lights turned on successfully`
    });
  } catch (error) {
    console.error('All lights on error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/lights/all/off', async (req, res) => {
  try {
    const lightIps = Array.from(connectedLights.keys());
    const results = await Promise.allSettled(
      Array.from(connectedLights.values()).map(light => light.turnOff())
    );
    
    // Broadcast state changes for successful operations
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        broadcast({
          type: 'lightStateChanged',
          data: { ip: lightIps[index], state: false }
        });
      }
    });
    
    res.json({
      success: true,
      results: results.map((result, index) => ({
        ip: lightIps[index],
        success: result.status === 'fulfilled' && result.value
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Light control endpoints (individual lights)
app.post('/api/lights/:ip/on', async (req, res) => {
  try {
    const light = connectedLights.get(req.params.ip);
    if (!light) {
      return res.status(404).json({ success: false, error: 'Light not connected' });
    }
    
    const success = await light.turnOn();
    
    if (success) {
      // Broadcast state change to all WebSocket clients
      broadcast({
        type: 'lightStateChanged',
        data: { ip: req.params.ip, state: true }
      });
    }
    
    res.json({ success, ip: req.params.ip, state: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/lights/:ip/off', async (req, res) => {
  try {
    const light = connectedLights.get(req.params.ip);
    if (!light) {
      return res.status(404).json({ success: false, error: 'Light not connected' });
    }
    
    const success = await light.turnOff();
    
    if (success) {
      // Broadcast state change to all WebSocket clients
      broadcast({
        type: 'lightStateChanged',
        data: { ip: req.params.ip, state: false }
      });
    }
    
    res.json({ success, ip: req.params.ip, state: false });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/lights/:ip/color', async (req, res) => {
  try {
    const light = connectedLights.get(req.params.ip);
    if (!light) {
      return res.status(404).json({ success: false, error: 'Light not connected' });
    }
    
    const { r, g, b, brightness = 100 } = req.body;
    
    if (r === undefined || g === undefined || b === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'RGB values required (r, g, b)' 
      });
    }
    
    const success = await light.setColor(r, g, b, brightness);
    
    if (success) {
      // Setting color turns the light on
      light.state.state = true;
      
      // Broadcast state change
      broadcast({
        type: 'lightStateChanged',
        data: { ip: req.params.ip, state: true }
      });
    }
    
    res.json({ 
      success, 
      ip: req.params.ip, 
      color: { r, g, b, brightness },
      state: light.state.state 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/lights/:ip/brightness', async (req, res) => {
  try {
    const light = connectedLights.get(req.params.ip);
    if (!light) {
      return res.status(404).json({ success: false, error: 'Light not connected' });
    }
    
    const { brightness } = req.body;
    
    if (brightness === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'Brightness value required (1-100)' 
      });
    }
    
    const success = await light.setBrightness(brightness);
    
    if (success) {
      // Setting brightness turns the light on
      light.state.state = true;
      
      // Broadcast state change
      broadcast({
        type: 'lightStateChanged',
        data: { ip: req.params.ip, state: true }
      });
    }
    
    res.json({ 
      success, 
      ip: req.params.ip, 
      brightness,
      state: light.state.state 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/lights/:ip/temperature', async (req, res) => {
  try {
    const light = connectedLights.get(req.params.ip);
    if (!light) {
      return res.status(404).json({ success: false, error: 'Light not connected' });
    }
    
    const { temperature } = req.body;
    
    if (temperature === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'Temperature value required (2200-6500K)' 
      });
    }
    
    const success = await light.setColorTemperature(temperature);
    
    if (success) {
      // Setting temperature turns the light on
      light.state.state = true;
      
      // Broadcast state change
      broadcast({
        type: 'lightStateChanged',
        data: { ip: req.params.ip, state: true }
      });
    }
    
    res.json({ 
      success, 
      ip: req.params.ip, 
      temperature,
      state: light.state.state 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});



// Rhythm/Music API
app.get('/api/rhythm/status', (req, res) => {
  res.json({
    success: true,
    status: rhythmController.getStatus()
  });
});

app.post('/api/rhythm/setup', async (req, res) => {
  try {
    const { lights = [] } = req.body;
    
    // Clear existing lights
    rhythmController.lights = [];
    
    // Add specified lights or all connected lights
    const lightsToAdd = lights.length > 0 
      ? lights.filter(ip => connectedLights.has(ip)).map(ip => connectedLights.get(ip))
      : Array.from(connectedLights.values());
    
    lightsToAdd.forEach(light => rhythmController.addLight(light));
    
    res.json({
      success: true,
      message: `Rhythm controller setup with ${lightsToAdd.length} lights`,
      lights: lightsToAdd.map(light => light.ip)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/rhythm/start', async (req, res) => {
  try {
    const { effect = 'pulse', bpm = 120, options = {} } = req.body;
    
    if (rhythmController.lights.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No lights configured for rhythm. Use /api/rhythm/setup first.'
      });
    }
    
    rhythmController.setBpm(bpm);
    await rhythmController.startEffect(effect, options);
    
    broadcast({
      type: 'rhythmStarted',
      data: { effect, bpm, options }
    });
    
    res.json({
      success: true,
      message: `Started ${effect} effect at ${bpm} BPM`,
      effect,
      bpm,
      lights: rhythmController.lights.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/rhythm/stop', async (req, res) => {
  try {
    await rhythmController.stop();
    
    broadcast({
      type: 'rhythmStopped',
      data: {}
    });
    
    res.json({
      success: true,
      message: 'Rhythm effects stopped'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/rhythm/bpm', (req, res) => {
  try {
    const { bpm } = req.body;
    
    if (!bpm || bpm < 60 || bpm > 200) {
      return res.status(400).json({
        success: false,
        error: 'BPM must be between 60 and 200'
      });
    }
    
    rhythmController.setBpm(bpm);
    
    res.json({
      success: true,
      message: `BPM set to ${bpm}`,
      bpm
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/rhythm/beat', async (req, res) => {
  try {
    const { intensity = 1 } = req.body;
    
    await rhythmController.triggerBeat(intensity);
    
    res.json({
      success: true,
      message: 'Beat triggered',
      intensity
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/rhythm/effects', (req, res) => {
  res.json({
    success: true,
    effects: [
      { name: 'pulse', description: 'Flash lights on each beat' },
      { name: 'rainbow', description: 'Cycle through rainbow colors' },
      { name: 'strobe', description: 'Random strobe effect' },
      { name: 'wave', description: 'Wave pattern across lights' },
      { name: 'beat', description: 'Random colors on each beat' },
      { name: 'breathe', description: 'Smooth breathing effect' }
    ]
  });
});

// Catch all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'client/build', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Setup rhythm controller event listeners
rhythmController.on('effectStarted', (data) => {
  broadcast({
    type: 'rhythmEffectStarted',
    data
  });
});

rhythmController.on('effectStopped', (data) => {
  broadcast({
    type: 'rhythmEffectStopped',
    data
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  
  // Stop rhythm effects
  await rhythmController.stop();
  
  // Disconnect all lights
  for (const light of connectedLights.values()) {
    light.disconnect();
  }
  
  // Close WebSocket server
  wss.close();
  
  // Close HTTP server
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 WiZ Lights Server running on port ${PORT}`);
  console.log(`📡 WebSocket server running on ws://localhost:${PORT}`);
  console.log('🔍 Use POST /api/discover to find lights on your network');
  console.log('🎵 Use /api/rhythm/* endpoints for music synchronization');
}); 