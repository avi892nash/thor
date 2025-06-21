import dgram from 'dgram';
import { EventEmitter } from 'events';

export class WizLight extends EventEmitter {
  constructor(ip, port = 38899) {
    super();
    this.ip = ip;
    this.port = port;
    this.socket = null;
    this.isConnected = false;
    this.state = {};
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.socket = dgram.createSocket('udp4');
      this.socket.bind(() => {
        this.isConnected = true;
        resolve();
      });
      this.socket.on('error', reject);
    });
  }

  async sendCommand(method, params = {}) {
    if (!this.isConnected) {
      await this.connect();
    }

    const message = JSON.stringify({ method, params });
    const buffer = Buffer.from(message);

    return new Promise((resolve, reject) => {
      this.socket.send(buffer, this.port, this.ip, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async getState() {
    try {
      await this.sendCommand('getPilot');
      // Note: WiZ lights don't return state in the same UDP call
      // This is a simplified implementation
      return this.state;
    } catch (error) {
      console.error(`Error getting state for ${this.ip}:`, error);
      return null;
    }
  }

  async turnOn() {
    try {
      await this.sendCommand('setPilot', { state: true });
      this.state.state = true;
      this.emit('stateChange', this.state);
      return true;
    } catch (error) {
      console.error(`Error turning on light ${this.ip}:`, error);
      return false;
    }
  }

  async turnOff() {
    try {
      await this.sendCommand('setPilot', { state: false });
      this.state.state = false;
      this.emit('stateChange', this.state);
      return true;
    } catch (error) {
      console.error(`Error turning off light ${this.ip}:`, error);
      return false;
    }
  }

  async setColor(r, g, b, brightness = 100) {
    try {
      await this.sendCommand('setPilot', {
        r: Math.max(0, Math.min(255, r)),
        g: Math.max(0, Math.min(255, g)),
        b: Math.max(0, Math.min(255, b)),
        dimming: Math.max(1, Math.min(100, brightness))
      });
      
      this.state = { ...this.state, r, g, b, brightness };
      this.emit('stateChange', this.state);
      return true;
    } catch (error) {
      console.error(`Error setting color for ${this.ip}:`, error);
      return false;
    }
  }

  async setBrightness(brightness) {
    try {
      await this.sendCommand('setPilot', {
        dimming: Math.max(1, Math.min(100, brightness))
      });
      
      this.state.brightness = brightness;
      this.emit('stateChange', this.state);
      return true;
    } catch (error) {
      console.error(`Error setting brightness for ${this.ip}:`, error);
      return false;
    }
  }

  async setColorTemperature(temp) {
    try {
      // WiZ color temperature range is typically 2200-6500K
      const clampedTemp = Math.max(2200, Math.min(6500, temp));
      await this.sendCommand('setPilot', { temp: clampedTemp });
      
      this.state.temp = clampedTemp;
      this.emit('stateChange', this.state);
      return true;
    } catch (error) {
      console.error(`Error setting color temperature for ${this.ip}:`, error);
      return false;
    }
  }

  async setScene(sceneId) {
    try {
      await this.sendCommand('setPilot', { sceneId });
      this.state.sceneId = sceneId;
      this.emit('stateChange', this.state);
      return true;
    } catch (error) {
      console.error(`Error setting scene for ${this.ip}:`, error);
      return false;
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.isConnected = false;
    }
  }
}

export class WizDiscovery {
  static async discover(timeout = 5000, subnet = '192.168.1.255') {
    console.log(`🔍 Starting WiZ light discovery on ${subnet}...`);
    
    // Step 1: Try broadcast first (faster)
    console.log('📡 Trying broadcast discovery...');
    const broadcastDevices = await this.discoverViaBroadcast(timeout / 2, subnet);
    
    if (broadcastDevices.length > 0) {
      console.log(`✅ Broadcast found ${broadcastDevices.length} lights. Discovery complete.`);
      return broadcastDevices;
    }
    
    console.log('📡 Broadcast failed or found no lights. Falling back to IP ping scan...');
    
    // Step 2: If broadcast fails, ping all IPs in subnet
    const pingDevices = await this.discoverViaPing(timeout / 2, subnet);
    
    console.log(`🎯 IP ping scan complete. Found ${pingDevices.length} lights total.`);
    return pingDevices;
  }

  // Method 1: Broadcast discovery (fast but may not work on all networks)
  static async discoverViaBroadcast(timeout = 2000, subnet = '192.168.1.255') {
    return new Promise((resolve) => {
      const socket = dgram.createSocket('udp4');
      const devices = [];
  
      socket.bind(() => {
        socket.setBroadcast(true);
      });
  
      const DISCOVER_MSG = Buffer.from(JSON.stringify({ 
        method: 'getPilot', 
        params: {} 
      }));
  
      socket.on('message', (msg, rinfo) => {
        try {
          const response = JSON.parse(msg.toString());
          if (response.result && (response.result.mac || response.result.state !== undefined)) {
            const device = {
              ip: rinfo.address,
              port: rinfo.port,
              response: response.result,
              mac: response.result.mac,
              state: response.result.state,
              rssi: response.result.rssi,
              method: 'broadcast'
            };
            
            // Avoid duplicates
            if (!devices.find(d => d.ip === device.ip)) {
              console.log(`📡 Broadcast found WiZ light at ${device.ip}:`, response.result);
              devices.push(device);
            }
          }
        } catch (e) {
          // Ignore invalid JSON responses
        }
      });
  
      socket.on('error', (err) => {
        console.log('📡 Broadcast error:', err.message);
      });
  
      // Send multiple broadcasts to catch all devices
      const sendBroadcast = () => {
        socket.send(DISCOVER_MSG, 38899, subnet, (err) => {
          if (err) {
            console.error('📡 Error sending broadcast:', err.message);
          }
        });
      };
  
      // Send initial broadcast
      sendBroadcast();
      
      // Send additional broadcasts every 500ms
      const intervalId = setInterval(sendBroadcast, 500);
  
      setTimeout(() => {
        clearInterval(intervalId);
        socket.close();
        resolve(devices);
      }, timeout);
    });
  }

  // Method 2: Ping all IPs in subnet
  static async discoverViaPing(timeout = 3000, subnet = '192.168.1.255') {
    // Parse subnet to get base IP range
    const subnetBase = subnet.split('.').slice(0, 3).join('.');
    const devices = [];
    const DISCOVER_MSG = Buffer.from(JSON.stringify({ 
      method: 'getPilot', 
      params: {} 
    }));

    console.log(`🎯 Scanning ${subnetBase}.1-254 for WiZ lights...`);

    // Create promises for all IP addresses in the range
    const promises = [];
    
    for (let i = 1; i <= 254; i++) {
      const ip = `${subnetBase}.${i}`;
      
      const promise = new Promise((resolve) => {
        const socket = dgram.createSocket('udp4');
        let responded = false;
        
        // Set up response handler
        socket.on('message', (msg, rinfo) => {
          if (responded) return;
          
          try {
            const response = JSON.parse(msg.toString());
            if (response.result && (response.result.mac || response.result.state !== undefined)) {
              responded = true;
              const device = {
                ip: rinfo.address,
                port: rinfo.port,
                response: response.result,
                mac: response.result.mac,
                state: response.result.state,
                rssi: response.result.rssi,
                method: 'ping'
              };
              
              console.log(`🎯 Ping found WiZ light at ${ip}:`, response.result);
              socket.close();
              resolve(device);
            }
          } catch (e) {
            // Ignore invalid responses
          }
        });

        socket.on('error', () => {
          if (!responded) {
            socket.close();
            resolve(null);
          }
        });

        // Bind socket and send discovery message
        socket.bind(() => {
          socket.send(DISCOVER_MSG, 38899, ip, (err) => {
            if (err && !responded) {
              socket.close();
              resolve(null);
            }
          });

          // Timeout for this specific IP
          setTimeout(() => {
            if (!responded) {
              socket.close();
              resolve(null);
            }
          }, timeout / 50); // Short timeout per IP since we're doing 254 of them
        });
      });
      
      promises.push(promise);
    }

    // Wait for all promises to complete
    const results = await Promise.all(promises);
    
    // Filter out null results and add to devices array
    results.forEach(device => {
      if (device && !devices.find(d => d.ip === device.ip)) {
        devices.push(device);
      }
    });

    return devices;
  }

  // Alternative method for testing a single IP
  static async testSingleIP(ip, timeout = 1000) {
    return new Promise((resolve) => {
      const socket = dgram.createSocket('udp4');
      const DISCOVER_MSG = Buffer.from(JSON.stringify({ 
        method: 'getPilot', 
        params: {} 
      }));

      let responded = false;

      socket.on('message', (msg, rinfo) => {
        if (responded) return;
        
        try {
          const response = JSON.parse(msg.toString());
          if (response.result) {
            responded = true;
            socket.close();
            resolve({
              ip: rinfo.address,
              port: rinfo.port,
              response: response.result,
              success: true
            });
          }
        } catch (e) {
          // Ignore invalid responses
        }
      });

      socket.on('error', (err) => {
        if (!responded) {
          socket.close();
          resolve({ ip, success: false, error: err.message });
        }
      });

      socket.bind(() => {
        socket.send(DISCOVER_MSG, 38899, ip, (err) => {
          if (err && !responded) {
            socket.close();
            resolve({ ip, success: false, error: err.message });
          }
        });

        setTimeout(() => {
          if (!responded) {
            socket.close();
            resolve({ ip, success: false, error: 'Timeout' });
          }
        }, timeout);
      });
    });
  }
} 