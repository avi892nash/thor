import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Light, IoTDevice, IoTDeviceType, Room, DeviceState, DeviceProperties, NetworkInfo } from '../types';
import { DeviceControls } from './DeviceControls';
import { RoomColorControl } from './RoomColorControl';
import { RoomTemperatureControl } from './RoomTemperatureControl';
import { apiService, LightStatus } from '../services/apiService';

const POLLING_INTERVAL = 5000; // Poll every 5 seconds

interface RoomManagerProps {
  onToggleLight: (ip: string) => Promise<any>;
  onToggleAllLights: (ips: string[], state: boolean) => Promise<any>;
}

export const RoomManager: React.FC<RoomManagerProps> = ({ 
  onToggleLight,
  onToggleAllLights
}) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [showAddDeviceForm, setShowAddDeviceForm] = useState<string>('');
  const [deviceName, setDeviceName] = useState<string>('');
  const [deviceIp, setDeviceIp] = useState<string>('');
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [expandedRoom, setExpandedRoom] = useState<string>('');
  const [deviceStates, setDeviceStates] = useState<{[key: string]: DeviceState}>({});
  const [discoveredLights, setDiscoveredLights] = useState<Light[]>([]);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [activeRoomControl, setActiveRoomControl] = useState<{roomId: string, type: 'temperature' | 'color'} | null>(null);

  const discoverLights = useCallback(async (subnet?: string) => {
    try {
      const result = await apiService.discovery.discoverLights(
        subnet || networkInfo?.primaryBroadcast,
        5000
      );
      if (result.success && result.lights) {
        setDiscoveredLights(result.lights);

        // If a known device (same MAC) has a new IP, update it in rooms and persist
        setRooms(prevRooms => {
          let changed = false;
          const updatedRooms = prevRooms.map(room => ({
            ...room,
            devices: room.devices.map(device => {
              const match = result.lights.find(
                (l: Light) => l.mac && l.mac === device.mac && l.ip !== device.ip
              );
              if (match) {
                changed = true;
                console.log(`IP changed for ${device.mac}: ${device.ip} → ${match.ip}`);
                return { ...device, ip: match.ip };
              }
              return device;
            })
          }));
          if (changed) {
            apiService.rooms.saveRooms(updatedRooms).catch(console.error);
            return updatedRooms;
          }
          return prevRooms;
        });

        return result;
      }
    } catch (error) {
      console.error('Failed to discover lights:', error);
      throw error;
    }
  }, [networkInfo]);

  useEffect(() => {
    let isMounted = true;

    const initializeData = async () => {
      try {
        const data = await apiService.rooms.getRooms();
        if (!isMounted) return;

        console.log('Raw rooms data:', data);
        const loadedRooms = (data.rooms || []).map((room: any) => {
          const devices = room.devices || [];
          console.log(`Room ${room.name}: ${devices.length} devices`);
          return {
            ...room,
            devices: devices
          };
        });
        setRooms(loadedRooms);
        initializeDeviceStates(loadedRooms);
      } catch (error) {
        console.error('Failed to load rooms:', error);
        if (isMounted) {
          setRooms([]);
        }
      }

      // Load network info
      try {
        const result = await apiService.discovery.getNetworkInfo();
        if (!isMounted) return;

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
    };

    initializeData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Device state initialization - keyed by MAC address
  const initializeDeviceStates = (rooms: Room[]) => {
    const initialStates: {[mac: string]: DeviceState} = {};
    rooms.forEach(room => {
      room.devices.forEach(device => {
        if (device.mac) {
          initialStates[device.mac] = {
            brightness: 100,
            state: device.state || false,
            pendingUpdates: {},
            lastUpdateTime: 0
          };
        }
      });
    });
    setDeviceStates(initialStates);
  };

  // Ref to track if we're currently polling (prevent overlapping polls)
  const isPollingRef = useRef(false);

  // Poll light status periodically
  const pollLightStatus = useCallback(async () => {
    if (isPollingRef.current || rooms.length === 0) return;

    isPollingRef.current = true;

    try {
      // Get all device IPs and their MAC addresses
      const deviceMap: { ip: string; mac: string }[] = [];
      rooms.forEach(room => {
        room.devices.forEach(device => {
          if (device.type === IoTDeviceType.WIZ_LIGHT && device.ip && device.mac) {
            deviceMap.push({ ip: device.ip, mac: device.mac });
          }
        });
      });

      if (deviceMap.length === 0) return;

      const ips = deviceMap.map(d => d.ip);
      const response = await apiService.lights.getBatchStatus(ips);

      if (response.success && response.results) {
        const newUnresponsive = new Set<string>();

        setDeviceStates(prev => {
          const updated = { ...prev };

          response.results.forEach((status: LightStatus) => {
            // Find MAC for this IP
            const deviceInfo = deviceMap.find(d => d.ip === status.ip);
            if (!deviceInfo) return;

            const mac = deviceInfo.mac;

            if (status.success && !status.offline) {
              // Device is online - update state from actual device
              updated[mac] = {
                ...updated[mac],
                state: status.state ?? updated[mac]?.state ?? false,
                brightness: status.brightness ?? updated[mac]?.brightness ?? 100,
                temperature: status.temperature,
                sceneId: status.sceneId,
                pendingUpdates: {},
                lastUpdateTime: Date.now()
              };

              // If we have RGB values, convert to HSV and store
              if (status.r !== undefined && status.g !== undefined && status.b !== undefined) {
                const { h, s, v } = rgbToHsv(status.r, status.g, status.b);
                updated[mac].color = { h, s, v };
              }
            } else {
              // Device is offline
              newUnresponsive.add(mac);
            }
          });

          return updated;
        });

        setUnresponsiveLights(newUnresponsive);
      }
    } catch (error) {
      console.error('Polling failed:', error);
    } finally {
      isPollingRef.current = false;
    }
  }, [rooms]);

  // RGB to HSV helper for polling
  const rgbToHsv = (r: number, g: number, b: number) => {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    let h = 0;
    if (delta !== 0) {
      if (max === r) h = ((g - b) / delta) % 6;
      else if (max === g) h = (b - r) / delta + 2;
      else h = (r - g) / delta + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
    const s = max === 0 ? 0 : delta / max;
    const v = max;
    return { h, s, v };
  };

  // Start polling when rooms are loaded
  useEffect(() => {
    if (rooms.length === 0) return;

    // Initial poll
    pollLightStatus();

    // Set up interval
    const intervalId = setInterval(pollLightStatus, POLLING_INTERVAL);

    return () => clearInterval(intervalId);
  }, [rooms, pollLightStatus]);

  const saveRooms = async (updatedRooms: Room[]) => {
    try {
      await apiService.rooms.saveRooms(updatedRooms);
      setRooms(updatedRooms);
    } catch (error) {
      console.error('Failed to save rooms:', error);
    }
  };

  const createRoom = () => {
    if (!newRoomName.trim()) return;

    const newRoom: Room = {
      id: Date.now().toString(),
      name: newRoomName.trim(),
      devices: []
    };

    const updatedRooms = [...rooms, newRoom];
    saveRooms(updatedRooms);
    setNewRoomName('');
  };

  const addDevicesToRoom = (roomId: string, deviceMacs: string[]) => {
    const devicesToAdd: IoTDevice[] = deviceMacs
      .map(mac => {
        const light = discoveredLights.find(l => l.mac === mac);
        if (light && light.mac) {
          return {
            id: light.mac,  // Use MAC as device ID
            type: IoTDeviceType.WIZ_LIGHT,
            mac: light.mac,
            ip: light.ip,
            port: light.port,
            name: light.name || `Bulb ${light.mac.slice(-4)}`,
            state: light.state ?? false,
            properties: light.temperature ? {
              temperature: light.temperature
            } : (light.r !== undefined && light.g !== undefined && light.b !== undefined && light.brightness) ? {
              color: {
                r: light.r,
                g: light.g,
                b: light.b
              },
              brightness: light.brightness
            } : {}
          };
        }
        return null;
      })
      .filter(device => device !== null) as IoTDevice[];

    const updatedRooms = rooms.map(room => {
      if (room.id === roomId) {
        const devices = room.devices || [];
        const existingDeviceMacs = devices.map(d => d.mac);
        const newDevices = devicesToAdd.filter(device => !existingDeviceMacs.includes(device.mac));
        return {
          ...room,
          devices: [...devices, ...newDevices]
        };
      }
      return room;
    });

    saveRooms(updatedRooms);
    setShowAddDeviceForm('');
    setSelectedDevices([]);
  };

  const [deviceMac, setDeviceMac] = useState<string>('');

  const addManualDevice = (roomId: string) => {
    if (!deviceName.trim() || !deviceIp.trim() || !deviceMac.trim()) return;

    const mac = deviceMac.trim().toLowerCase().replace(/[:-]/g, '');

    const newDevice: IoTDevice = {
      id: mac,  // Use MAC as device ID
      type: IoTDeviceType.WIZ_LIGHT,
      mac: mac,
      ip: deviceIp.trim(),
      port: 38899,
      name: deviceName.trim(),
      state: false,
      properties: {}
    };

    const updatedRooms = rooms.map(room => {
      if (room.id === roomId) {
        const devices = room.devices || [];
        const deviceExists = devices.some(d => d.mac === newDevice.mac);
        if (!deviceExists) {
          return {
            ...room,
            devices: [...devices, newDevice]
          };
        }
      }
      return room;
    });

    saveRooms(updatedRooms);
    setDeviceName('');
    setDeviceIp('');
    setDeviceMac('');
    setShowAddDeviceForm('');
  };

  const removeDeviceFromRoom = (roomId: string, deviceId: string) => {
    const updatedRooms = rooms.map(room => {
      if (room.id === roomId) {
        return {
          ...room,
          devices: (room.devices || []).filter(d => d.id !== deviceId)
        };
      }
      return room;
    });

    saveRooms(updatedRooms);
  };

  const deleteRoom = (roomId: string) => {
    const updatedRooms = rooms.filter(room => room.id !== roomId);
    saveRooms(updatedRooms);
  };

  const handleDiscover = async () => {
    setIsDiscovering(true);
    try {
      await discoverLights();
    } catch (error) {
      console.error('Discovery failed:', error);
    } finally {
      setIsDiscovering(false);
    }
  };


  const handleToggleRoom = async (room: Room, turnOn: boolean) => {
    const devices = room.devices || [];
    const deviceIps = devices.filter(d => d.type === IoTDeviceType.WIZ_LIGHT).map(d => d.ip);
    try {
      await onToggleAllLights(deviceIps, turnOn);
    } catch (error) {
      console.error('Room toggle failed:', error);
    }
  };

  const [unresponsiveLights, setUnresponsiveLights] = useState<Set<string>>(new Set());

  // Toggle light using MAC for state, IP for API
  const handleToggleSingleLight = async (mac: string, ip: string) => {
    // Capture original state BEFORE optimistic update
    const originalState = getDeviceState(mac).state;
    const newState = !originalState;

    try {
      // Update local state immediately for responsive UI (keyed by MAC)
      setDeviceStates(prev => ({
        ...prev,
        [mac]: { ...prev[mac] || getDefaultDeviceState(), state: newState }
      }));

      // API call uses IP address
      await onToggleLight(ip);

      // If successful, remove from unresponsive list
      setUnresponsiveLights(prev => {
        const newSet = new Set(prev);
        newSet.delete(mac);
        return newSet;
      });
    } catch (error) {
      console.error('Light toggle failed:', error);

      // Revert to the captured original state on failure
      setDeviceStates(prev => ({
        ...prev,
        [mac]: { ...prev[mac] || getDefaultDeviceState(), state: originalState }
      }));

      // Add to unresponsive list (keyed by MAC)
      setUnresponsiveLights(prev => new Set(prev).add(mac));
    }
  };

  // Simplified - removed for now
  
  const getDefaultDeviceState = (): DeviceState => ({
    brightness: 100,
    state: false,
    pendingUpdates: {},
    lastUpdateTime: 0
  });

  // Update properties using MAC for state, IP for API
  const handlePropertyChange = (mac: string, ip: string, updates: DeviceProperties) => {
    console.log(`Property change for ${mac} (${ip}):`, updates);

    // Capture original state for rollback
    const originalState = deviceStates[mac] || getDefaultDeviceState();

    // Update local state immediately for responsive UI (keyed by MAC)
    setDeviceStates(prev => {
      const currentState = prev[mac] || getDefaultDeviceState();
      const newState = { ...currentState };

      // Update the state based on the properties - deviceState is source of truth
      if (updates.brightness !== undefined) {
        newState.brightness = updates.brightness;
      }
      if (updates.temperature !== undefined) {
        newState.temperature = updates.temperature;
        // Clear color when temperature is set (union type constraint)
        delete newState.color;
      }
      if (updates.color) {
        newState.color = {
          h: updates.color.h ?? 0,
          s: updates.color.s ?? 1,
          v: updates.color.v ?? 1
        };
        // Clear temperature and scene when color is set
        delete newState.temperature;
        delete newState.sceneId;
      }
      if (updates.sceneId !== undefined) {
        newState.sceneId = updates.sceneId;
        newState.state = true; // Scene selection turns the light ON
        if (updates.speed !== undefined) {
          newState.speed = updates.speed;
        }
        // Clear color and temperature when scene is set
        delete newState.color;
        delete newState.temperature;
      }

      return { ...prev, [mac]: newState };
    });

    console.log(`Sending API call to ${ip}:`, updates);

    // Send API call using IP address
    apiService.lights.updateLightProperties(ip, updates)
      .then(() => console.log(`Success for ${mac}`))
      .catch(error => {
        console.error(`Failed for ${mac}:`, error);
        // Rollback to original state on failure
        setDeviceStates(prev => ({
          ...prev,
          [mac]: originalState
        }));
      });
  };




  const getDeviceState = (mac: string): DeviceState => {
    return deviceStates[mac] || getDefaultDeviceState();
  };


  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold text-white mb-8 text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">Smart Home Management</h2>
      
      <div className="bg-gray-800/50 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
        <h3 className="text-xl font-semibold text-white mb-4">Create New Room</h3>
        <div className="flex gap-4 items-end">
          <input
            type="text"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            placeholder="Enter room name"
            onKeyDown={(e) => e.key === 'Enter' && createRoom()}
            className="flex-1 bg-gray-700/50 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <button 
            onClick={createRoom} 
            disabled={!newRoomName.trim()}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-all duration-200"
          >
            Create Room
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-white mb-4">Your Rooms</h3>
        {rooms.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No rooms created yet. Create your first room above!</p>
        ) : (
          rooms.map(room => (
            <div 
              key={room.id} 
              className="bg-gray-800/50 border border-white/10 rounded-xl p-4 cursor-pointer hover:bg-gray-800/70 transition-all duration-200"
              onClick={() => setExpandedRoom(expandedRoom === room.id ? '' : room.id)}
            >
              <div className="flex justify-between items-center">
                <h4 className="text-lg font-medium text-white">
                  {room.name} ({(room.devices || []).length} devices)
                </h4>
                <div className="flex gap-2">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAddDeviceForm(showAddDeviceForm === room.id ? '' : room.id);
                    }}
                    className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg transition-colors duration-200"
                    title="Add IoT Device"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                  </button>
                  {(room.devices || []).length > 0 && (
                    <>
                      {/* Temperature Control */}
                      <div className="relative">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveRoomControl(
                              activeRoomControl?.roomId === room.id && activeRoomControl?.type === 'temperature' 
                                ? null 
                                : { roomId: room.id, type: 'temperature' }
                            );
                          }}
                          className="bg-gray-500 hover:bg-gray-600 text-white p-2 rounded-lg transition-colors duration-200"
                          title="Room Temperature Control"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M15 13V5c0-1.66-1.34-3-3-3S9 3.34 9 5v8c-1.21.91-2 2.37-2 4 0 2.76 2.24 5 5 5s5-2.24 5-5c0-1.63-.79-3.09-2-4zm-4-2V5c0-.55.45-1 1-1s1 .45 1 1v6h-2z"/>
                          </svg>
                        </button>
                        {activeRoomControl?.roomId === room.id && activeRoomControl?.type === 'temperature' && (
                          <RoomTemperatureControl
                            room={room}
                            onPropertyChange={handlePropertyChange}
                            onClose={() => setActiveRoomControl(null)}
                          />
                        )}
                      </div>
                      
                      {/* Color Control */}
                      <div className="relative">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveRoomControl(
                              activeRoomControl?.roomId === room.id && activeRoomControl?.type === 'color' 
                                ? null 
                                : { roomId: room.id, type: 'color' }
                            );
                          }}
                          className="bg-gray-500 hover:bg-gray-600 text-white p-2 rounded-lg transition-colors duration-200"
                          title="Room Color Control"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                          </svg>
                        </button>
                        {activeRoomControl?.roomId === room.id && activeRoomControl?.type === 'color' && (
                          <RoomColorControl
                            room={room}
                            onPropertyChange={handlePropertyChange}
                            getDeviceState={getDeviceState}
                            onClose={() => setActiveRoomControl(null)}
                          />
                        )}
                      </div>
                      
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleRoom(room, true);
                        }} 
                        className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg transition-colors duration-200"
                        title="Turn All On"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/>
                        </svg>
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleRoom(room, false);
                        }}
                        className="bg-gray-500 hover:bg-gray-600 text-white p-2 rounded-lg transition-colors duration-200"
                        title="Turn All Off"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2 11.7V16H10v-2.3C9.12 13.35 8.5 12.22 8.5 11c0-1.93 1.57-3.5 3.5-3.5s3.5 1.57 3.5 3.5c0 1.22-.62 2.35-1.5 2.7z"/>
                          <path d="M0 0h24v24H0z" fill="none"/>
                          <path d="M2 2l20 20-1.41 1.41L2 4.41z" stroke="currentColor" strokeWidth="1.5"/>
                        </svg>
                      </button>
                    </>
                  )}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteRoom(room.id);
                    }} 
                    className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition-colors duration-200"
                    title="Delete Room"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                  </button>
                </div>
              </div>

              {showAddDeviceForm === room.id && (
                <div className="mt-4 p-4 bg-gray-700/50 border border-white/10 rounded-lg" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                  <h4 className="text-lg font-medium text-white mb-4">Add IoT Devices to {room.name}</h4>
                  
                  <div className="space-y-4">
                    <div>
                      <h5 className="text-md font-medium text-white mb-2">Manual Entry</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <input
                          type="text"
                          value={deviceName}
                          onChange={(e) => setDeviceName(e.target.value)}
                          placeholder="Device name"
                          className="bg-gray-600/50 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                        />
                        <input
                          type="text"
                          value={deviceMac}
                          onChange={(e) => setDeviceMac(e.target.value)}
                          placeholder="MAC address (e.g., cc4085620d6e)"
                          className="bg-gray-600/50 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 font-mono"
                        />
                        <input
                          type="text"
                          value={deviceIp}
                          onChange={(e) => setDeviceIp(e.target.value)}
                          placeholder="IP address"
                          className="bg-gray-600/50 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                        />
                        <button
                          onClick={() => addManualDevice(room.id)}
                          disabled={!deviceName.trim() || !deviceIp.trim() || !deviceMac.trim()}
                          className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
                        >
                          Add Device
                        </button>
                      </div>
                    </div>

                    <div>
                      <h5 className="text-md font-medium text-white mb-2">Discovered Devices</h5>
                      <div className="mb-4">
                        <button 
                          onClick={handleDiscover} 
                          disabled={isDiscovering}
                          className="bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
                        >
                          {isDiscovering ? 'Discovering...' : 'Discover Devices'}
                        </button>
                      </div>
                      
                      {discoveredLights.length > 0 && (
                        <>
                          <div className="space-y-2 mb-4">
                            {discoveredLights.filter(l => l.mac).map(light => {
                              const existingDeviceMacs = rooms.find(r => r.id === room.id)?.devices?.map(d => d.mac) || [];
                              const isAlreadyAdded = light.mac ? existingDeviceMacs.includes(light.mac) : false;

                              return (
                                <div key={light.mac} className={`flex items-center gap-3 p-3 rounded-lg ${isAlreadyAdded ? 'bg-gray-600/30 border border-gray-500/30' : 'bg-gray-600/50 border border-white/20 hover:bg-gray-600/70'}`}>
                                  <input
                                    type="checkbox"
                                    id={`device-${light.mac}`}
                                    checked={isAlreadyAdded || (light.mac ? selectedDevices.includes(light.mac) : false)}
                                    disabled={isAlreadyAdded || !light.mac}
                                    onChange={(e) => {
                                      if (!light.mac) return;
                                      if (e.target.checked) {
                                        setSelectedDevices([...selectedDevices, light.mac]);
                                      } else {
                                        setSelectedDevices(selectedDevices.filter(mac => mac !== light.mac));
                                      }
                                    }}
                                    className={`rounded ${isAlreadyAdded ? 'opacity-50' : ''}`}
                                  />
                                  <label htmlFor={`device-${light.mac}`} className={`flex-1 cursor-pointer ${isAlreadyAdded ? 'opacity-50' : ''}`}>
                                    <div className="text-white">
                                      <div className="flex items-center gap-2">
                                        <strong>{light.name || `Bulb ${light.mac?.slice(-4)}`}</strong>
                                        {isAlreadyAdded && <span className="bg-green-500 text-white text-xs px-2 py-1 rounded">Added</span>}
                                      </div>
                                      <div className="text-sm text-gray-300">
                                        MAC: {light.mac}
                                        <br />
                                        IP: {light.ip}
                                        <br />
                                        Status: Connected
                                      </div>
                                    </div>
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex gap-3">
                            <button 
                              onClick={() => addDevicesToRoom(room.id, selectedDevices)}
                              disabled={selectedDevices.length === 0}
                              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
                            >
                              Add Selected Devices ({selectedDevices.length})
                            </button>
                            <button 
                              onClick={() => setShowAddDeviceForm('')}
                              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
                            >
                              Cancel
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {expandedRoom === room.id && (
                <div className="mt-4" onClick={(e) => e.stopPropagation()}>
                  {(room.devices || []).length === 0 ? (
                    <p className="text-gray-400 text-center py-4">No devices in this room</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {(room.devices || []).map(device => {
                        const isUnresponsive = unresponsiveLights.has(device.mac);
                        return (
                          <div key={device.id} className={`bg-gray-700/50 border border-white/10 rounded-lg p-4 ${isUnresponsive ? 'opacity-50' : ''}`} onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-between items-start mb-4">
                              <div className="text-white">
                                <h5 className="font-medium text-lg">{device.name}</h5>
                                <p className="text-gray-400 text-xs font-mono">MAC: {device.mac}</p>
                                <p className="text-gray-400 text-xs">IP: {device.ip}</p>
                                <span className="inline-block bg-green-500 text-white text-xs px-2 py-1 rounded mt-1">
                                  Connected
                                </span>
                              </div>
                              <button
                                onClick={() => removeDeviceFromRoom(room.id, device.id)}
                                className="bg-red-500 hover:bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm transition-colors duration-200"
                                title="Remove device"
                              >
                                ×
                              </button>
                            </div>

                            {device.type === IoTDeviceType.WIZ_LIGHT && (
                              <DeviceControls
                                deviceIp={device.ip}
                                deviceState={getDeviceState(device.mac)}
                                onToggle={() => handleToggleSingleLight(device.mac, device.ip)}
                                onPropertyChange={(updates) => handlePropertyChange(device.mac, device.ip, updates)}
                                isUnresponsive={isUnresponsive}
                              />
                            )}

                            {isUnresponsive && (
                              <div className="text-center py-4">
                                <p className="text-red-400 mb-2">Device unresponsive</p>
                                <button
                                  onClick={() => handleToggleSingleLight(device.mac, device.ip)}
                                  className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded text-sm transition-colors duration-200"
                                >
                                  Retry
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};