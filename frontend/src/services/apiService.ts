import { ApiResponse, Room, Light, NetworkInfo, DeviceProperties } from '../types';

// Light status response from polling
export interface LightStatus {
  ip: string;
  success: boolean;
  mac?: string;
  state?: boolean;
  brightness?: number;
  temperature?: number;
  sceneId?: number;
  r?: number;
  g?: number;
  b?: number;
  offline?: boolean;
}

// Base API configuration - set via environment variable or defaults to localhost:3001
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const API_KEY = process.env.REACT_APP_API_KEY || '';

// Common headers for all requests
const getHeaders = (): HeadersInit => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Add API key if configured
  if (API_KEY) {
    headers['x-api-key'] = API_KEY;
  }

  return headers;
};

// Generic API call function
const apiCall = async <T = any>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: any
): Promise<ApiResponse<T>> => {
  try {
    const config: RequestInit = {
      method,
      headers: getHeaders(),
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      config.body = JSON.stringify(data);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, config);
    const result = await response.json();

    if (!response.ok) {
      // Handle authentication errors specifically
      if (response.status === 401 || response.status === 403) {
        console.error('Authentication failed:', result.message);
        throw new Error(result.message || 'Authentication failed');
      }
      throw new Error(result.error || `HTTP error! status: ${response.status}`);
    }

    return result;
  } catch (error) {
    console.error(`API call failed for ${method} ${endpoint}:`, error);
    throw error;
  }
};

// Room Management API
export const roomsApi = {
  // Get all rooms
  getRooms: async (): Promise<{ rooms: Room[] }> => {
    const response = await fetch(`${API_BASE}/api/rooms`, {
      headers: getHeaders(),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Failed to load rooms: ${response.statusText}`);
    }
    return await response.json();
  },

  // Save rooms
  saveRooms: async (rooms: Room[]): Promise<void> => {
    const response = await fetch(`${API_BASE}/api/rooms`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ rooms }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Failed to save rooms: ${response.statusText}`);
    }
  }
};

// Light Control API
export const lightsApi = {
  // Toggle light on/off
  toggleLight: async (ip: string, state: 'on' | 'off'): Promise<ApiResponse> => {
    return apiCall(`/api/lights/${ip}/${state}`, 'POST');
  },

  // Update light properties (color, brightness, temperature, scene, speed)
  updateLightProperties: async (ip: string, properties: DeviceProperties): Promise<void> => {
    const response = await fetch(`${API_BASE}/api/lights/${ip}/update`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(properties),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || `Failed to update light ${ip}`);
    }
  },

  // Set scene for a light
  setScene: async (ip: string, sceneId: number, speed?: number, brightness?: number): Promise<void> => {
    const properties: DeviceProperties = { sceneId };
    if (speed !== undefined) properties.speed = speed;
    if (brightness !== undefined) properties.brightness = brightness;
    return lightsApi.updateLightProperties(ip, properties);
  },

  // Set scene for multiple lights
  setSceneMultiple: async (ips: string[], sceneId: number, speed?: number, brightness?: number): Promise<void[]> => {
    const promises = ips.map(ip => lightsApi.setScene(ip, sceneId, speed, brightness));
    return Promise.all(promises);
  },

  // Toggle multiple lights
  toggleMultipleLights: async (ips: string[], state: 'on' | 'off'): Promise<ApiResponse[]> => {
    const promises = ips.map(ip => lightsApi.toggleLight(ip, state));
    return Promise.all(promises);
  },

  // Get single light status
  getLightStatus: async (ip: string): Promise<ApiResponse> => {
    return apiCall(`/api/lights/${ip}/status`);
  },

  // Get multiple lights status (batch)
  getBatchStatus: async (ips: string[]): Promise<ApiResponse<{ results: LightStatus[] }>> => {
    return apiCall('/api/lights/status', 'POST', { ips });
  }
};

// Discovery API
export const discoveryApi = {
  // Get network information
  getNetworkInfo: async (): Promise<ApiResponse<NetworkInfo>> => {
    return apiCall<NetworkInfo>('/api/network');
  },

  // Discover lights on network
  discoverLights: async (subnet?: string, timeout: number = 5000): Promise<ApiResponse<{ lights: Light[] }>> => {
    return apiCall('/api/discover', 'POST', { 
      subnet, 
      timeout 
    });
  }
};

// Combined API service export
export const apiService = {
  rooms: roomsApi,
  lights: lightsApi,
  discovery: discoveryApi
};

// Default export for convenience
export default apiService;