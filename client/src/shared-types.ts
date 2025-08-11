// Shared types between backend and frontend

export enum IoTDeviceType {
  WIZ_LIGHT = 'wiz_light',
  SMART_PLUG = 'smart_plug',
  SENSOR = 'sensor',
  THERMOSTAT = 'thermostat',
  CAMERA = 'camera',
  SPEAKER = 'speaker'
}

export interface IoTDevice {
  id: string;
  type: IoTDeviceType;
  ip: string;
  port: number;
  mac?: string;
  name: string;
  state: boolean;
  properties: DeviceProperties;
}

// DeviceProperties as a union type - either temperature OR color+brightness, never both
export type DeviceProperties = 
  | {
      // Temperature mode: only temperature, no color or brightness
      temperature: number;  // 2200-6500K for color temperature
      color?: never;
      brightness?: never;
    }
  | {
      // Color mode: color with brightness, no temperature
      temperature?: never;
      color: {
        r: number;         // 0-255
        g: number;         // 0-255
        b: number;         // 0-255
        h?: number;        // 0-360 hue
        s?: number;        // 0-1 saturation
        v?: number;        // 0-1 value/brightness
      };
      brightness: number;  // 1-100 (required with color mode)
    }
  | {
      // Default/off state: no properties set
      temperature?: never;
      color?: never;
      brightness?: never;
    };

export interface Room {
  id: string;
  name: string;
  devices: IoTDevice[];
}

export interface RoomsData {
  rooms: Room[];
}

// Device state management
export interface DeviceState {
  brightness: number;
  temperature?: number;
  color?: {h: number, s: number, v: number};
  state: boolean;
  pendingUpdates: Record<string, any>;
  lastUpdateTime: number;
}

// Unified device state update interface
export interface DeviceStateUpdate {
  brightness?: number;      // 1-100
  temperature?: number;     // 2200-6500K
  color?: {
    r: number;             // 0-255
    g: number;             // 0-255  
    b: number;             // 0-255
    h?: number;            // 0-360 hue
    s?: number;            // 0-1 saturation
    v?: number;            // 0-1 value/brightness
  };
  state?: boolean;          // on/off
}

// API request/response types
export interface UpdatePropertiesPayload {
  color?: {
    r: number;
    g: number;
    b: number;
    brightness?: number;
  };
  brightness?: number;
  temperature?: number;
  [key: string]: unknown;
}

export interface ApiResponse<T = any> {
  success: boolean;
  error?: string;
  message?: string;
  data?: T;
  [key: string]: any;
}

export interface BatchResult {
  ip: string;
  success: boolean;
  error?: string;
}

export interface TestResult {
  ip: string;
  success: boolean;
  error?: string;
  port?: number;
  response?: Record<string, unknown>;
}

// Network discovery types
export interface NetworkInterface {
  name: string;
  address: string;
  netmask: string;
  network: string;
  broadcast: string;
  cidr: number;
}

export interface DiscoveredDevice {
  ip: string;
  port: number;
  response: Record<string, unknown>;
  mac?: string | undefined;
  state?: boolean | undefined;
  rssi?: number | undefined;
  method: string;
  name?: string;
}

export interface Light {
  ip: string;
  port: number;
  mac?: string;
  name?: string;
  state?: boolean;
  brightness?: number;
  temperature?: number;
  r?: number;
  g?: number;
  b?: number;
  response?: any;
}

export interface NetworkInfo {
  success: boolean;
  interfaces: NetworkInterface[];
  primaryBroadcast: string;
  recommendedSubnet: string;
}