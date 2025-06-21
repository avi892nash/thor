export interface Light {
  ip: string;
  port: number;
  mac?: string;
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

export interface NetworkInterface {
  name: string;
  address: string;
  netmask: string;
  broadcast: string;
  network: string;
  cidr: number;
}

export interface RhythmStatus {
  isRunning: boolean;
  currentEffect?: string;
  bpm?: number;
  lightsCount?: number;
  effects?: string[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  error?: string;
  message?: string;
  data?: T;
  [key: string]: any;
}

export interface WebSocketMessage {
  type: string;
  data: any;
} 