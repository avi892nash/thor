import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import { DiscoverySection } from './components/DiscoverySection';
import { LightControlSection } from './components/LightControlSection';
import { RhythmControlSection } from './components/RhythmControlSection';
import { WebSocketStatus } from './components/WebSocketStatus';
import { useWebSocket } from './hooks/useWebSocket';
import { useApi } from './hooks/useApi';
import { Light, RhythmStatus, NetworkInfo } from './types';

function App() {
  const [discoveredLights, setDiscoveredLights] = useState<Light[]>([]);
  const [connectedLights, setConnectedLights] = useState<string[]>([]);
  const [lightStates, setLightStates] = useState<{ [ip: string]: boolean }>({});
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [rhythmStatus, setRhythmStatus] = useState<RhythmStatus | null>(null);
  
  const { apiCall } = useApi();
  const { isConnected, lastMessage } = useWebSocket();

  const loadNetworkInfo = useCallback(async () => {
    try {
      const result = await apiCall('/api/network');
      if (result.success) {
        setNetworkInfo({
          success: result.success,
          interfaces: result.interfaces,
          primaryBroadcast: result.primaryBroadcast,
          recommendedSubnet: result.recommendedSubnet
        });
      }
    } catch (error) {
      console.error('Failed to load network info:', error);
    }
  }, [apiCall]);

  const loadRhythmStatus = useCallback(async () => {
    try {
      const result = await apiCall('/api/rhythm/status');
      if (result.success) {
        setRhythmStatus(result.status);
      }
    } catch (error) {
      console.error('Failed to load rhythm status:', error);
    }
  }, [apiCall]);

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      switch (lastMessage.type) {
        case 'discovery':
          setDiscoveredLights(lastMessage.data.lights);
          break;
        case 'lightConnected':
          setConnectedLights(prev => [...prev, lastMessage.data.ip]);
          break;
        case 'lightDisconnected':
          setConnectedLights(prev => prev.filter(ip => ip !== lastMessage.data.ip));
          break;
        case 'lightStateChanged':
          setLightStates(prev => ({
            ...prev,
            [lastMessage.data.ip]: lastMessage.data.state
          }));
          break;
        case 'rhythmStarted':
        case 'rhythmStopped':
        case 'rhythmEffectStarted':
        case 'rhythmEffectStopped':
          loadRhythmStatus();
          break;
        case 'rhythmStatus':
          setRhythmStatus(lastMessage.data.status);
          break;
        default:
          break;
      }
    }
  }, [lastMessage, loadRhythmStatus]);

  // Load network info on component mount
  useEffect(() => {
    loadNetworkInfo();
    loadRhythmStatus();
  }, [loadNetworkInfo, loadRhythmStatus]);

  const refreshLights = useCallback(async () => {
    try {
      const result = await apiCall('/api/lights');
      if (result.success) {
        setDiscoveredLights(result.lights);
        setConnectedLights(result.connected);
        
        // Update light states from the enhanced API response
        if (result.states) {
          setLightStates(result.states);
        } else {
          // Fallback to individual light state parsing
          const states: { [ip: string]: boolean } = {};
          result.lights.forEach((light: Light) => {
            states[light.ip] = light.state || false;
          });
          setLightStates(states);
        }
      }
    } catch (error) {
      console.error('Failed to refresh lights:', error);
    }
  }, [apiCall]);

  const discoverLights = useCallback(async (subnet?: string) => {
    try {
      const result = await apiCall('/api/discover', 'POST', { 
        subnet: subnet || networkInfo?.primaryBroadcast,
        timeout: 5000 
      });
      if (result.success) {
        setDiscoveredLights(result.lights);
        return result;
      }
    } catch (error) {
      console.error('Failed to discover lights:', error);
      throw error;
    }
  }, [apiCall, networkInfo]);

  const connectLight = useCallback(async (ip: string) => {
    try {
      const result = await apiCall(`/api/lights/${ip}/connect`, 'POST');
      if (result.success) {
        setConnectedLights(prev => {
          if (!prev.includes(ip)) {
            return [...prev, ip];
          }
          return prev;
        });
        setLightStates(prev => ({ 
          ...prev, 
          [ip]: result.state !== undefined ? result.state : false 
        }));
      }
      return result;
    } catch (error) {
      console.error(`Failed to connect to light ${ip}:`, error);
      throw error;
    }
  }, [apiCall]);

  const toggleLight = useCallback(async (ip: string) => {
    try {
      const currentState = lightStates[ip];
      const endpoint = currentState ? 'off' : 'on';
      const result = await apiCall(`/api/lights/${ip}/${endpoint}`, 'POST');
      if (result.success) {
        setLightStates(prev => ({ ...prev, [ip]: !currentState }));
      }
      return result;
    } catch (error) {
      console.error(`Failed to toggle light ${ip}:`, error);
      throw error;
    }
  }, [apiCall, lightStates]);

  return (
    <div className="app">
      <WebSocketStatus isConnected={isConnected} />
      
      <div className="container">
        <div className="logo-container">
          <img src="/thor.png" alt="Thor Logo" className="logo" />
          <h1>Thor: WiZ Lights Controller</h1>
        </div>
        
        <DiscoverySection 
          discoveredLights={discoveredLights}
          connectedLights={connectedLights}
          lightStates={lightStates}
          networkInfo={networkInfo}
          onDiscover={discoverLights}
          onConnect={connectLight}
          onToggle={toggleLight}
          onRefresh={refreshLights}
          onTestSingleIP={async (ip: string) => {
            const result = await apiCall(`/api/test/${ip}`, 'POST');
            return result;
          }}
        />
        
        <LightControlSection 
          connectedLights={connectedLights}
          lightStates={lightStates}
          onToggleAll={async (state: boolean) => {
            const endpoint = state ? 'on' : 'off';
            const result = await apiCall(`/api/lights/all/${endpoint}`, 'POST');
            if (result.success) {
              const newStates: { [ip: string]: boolean } = {};
              connectedLights.forEach(ip => {
                newStates[ip] = state;
              });
              setLightStates(prev => ({ ...prev, ...newStates }));
            }
            return result;
          }}
          onSetColor={async (r: number, g: number, b: number, brightness: number) => {
            const promises = connectedLights.map(ip => 
              apiCall(`/api/lights/${ip}/color`, 'POST', { r, g, b, brightness })
            );
            await Promise.all(promises);
          }}
          onSetBrightness={async (brightness: number) => {
            const promises = connectedLights.map(ip => 
              apiCall(`/api/lights/${ip}/brightness`, 'POST', { brightness })
            );
            await Promise.all(promises);
          }}
          onSetTemperature={async (temperature: number) => {
            const promises = connectedLights.map(ip => 
              apiCall(`/api/lights/${ip}/temperature`, 'POST', { temperature })
            );
            await Promise.all(promises);
          }}
        />
        
        <RhythmControlSection 
          connectedLights={connectedLights}
          rhythmStatus={rhythmStatus}
          onSetupRhythm={async () => {
            const result = await apiCall('/api/rhythm/setup', 'POST', { lights: connectedLights });
            if (result.success) {
              await loadRhythmStatus();
            }
            return result;
          }}
          onStartEffect={async (effect: string, bpm: number) => {
            const result = await apiCall('/api/rhythm/start', 'POST', { effect, bpm });
            if (result.success) {
              await loadRhythmStatus();
            }
            return result;
          }}
          onStopRhythm={async () => {
            const result = await apiCall('/api/rhythm/stop', 'POST');
            if (result.success) {
              await loadRhythmStatus();
            }
            return result;
          }}
          onSetBPM={async (bpm: number) => {
            const result = await apiCall('/api/rhythm/bpm', 'POST', { bpm });
            if (result.success) {
              await loadRhythmStatus();
            }
            return result;
          }}
          onTriggerBeat={async () => {
            return await apiCall('/api/rhythm/beat', 'POST', { intensity: 1 });
          }}
        />
      </div>
    </div>
  );
}

export default App;
