import React from 'react';
import { IoTDeviceType, DeviceProperties } from '../types';

interface RoomColorControlProps {
  room: {
    id: string;
    devices: Array<{
      type: string;
      ip: string;
    }>;
  };
  onPropertyChange: (ip: string, updates: DeviceProperties) => void;
  getDeviceState: (ip: string) => {
    brightness: number;
    temperature?: number;
    color?: { h: number; s: number; v: number };
    state: boolean;
    pendingUpdates: Record<string, any>;
    lastUpdateTime: number;
  };
  onClose: () => void;
}

export const RoomColorControl: React.FC<RoomColorControlProps> = ({
  room,
  onPropertyChange,
  getDeviceState,
  onClose
}) => {
  const deviceIps = room.devices.filter(d => d.type === IoTDeviceType.WIZ_LIGHT).map(d => d.ip);

  // Convert RGB to HSV helper function
  const rgbToHsv = (r: number, g: number, b: number) => {
    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;
    
    const max = Math.max(rNorm, gNorm, bNorm);
    const min = Math.min(rNorm, gNorm, bNorm);
    const delta = max - min;
    
    let h = 0;
    if (delta !== 0) {
      if (max === rNorm) {
        h = ((gNorm - bNorm) / delta) % 6;
      } else if (max === gNorm) {
        h = (bNorm - rNorm) / delta + 2;
      } else {
        h = (rNorm - gNorm) / delta + 4;
      }
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
    
    const s = max === 0 ? 0 : delta / max;
    const v = max;
    
    return { h, s, v };
  };

  const handleCustomColorChange = (hex: string) => {
    // Convert hex to RGB
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    
    const hsv = rgbToHsv(r, g, b);
    
    deviceIps.forEach(ip => {
      const currentState = getDeviceState(ip);
      onPropertyChange(ip, { 
        color: { r, g, b, h: hsv.h, s: hsv.s, v: hsv.v },
        brightness: currentState.brightness
      } as DeviceProperties);
    });
  };

  const handleBrightnessChange = (brightness: number) => {
    deviceIps.forEach(ip => {
      const currentState = getDeviceState(ip);
      if (currentState.color) {
        // Convert HSV to RGB for API call
        const hsvToRgb = (h: number, s: number, v: number) => {
          const c = v * s;
          const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
          const m = v - c;
          
          let r = 0, g = 0, b = 0;
          
          if (h >= 0 && h < 60) {
            r = c; g = x; b = 0;
          } else if (h >= 60 && h < 120) {
            r = x; g = c; b = 0;
          } else if (h >= 120 && h < 180) {
            r = 0; g = c; b = x;
          } else if (h >= 180 && h < 240) {
            r = 0; g = x; b = c;
          } else if (h >= 240 && h < 300) {
            r = x; g = 0; b = c;
          } else if (h >= 300 && h < 360) {
            r = c; g = 0; b = x;
          }
          
          return {
            r: Math.round((r + m) * 255),
            g: Math.round((g + m) * 255),
            b: Math.round((b + m) * 255)
          };
        };
        
        const rgb = hsvToRgb(currentState.color.h, currentState.color.s, currentState.color.v);
        onPropertyChange(ip, {
          color: { ...rgb, h: currentState.color.h, s: currentState.color.s, v: currentState.color.v },
          brightness
        } as DeviceProperties);
      }
    });
  };

  const handlePresetColor = (preset: { r: number; g: number; b: number }) => {
    const hsv = rgbToHsv(preset.r, preset.g, preset.b);
    
    deviceIps.forEach(ip => {
      const currentState = getDeviceState(ip);
      onPropertyChange(ip, { 
        color: { r: preset.r, g: preset.g, b: preset.b, h: hsv.h, s: hsv.s, v: hsv.v },
        brightness: currentState.brightness
      } as DeviceProperties);
    });
    onClose();
  };

  return (
    <div className="absolute top-full mt-2 right-0 bg-gray-800 border border-gray-600 rounded-lg p-4 z-10 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
      <h5 className="text-white text-sm font-medium mb-4">Set Room Color</h5>
      
      {/* Color Picker Bar */}
      <div className="mb-4">
        <label className="block text-white text-xs mb-2">Custom Color:</label>
        <input
          type="color"
          defaultValue="#ffffff"
          onChange={(e) => handleCustomColorChange(e.target.value)}
          className="w-full h-8 rounded border border-white/20 bg-transparent cursor-pointer"
        />
      </div>
      
      {/* Brightness Control */}
      <div className="mb-4">
        <label className="block text-white text-xs mb-2">Brightness:</label>
        <input
          type="range"
          min="1"
          max="100"
          defaultValue="80"
          onChange={(e) => handleBrightnessChange(parseInt(e.target.value))}
          className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider:bg-purple-500"
          style={{
            background: 'linear-gradient(to right, #374151 0%, #8b5cf6 50%, #a855f7 100%)'
          }}
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>1%</span>
          <span>100%</span>
        </div>
      </div>
      
      {/* Preset Colors */}
      <div className="mb-4">
        <label className="block text-white text-xs mb-2">Quick Presets:</label>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex justify-between">
          {[
            { name: 'Red', r: 255, g: 0, b: 0, color: 'bg-red-500' },
            { name: 'Green', r: 0, g: 255, b: 0, color: 'bg-green-500' },
            { name: 'Blue', r: 0, g: 0, b: 255, color: 'bg-blue-500' }
          ].map(preset => (
            <button
              key={preset.name}
              onClick={() => handlePresetColor(preset)}
              className={`${preset.color} hover:opacity-80 w-8 h-8 rounded border-2 border-white/20 transition-opacity`}
              title={preset.name}
            />
          ))}
        </div>
        <div className="flex justify-between">
          {[
            { name: 'White', r: 255, g: 255, b: 255, color: 'bg-white' },
            { name: 'Yellow', r: 255, g: 255, b: 0, color: 'bg-yellow-500' },
            { name: 'Purple', r: 128, g: 0, b: 128, color: 'bg-purple-500' }
          ].map(preset => (
            <button
              key={preset.name}
              onClick={() => handlePresetColor(preset)}
              className={`${preset.color} hover:opacity-80 w-8 h-8 rounded border-2 border-white/20 transition-opacity`}
              title={preset.name}
            />
          ))}
        </div>
      </div>
    </div>
  );
};