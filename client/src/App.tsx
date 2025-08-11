import { useState, useCallback } from 'react';
import { RoomManager } from './components/RoomManager';
import { apiService } from './services/apiService';

function App() {
  const [lightStates, setLightStates] = useState<{ [ip: string]: boolean }>({});

  const toggleLight = useCallback(async (ip: string) => {
    try {
      const currentState = lightStates[ip];
      const endpoint = currentState ? 'off' : 'on';
      const result = await apiService.lights.toggleLight(ip, endpoint);
      if (result.success) {
        setLightStates(prev => ({ ...prev, [ip]: !currentState }));
      }
      return result;
    } catch (error) {
      console.error(`Failed to toggle light ${ip}:`, error);
      throw error;
    }
  }, [lightStates]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      
              <div className="container mx-auto px-4 py-5 max-w-6xl bg-gray-900">
          <div className="flex items-center justify-center mb-5">
          <img src="/thor.png" alt="Thor Logo" className="w-16 h-16 mr-4" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">Thor: Smart Home Automation</h1>
        </div>
        
        <RoomManager 
          onToggleLight={toggleLight}
          onToggleAllLights={async (ips: string[], state: boolean) => {
            const endpoint = state ? 'on' : 'off';
            await apiService.lights.toggleMultipleLights(ips, endpoint);
          }}
        />
      </div>
    </div>
  );
}

export default App;
