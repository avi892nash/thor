import React, { useState, useEffect, useCallback } from 'react';
import { Light, IoTDevice, IoTDeviceType, Room, DeviceState, DeviceProperties, NetworkInfo } from '../types';
import { DeviceControls } from './DeviceControls';
import { RoomColorControl } from './RoomColorControl';
import { RoomTemperatureControl } from './RoomTemperatureControl';
import { apiService } from '../services/apiService';

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

  const loadNetworkInfo = useCallback(async () => {
    try {
      const result = await apiService.discovery.getNetworkInfo();
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
  }, []);

  const discoverLights = useCallback(async (subnet?: string) => {
    try {
      const result = await apiService.discovery.discoverLights(
        subnet || networkInfo?.primaryBroadcast,
        5000
      );
      if (result.success && result.lights) {
        setDiscoveredLights(result.lights);
        return result;
      }
    } catch (error) {
      console.error('Failed to discover lights:', error);
      throw error;
    }
  }, [networkInfo]);

  useEffect(() => {
    loadRooms();
    loadNetworkInfo();
  }, [loadNetworkInfo]);

  // Simplified device state initialization
  const initializeDeviceStates = (rooms: Room[]) => {
    const initialStates: {[key: string]: DeviceState} = {};
    rooms.forEach(room => {
      room.devices.forEach(device => {
        initialStates[device.ip] = {
          brightness: 100,
          state: device.state || false,
          pendingUpdates: {},
          lastUpdateTime: 0
        };
      });
    });
    setDeviceStates(initialStates);
  };

  const loadRooms = async () => {
    try {
      const data = await apiService.rooms.getRooms();
      console.log('Raw rooms data:', data);
      const rooms = (data.rooms || []).map((room: any) => {
        const devices = room.devices || [];
        console.log(`Room ${room.name}: ${devices.length} devices`);
        return {
          ...room,
          devices: devices
        };
      });
      setRooms(rooms);
      initializeDeviceStates(rooms);
    } catch (error) {
      console.error('Failed to load rooms:', error);
      setRooms([]);
    }
  };

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

  const addDevicesToRoom = (roomId: string, deviceIds: string[]) => {
    const devicesToAdd: IoTDevice[] = deviceIds
      .map(deviceId => {
        const light = discoveredLights.find(l => l.ip === deviceId);
        if (light) {
          return {
            id: `${light.ip}-${Date.now()}`,
            type: IoTDeviceType.WIZ_LIGHT,
            ip: light.ip,
            port: light.port,
            mac: light.mac,
            name: light.name || light.ip,
            state: light.state,
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
        const existingDeviceIps = devices.map(d => d.ip);
        const newDevices = devicesToAdd.filter(device => !existingDeviceIps.includes(device.ip));
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

  const addManualDevice = (roomId: string) => {
    if (!deviceName.trim() || !deviceIp.trim()) return;

    const newDevice: IoTDevice = {
      id: `${deviceIp}-${Date.now()}`,
      type: IoTDeviceType.WIZ_LIGHT,
      ip: deviceIp.trim(),
      port: 38899,
      name: deviceName.trim(),
      state: false,
      properties: {}
    };

    const updatedRooms = rooms.map(room => {
      if (room.id === roomId) {
        const devices = room.devices || [];
        const deviceExists = devices.some(d => d.ip === newDevice.ip);
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

  const handleToggleSingleLight = async (ip: string) => {
    try {
      // Get current state and toggle it optimistically
      const currentState = getDeviceState(ip).state;
      const newState = !currentState;
      
      // Update local state immediately for responsive UI
      setDeviceStates(prev => ({
        ...prev,
        [ip]: { ...getDeviceState(ip), state: newState }
      }));
      
      await onToggleLight(ip);
      
      // If successful, remove from unresponsive list
      setUnresponsiveLights(prev => {
        const newSet = new Set(prev);
        newSet.delete(ip);
        return newSet;
      });
    } catch (error) {
      console.error('Light toggle failed:', error);
      
      // Revert the optimistic update on failure
      const originalState = !getDeviceState(ip).state;
      setDeviceStates(prev => ({
        ...prev,
        [ip]: { ...getDeviceState(ip), state: originalState }
      }));
      
      // Add to unresponsive list
      setUnresponsiveLights(prev => new Set(prev).add(ip));
    }
  };

  // Simplified - removed for now
  
  const getDefaultDeviceState = (): DeviceState => ({
    brightness: 100,
    state: false,
    pendingUpdates: {},
    lastUpdateTime: 0
  });

  const handlePropertyChange = (ip: string, updates: DeviceProperties) => {
    console.log(`Property change for ${ip}:`, updates);
    
    // Update local state immediately for responsive UI
    setDeviceStates(prev => {
      const currentState = prev[ip] || getDefaultDeviceState();
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
          h: updates.color.h || 0,
          s: updates.color.s || 1,
          v: updates.color.v || 1
        };
        // Clear temperature when color is set (union type constraint)
        delete newState.temperature;
      }
      
      return { ...prev, [ip]: newState };
    });
    
    console.log(`Sending API call for ${ip}:`, updates);
    
    // Send API call directly with the provided updates
    apiService.lights.updateLightProperties(ip, updates)
      .then(() => console.log(`Success for ${ip}`))
      .catch(error => console.error(`Failed for ${ip}:`, error));
  };




  const getDeviceState = (ip: string): DeviceState => {
    return deviceStates[ip] || getDefaultDeviceState();
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
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input
                          type="text"
                          value={deviceName}
                          onChange={(e) => setDeviceName(e.target.value)}
                          placeholder="Device name"
                          className="bg-gray-600/50 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                        />
                        <input
                          type="text"
                          value={deviceIp}
                          onChange={(e) => setDeviceIp(e.target.value)}
                          placeholder="Device IP address"
                          className="bg-gray-600/50 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                        />
                        <button 
                          onClick={() => addManualDevice(room.id)}
                          disabled={!deviceName.trim() || !deviceIp.trim()}
                          className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
                        >
                          Add Manual Device
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
                            {discoveredLights.map(light => {
                              const existingDeviceIps = rooms.find(r => r.id === room.id)?.devices?.map(d => d.ip) || [];
                              const isAlreadyAdded = existingDeviceIps.includes(light.ip);
                              
                              return (
                                <div key={light.ip} className={`flex items-center gap-3 p-3 rounded-lg ${isAlreadyAdded ? 'bg-gray-600/30 border border-gray-500/30' : 'bg-gray-600/50 border border-white/20 hover:bg-gray-600/70'}`}>
                                  <input
                                    type="checkbox"
                                    id={`device-${light.ip}`}
                                    checked={isAlreadyAdded || selectedDevices.includes(light.ip)}
                                    disabled={isAlreadyAdded}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedDevices([...selectedDevices, light.ip]);
                                      } else {
                                        setSelectedDevices(selectedDevices.filter(ip => ip !== light.ip));
                                      }
                                    }}
                                    className={`rounded ${isAlreadyAdded ? 'opacity-50' : ''}`}
                                  />
                                  <label htmlFor={`device-${light.ip}`} className={`flex-1 cursor-pointer ${isAlreadyAdded ? 'opacity-50' : ''}`}>
                                    <div className="text-white">
                                      <div className="flex items-center gap-2">
                                        <strong>{light.name || light.ip}</strong>
                                        {isAlreadyAdded && <span className="bg-green-500 text-white text-xs px-2 py-1 rounded">Added</span>}
                                      </div>
                                      <div className="text-sm text-gray-300">
                                        IP: {light.ip}
                                        {light.mac && <><br />MAC: {light.mac}</>}
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
                        const isUnresponsive = unresponsiveLights.has(device.ip);
                        return (
                          <div key={device.id} className={`bg-gray-700/50 border border-white/10 rounded-lg p-4 ${isUnresponsive ? 'opacity-50' : ''}`} onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-between items-start mb-4">
                              <div className="text-white">
                                <h5 className="font-medium text-lg">{device.name}</h5>
                                <p className="text-gray-300 text-sm">IP: {device.ip}</p>
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
                                deviceState={getDeviceState(device.ip)}
                                onToggle={() => handleToggleSingleLight(device.ip)}
                                onPropertyChange={(updates) => handlePropertyChange(device.ip, updates)}
                                isUnresponsive={isUnresponsive}
                              />
                            )}
                            
                            {isUnresponsive && (
                              <div className="text-center py-4">
                                <p className="text-red-400 mb-2">Device unresponsive</p>
                                <button 
                                  onClick={() => handleToggleSingleLight(device.ip)}
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