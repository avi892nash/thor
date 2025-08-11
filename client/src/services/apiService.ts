import { ApiResponse, Room, Light, NetworkInfo, DeviceProperties } from '../types';

// Base API configuration
const API_BASE = '';

// Generic API call function
const apiCall = async <T = any>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: any
): Promise<ApiResponse<T>> => {
  try {
    const config: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      config.body = JSON.stringify(data);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, config);
    const result = await response.json();

    if (!response.ok) {
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
    const response = await fetch('/api/rooms');
    if (!response.ok) {
      throw new Error(`Failed to load rooms: ${response.statusText}`);
    }
    return await response.json();
  },

  // Save rooms
  saveRooms: async (rooms: Room[]): Promise<void> => {
    const response = await fetch('/api/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rooms }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to save rooms: ${response.statusText}`);
    }
  }
};

// Light Control API
export const lightsApi = {
  // Toggle light on/off
  toggleLight: async (ip: string, state: 'on' | 'off'): Promise<ApiResponse> => {
    return apiCall(`/api/lights/${ip}/${state}`, 'POST');
  },

  // Update light properties (color, brightness, temperature)
  updateLightProperties: async (ip: string, properties: DeviceProperties): Promise<void> => {
    const response = await fetch(`/api/lights/${ip}/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(properties),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to update light ${ip}`);
    }
  },

  // Toggle multiple lights
  toggleMultipleLights: async (ips: string[], state: 'on' | 'off'): Promise<ApiResponse[]> => {
    const promises = ips.map(ip => lightsApi.toggleLight(ip, state));
    return Promise.all(promises);
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