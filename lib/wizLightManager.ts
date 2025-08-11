import dgram from 'dgram';
import { EventEmitter } from 'events';
import { IOTManager } from './iotManager.js';
import { UpdatePropertiesPayload, BatchResult, DiscoveredDevice, TestResult } from '../shared/types.js';

interface LightState {
  state?: boolean;
  brightness?: number;
  color?: {
    r: number;
    g: number;
    b: number;
    brightness?: number;
  };
  temperature?: number;
  [key: string]: unknown;
}


// Individual WizLight class
class WizLight extends EventEmitter {
  public ip: string;
  public port: number;
  public state: LightState;

  constructor(ip: string, port = 38899) {
    super();
    this.ip = ip;
    this.port = port;
    this.state = {};
  }


  async sendCommand(method: string, params: Record<string, unknown> = {}): Promise<void> {
    const socket = dgram.createSocket('udp4');
    const message = JSON.stringify({ method, params });
    const buffer = Buffer.from(message);

    return new Promise((resolve, reject) => {
      socket.send(buffer, this.port, this.ip, (err) => {
        socket.close();
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async getState(): Promise<LightState | null> {
    try {
      await this.sendCommand('getPilot');
      return this.state;
    } catch (error) {
      console.error(`Error getting state for ${this.ip}:`, error);
      return null;
    }
  }

  async executeCommand(method: string, params: Record<string, unknown> = {}, newState: Partial<LightState> = {}): Promise<boolean> {
    try {
      await this.sendCommand(method, params);
      Object.assign(this.state, newState);
      this.emit('stateChange', this.state);
      return true;
    } catch (error) {
      console.error(`Error ${method} for ${this.ip}:`, error);
      return false;
    }
  }

  async turnOn(): Promise<boolean> {
    return this.executeCommand('setPilot', { state: true }, { state: true });
  }

  async turnOff(): Promise<boolean> {
    return this.executeCommand('setPilot', { state: false }, { state: false });
  }

  async updateProperties(payload: UpdatePropertiesPayload): Promise<boolean> {
    const clamp = (val: number, min: number, max: number): number => Math.max(min, Math.min(max, val));
    const params: Record<string, unknown> = {};
    const stateUpdate: Partial<LightState> = {};

    // Handle color (takes priority over individual brightness/temperature)
    if (payload.color && payload.color.r !== undefined && payload.color.g !== undefined && payload.color.b !== undefined) {
      params['r'] = clamp(payload.color.r, 0, 255);
      params['g'] = clamp(payload.color.g, 0, 255);
      params['b'] = clamp(payload.color.b, 0, 255);
      const brightness = payload.color.brightness || payload.brightness || 100;
      params['dimming'] = clamp(brightness, 1, 100);
      stateUpdate.color = payload.color;
      stateUpdate.brightness = brightness;
    }
    // Handle brightness only
    else if (payload.brightness !== undefined) {
      params['dimming'] = clamp(payload.brightness, 1, 100);
      stateUpdate.brightness = payload.brightness;
    }
    // Handle temperature only
    else if (payload.temperature !== undefined) {
      params['temp'] = clamp(payload.temperature, 2200, 6500);
      stateUpdate.temperature = payload.temperature;
    }

    if (Object.keys(params).length === 0) {
      throw new Error('No valid properties provided');
    }

    return this.executeCommand('setPilot', params, stateUpdate);
  }

  disconnect(): void {
    // No-op since we don't maintain persistent connections
  }
}

export class WizLightManager extends IOTManager {
  public lights: Map<string, WizLight>;
  public discoveredDevices: DiscoveredDevice[];

  constructor() {
    super(null, null, 'WiZ Light Manager');
    this.lights = new Map();
    this.discoveredDevices = [];
  }

  // Manager methods for handling multiple lights
  async addLight(ip: string, port = 38899): Promise<WizLight> {
    if (this.lights.has(ip)) {
      this.log(`Light ${ip} already managed`);
      return this.lights.get(ip)!;
    }

    const light = new WizLight(ip, port);
    
    this.lights.set(ip, light);
    
    // Forward light events
    light.on('stateChange', (state: LightState) => {
      this.emit('lightStateChange', { ip, state });
    });
    
    this.log(`Added light ${ip} to manager`);
    return light;
  }

  removeLight(ip: string): boolean {
    const light = this.lights.get(ip);
    if (light) {
      light.disconnect();
      this.lights.delete(ip);
      this.log(`Removed light ${ip} from manager`);
      this.emit('lightRemoved', { ip });
      return true;
    }
    return false;
  }

  getLight(ip: string): WizLight | undefined {
    return this.lights.get(ip);
  }

  getAllLights(): WizLight[] {
    return Array.from(this.lights.values());
  }

  getAllLightIPs(): string[] {
    return Array.from(this.lights.keys());
  }

  getLightCount(): number {
    return this.lights.size;
  }

  async disconnectAll(): Promise<void> {
    for (const [ip, light] of this.lights) {
      light.disconnect();
      this.log(`Disconnected light ${ip}`);
    }
    this.lights.clear();
    this.log('All lights disconnected');
  }

  // Batch operations
  async turnOnAll(): Promise<BatchResult[]> {
    const results: BatchResult[] = [];
    for (const [ip, light] of this.lights) {
      try {
        const success = await light.turnOn();
        results.push({ ip, success });
      } catch (error) {
        results.push({ ip, success: false, error: (error as Error).message });
      }
    }
    this.log(`Turned on ${results.filter(r => r.success).length}/${results.length} lights`);
    return results;
  }

  async turnOffAll(): Promise<BatchResult[]> {
    const results: BatchResult[] = [];
    for (const [ip, light] of this.lights) {
      try {
        const success = await light.turnOff();
        results.push({ ip, success });
      } catch (error) {
        results.push({ ip, success: false, error: (error as Error).message });
      }
    }
    this.log(`Turned off ${results.filter(r => r.success).length}/${results.length} lights`);
    return results;
  }

  async updateAllLights(payload: UpdatePropertiesPayload): Promise<BatchResult[]> {
    const results: BatchResult[] = [];
    for (const [ip, light] of this.lights) {
      try {
        const success = await light.updateProperties(payload);
        results.push({ ip, success });
      } catch (error) {
        results.push({ ip, success: false, error: (error as Error).message });
      }
    }
    this.log(`Updated ${results.filter(r => r.success).length}/${results.length} lights`);
    return results;
  }

  // Discovery wrapper
  async discoverDevices(timeout = 5000, subnet = '192.168.1.255'): Promise<DiscoveredDevice[]> {
    this.log(`Starting discovery on ${subnet}`);
    this.discoveredDevices = await WizLightManager.discover(timeout, subnet);
    this.log(`Discovered ${this.discoveredDevices.length} devices`);
    return this.discoveredDevices;
  }

  getDiscoveredDevices(): DiscoveredDevice[] {
    return this.discoveredDevices;
  }

  // IOTManager interface implementation
  async connect(): Promise<void> {
    this.isConnected = true;
    this.log('Manager initialized');
  }

  async disconnect(): Promise<void> {
    await this.disconnectAll();
    this.isConnected = false;
    this.log('Manager disconnected');
  }

  async sendCommand(_method: string, _params: Record<string, unknown> = {}): Promise<void> {
    throw new Error('Use individual light methods or batch operations');
  }

  async getState(): Promise<Record<string, unknown>> {
    const states: Record<string, LightState> = {};
    for (const [ip, light] of this.lights) {
      states[ip] = light.state;
    }
    return states;
  }

  async executeCommand(_method: string, _params: Record<string, unknown> = {}, _newState: Record<string, unknown> = {}): Promise<boolean> {
    throw new Error('Use individual light methods or batch operations');
  }

  async turnOn(): Promise<boolean> {
    const results = await this.turnOnAll();
    return results.some(r => r.success);
  }

  async turnOff(): Promise<boolean> {
    const results = await this.turnOffAll();
    return results.some(r => r.success);
  }

  async updateProperties(payload: UpdatePropertiesPayload): Promise<boolean> {
    const results = await this.updateAllLights(payload);
    return results.some(r => r.success);
  }

  // Discovery helper - static method
  static async discover(timeout = 5000, subnet = '192.168.1.255'): Promise<DiscoveredDevice[]> {
    console.log(`🔍 Starting WiZ light discovery on ${subnet}...`);
    
    // Step 1: Try broadcast first (faster)
    console.log('📡 Trying broadcast discovery...');
    const broadcastDevices = await WizLightManager.discoverViaBroadcast(timeout / 2, subnet);
    
    if (broadcastDevices.length > 0) {
      console.log(`✅ Broadcast found ${broadcastDevices.length} lights. Discovery complete.`);
      return broadcastDevices;
    }
    
    console.log('📡 Broadcast failed or found no lights. Falling back to IP ping scan...');
    
    // Step 2: If broadcast fails, ping all IPs in subnet
    const pingDevices = await WizLightManager.discoverViaPing(timeout / 2, subnet);
    
    console.log(`🎯 IP ping scan complete. Found ${pingDevices.length} lights total.`);
    return pingDevices;
  }

  static async discoverViaBroadcast(timeout = 2000, subnet = '192.168.1.255'): Promise<DiscoveredDevice[]> {
    return new Promise((resolve) => {
      const socket = dgram.createSocket('udp4');
      const devices: DiscoveredDevice[] = [];
      const DISCOVER_MSG = Buffer.from(JSON.stringify({ method: 'getPilot', params: {} }));
  
      socket.bind(() => socket.setBroadcast(true));
  
      socket.on('message', (msg, rinfo) => {
        try {
          const response = JSON.parse(msg.toString()) as { result?: Record<string, unknown> };
          if (response.result && (response.result['mac'] || response.result['state'] !== undefined)) {
            const device: DiscoveredDevice = {
              ip: rinfo.address,
              port: rinfo.port,
              response: response.result,
              mac: response.result['mac'] as string | undefined,
              state: response.result['state'] as boolean | undefined,
              rssi: response.result['rssi'] as number | undefined,
              method: 'broadcast'
            };
            
            if (!devices.find(d => d.ip === device.ip)) {
              console.log(`📡 Broadcast found WiZ light at ${device.ip}:`, response.result);
              devices.push(device);
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      });
  
      socket.on('error', (err) => console.log('📡 Broadcast error:', err.message));
  
      const sendBroadcast = (): void => {
        socket.send(DISCOVER_MSG, 38899, subnet, (err) => {
          if (err) console.error('📡 Error sending broadcast:', err.message);
        });
      };
  
      sendBroadcast();
      const intervalId = setInterval(sendBroadcast, 500);
  
      setTimeout(() => {
        clearInterval(intervalId);
        socket.close();
        resolve(devices);
      }, timeout);
    });
  }

  static async discoverViaPing(timeout = 3000, subnet = '192.168.1.255'): Promise<DiscoveredDevice[]> {
    const subnetBase = subnet.split('.').slice(0, 3).join('.');
    const devices: DiscoveredDevice[] = [];
    const DISCOVER_MSG = Buffer.from(JSON.stringify({ method: 'getPilot', params: {} }));

    console.log(`🎯 Scanning ${subnetBase}.1-254 for WiZ lights...`);

    const createPingPromise = (ip: string): Promise<DiscoveredDevice | null> => new Promise((resolve) => {
      const socket = dgram.createSocket('udp4');
      let responded = false;
      
      const cleanup = (result: DiscoveredDevice | null): void => {
        if (!responded) {
          responded = true;
          socket.close();
          resolve(result);
        }
      };
      
      socket.on('message', (msg, rinfo) => {
        try {
          const response = JSON.parse(msg.toString()) as { result?: Record<string, unknown> };
          if (response.result && (response.result['mac'] || response.result['state'] !== undefined)) {
            console.log(`🎯 Ping found WiZ light at ${ip}:`, response.result);
            cleanup({
              ip: rinfo.address,
              port: rinfo.port,
              response: response.result,
              mac: response.result['mac'] as string | undefined,
              state: response.result['state'] as boolean | undefined,
              rssi: response.result['rssi'] as number | undefined,
              method: 'ping'
            });
          }
        } catch (e) {
          // Ignore parse errors
        }
      });

      socket.on('error', () => cleanup(null));

      socket.bind(() => {
        socket.send(DISCOVER_MSG, 38899, ip, (err) => {
          if (err) cleanup(null);
        });
        setTimeout(() => cleanup(null), timeout / 50);
      });
    });
    
    const promises = Array.from({length: 254}, (_, i) => 
      createPingPromise(`${subnetBase}.${i + 1}`)
    );

    const results = await Promise.all(promises);
    results.forEach(device => {
      if (device && !devices.find(d => d.ip === device.ip)) {
        devices.push(device);
      }
    });

    return devices;
  }

  static async testSingleIP(ip: string, timeout = 1000): Promise<TestResult> {
    return new Promise((resolve) => {
      const socket = dgram.createSocket('udp4');
      const DISCOVER_MSG = Buffer.from(JSON.stringify({ method: 'getPilot', params: {} }));
      let responded = false;

      const cleanup = (result: TestResult): void => {
        if (!responded) {
          responded = true;
          socket.close();
          resolve(result);
        }
      };

      socket.on('message', (msg, rinfo) => {
        try {
          const response = JSON.parse(msg.toString()) as { result?: Record<string, unknown> };
          if (response.result) {
            cleanup({
              ip: rinfo.address,
              port: rinfo.port,
              response: response.result,
              success: true
            });
          }
        } catch (e) {
          // Ignore parse errors
        }
      });

      socket.on('error', (err) => cleanup({ ip, success: false, error: err.message }));

      socket.bind(() => {
        socket.send(DISCOVER_MSG, 38899, ip, (err) => {
          if (err) cleanup({ ip, success: false, error: err.message });
        });
        setTimeout(() => cleanup({ ip, success: false, error: 'Timeout' }), timeout);
      });
    });
  }
}