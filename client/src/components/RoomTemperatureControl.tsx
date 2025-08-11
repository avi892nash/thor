import React from 'react';
import { IoTDeviceType, DeviceProperties } from '../types';

interface RoomTemperatureControlProps {
  room: {
    id: string;
    devices: Array<{
      type: string;
      ip: string;
    }>;
  };
  onPropertyChange: (ip: string, updates: DeviceProperties) => void;
  onClose: () => void;
}

export const RoomTemperatureControl: React.FC<RoomTemperatureControlProps> = ({
  room,
  onPropertyChange,
  onClose
}) => {
  const deviceIps = room.devices.filter(d => d.type === IoTDeviceType.WIZ_LIGHT).map(d => d.ip);

  const handleTemperatureChange = (temperature: number) => {
    deviceIps.forEach(ip => {
      onPropertyChange(ip, { temperature });
    });
    onClose();
  };

  return (
    <div className="absolute top-full mt-2 right-0 bg-gray-800 border border-gray-600 rounded-lg p-4 z-10 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
      <h5 className="text-white text-sm font-medium mb-4">Set Room Temperature</h5>
      <div className="grid grid-cols-2 gap-2">
        {[
          { temp: 2200, label: 'Warm' },
          { temp: 3000, label: 'Soft' },
          { temp: 4000, label: 'Natural' },
          { temp: 6500, label: 'Cool' }
        ].map(({ temp, label }) => (
          <button
            key={temp}
            onClick={() => handleTemperatureChange(temp)}
            className="bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 rounded text-xs font-medium transition-colors"
          >
            {label}<br/>{temp}K
          </button>
        ))}
      </div>
    </div>
  );
};