// Shared types between backend and frontend

// WiZ Scene definitions - ordered by ID
export const WIZ_SCENES: Record<number, string> = {
  1: "Ocean",
  2: "Romance",
  3: "Sunset",
  4: "Party",
  5: "Fireplace",
  6: "Cozy",
  7: "Forest",
  8: "Pastel colors",
  9: "Wake-up",
  10: "Bedtime",
  11: "Warm white",
  12: "Daylight",
  13: "Cool white",
  14: "Night light",
  15: "Focus",
  16: "Relax",
  17: "True colors",
  18: "TV time",
  19: "Plantgrowth",
  20: "Spring",
  21: "Summer",
  22: "Fall",
  23: "Deep dive",
  24: "Jungle",
  25: "Mojito",
  26: "Club",
  27: "Christmas",
  28: "Halloween",
  29: "Candlelight",
  30: "Golden white",
  31: "Pulse",
  32: "Steampunk",
  33: "Diwali",
  34: "White",
  35: "Alarm",
  36: "Snowy sky",
  1000: "Rhythm",
};

// Reverse mapping: scene name to ID
export const WIZ_SCENE_NAME_TO_ID: Record<string, number> = Object.fromEntries(
  Object.entries(WIZ_SCENES).map(([id, name]) => [name, parseInt(id)])
);

// Scenes that work with tunable white bulbs
export const TW_SCENE_IDS = [6, 9, 10, 11, 12, 13, 14, 15, 16, 18, 29, 30, 31, 32, 33, 35];

// Scenes that work with dimmable white bulbs
export const DW_SCENE_IDS = [9, 10, 14, 29, 31, 32, 34, 35];

// Dynamic scenes that support speed control
export const DYNAMIC_SCENE_IDS = [1, 2, 3, 4, 5, 7, 8, 20, 21, 22, 23, 24, 25, 26, 27, 28, 31, 35, 36];

// Scene categories for UI grouping
export const SCENE_CATEGORIES = {
  "Whites": [11, 12, 13, 14, 29, 30, 34],
  "Warm & Cozy": [5, 6, 16, 29],
  "Productivity": [12, 15, 17],
  "Entertainment": [4, 18, 26, 31],
  "Nature": [1, 7, 20, 21, 22, 23, 24, 25],
  "Mood": [2, 3, 8],
  "Seasonal": [27, 28, 33, 36],
  "Special": [9, 10, 19, 32, 35, 1000],
};

export enum IoTDeviceType {
  WIZ_LIGHT = 'wiz_light',
  SMART_PLUG = 'smart_plug',
  SENSOR = 'sensor',
  THERMOSTAT = 'thermostat',
  CAMERA = 'camera',
  SPEAKER = 'speaker'
}

export interface IoTDevice {
  id: string;              // MAC address as primary identifier
  type: IoTDeviceType;
  mac: string;             // MAC address (required, same as id)
  ip: string;              // Current IP address (can change via DHCP)
  port: number;
  name: string;
  state: boolean;
  properties: DeviceProperties;
}

// WiZ bulb parameters interface
export interface WizParams {
  state?: boolean;           // on/off
  dimming?: number;          // 10-100 brightness percent
  speed?: number;            // 10-200 color changing speed percent
  temp?: number;             // 2200-6500 color temperature in Kelvin
  r?: number;                // 0-255 red
  g?: number;                // 0-255 green
  b?: number;                // 0-255 blue
  c?: number;                // 0-255 cold white
  w?: number;                // 0-255 warm white
  sceneId?: number;          // 1-35 (or 1000 for Rhythm)
  schdPsetId?: number;       // rhythm ID of the room
}

// DeviceProperties - flexible interface for all WiZ features
export interface DeviceProperties {
  // Basic controls
  brightness?: number;       // 1-100 (maps to dimming)
  temperature?: number;      // 2200-6500K color temperature

  // Color controls
  color?: {
    r: number;               // 0-255
    g: number;               // 0-255
    b: number;               // 0-255
    h?: number;              // 0-360 hue
    s?: number;              // 0-1 saturation
    v?: number;              // 0-1 value/brightness
  };

  // Scene controls
  sceneId?: number;          // 1-35 predefined scenes, 1000 for Rhythm
  speed?: number;            // 10-200 for dynamic scenes

  // White balance (advanced)
  coldWhite?: number;        // 0-255 (c parameter)
  warmWhite?: number;        // 0-255 (w parameter)

  // Rhythm mode
  rhythmId?: number;         // schdPsetId - rhythm preset ID
}

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
  sceneId?: number;          // Current active scene
  speed?: number;            // Speed for dynamic scenes (10-200)
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
  sceneId?: number;
  speed?: number;
  response?: any;
}

export interface NetworkInfo {
  success: boolean;
  interfaces: NetworkInterface[];
  primaryBroadcast: string;
  recommendedSubnet: string;
}