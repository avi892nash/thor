import React, { useState } from 'react';
import { DeviceState, DeviceProperties, WIZ_SCENES, DYNAMIC_SCENE_IDS } from '../types';
import { PowerControl } from './PowerControl';

// Temperature Panel Component (content only)
const TemperaturePanel: React.FC<{
  temperature: number;
  onPropertyChange: (updates: DeviceProperties) => void;
  isUnresponsive?: boolean;
}> = ({ temperature, onPropertyChange, isUnresponsive = false }) => {
  const handleTemperatureChange = (newTemperature: number) => {
    onPropertyChange({ temperature: newTemperature } as DeviceProperties);
  };

  return (
    <div className="bg-gray-800/50 border border-gray-600/30 rounded-xl p-4 w-full">
      <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/10">
        <span className="text-white/90 text-sm font-medium">Temperature Control</span>
        <span className="text-amber-400 text-sm font-medium">{temperature}K</span>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button 
          onClick={() => handleTemperatureChange(2200)}
          className={`flex flex-col items-center gap-1 p-3 px-2 bg-white/5 border border-white/10 rounded-md text-white/90 cursor-pointer transition-all duration-200 text-xs font-medium hover:bg-white/10 hover:border-white/20 ${temperature === 2200 ? 'bg-amber-500/20 border-amber-500/40' : ''}`}
          disabled={isUnresponsive}
        >
          Warm
          <span className="text-[10px] text-white/70">2200K</span>
        </button>
        <button 
          onClick={() => handleTemperatureChange(3000)}
          className={`flex flex-col items-center gap-1 p-3 px-2 bg-white/5 border border-white/10 rounded-md text-white/90 cursor-pointer transition-all duration-200 text-xs font-medium hover:bg-white/10 hover:border-white/20 ${temperature === 3000 ? 'bg-amber-500/20 border-amber-500/40' : ''}`}
          disabled={isUnresponsive}
        >
          Soft
          <span className="text-[10px] text-white/70">3000K</span>
        </button>
        <button 
          onClick={() => handleTemperatureChange(4000)}
          className={`flex flex-col items-center gap-1 p-3 px-2 bg-white/5 border border-white/10 rounded-md text-white/90 cursor-pointer transition-all duration-200 text-xs font-medium hover:bg-white/10 hover:border-white/20 ${temperature === 4000 ? 'bg-amber-500/20 border-amber-500/40' : ''}`}
          disabled={isUnresponsive}
        >
          Natural
          <span className="text-[10px] text-white/70">4000K</span>
        </button>
        <button 
          onClick={() => handleTemperatureChange(6500)}
          className={`flex flex-col items-center gap-1 p-3 px-2 bg-white/5 border border-white/10 rounded-md text-white/90 cursor-pointer transition-all duration-200 text-xs font-medium hover:bg-white/10 hover:border-white/20 ${temperature === 6500 ? 'bg-amber-500/20 border-amber-500/40' : ''}`}
          disabled={isUnresponsive}
        >
          Cool
          <span className="text-[10px] text-white/70">6500K</span>
        </button>
      </div>
      <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg p-3">
        <input 
          type="range" 
          min="2200" 
          max="6500" 
          value={temperature}
          onChange={(e) => handleTemperatureChange(parseInt(e.target.value))}
          className="flex-1 h-1.5 bg-white/10 rounded-full outline-none appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-amber-500 [&::-webkit-slider-thumb]:to-amber-600 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:duration-200 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white/20 [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:hover:shadow-xl bg-gradient-to-r from-amber-500 via-amber-400 to-blue-500"
          disabled={isUnresponsive}
        />
        <span className="text-white/80 text-sm font-medium">{temperature}K</span>
      </div>
    </div>
  );
};

// Scene Panel Component
const ScenePanel: React.FC<{
  deviceState: DeviceState;
  onPropertyChange: (updates: DeviceProperties) => void;
  isUnresponsive?: boolean;
}> = ({ deviceState, onPropertyChange, isUnresponsive = false }) => {
  const [speed, setSpeed] = useState(deviceState.speed || 100);

  const isDynamicScene = (sceneId: number) => DYNAMIC_SCENE_IDS.includes(sceneId);

  const handleSceneSelect = (sceneId: number) => {
    const props: DeviceProperties = {
      sceneId,
      brightness: deviceState.brightness
    };
    if (isDynamicScene(sceneId)) {
      props.speed = speed;
    }
    onPropertyChange(props);
  };

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    if (deviceState.sceneId && isDynamicScene(deviceState.sceneId)) {
      onPropertyChange({
        sceneId: deviceState.sceneId,
        speed: newSpeed,
        brightness: deviceState.brightness
      });
    }
  };

  const handleBrightnessChange = (brightness: number) => {
    if (deviceState.sceneId) {
      onPropertyChange({
        sceneId: deviceState.sceneId,
        speed: isDynamicScene(deviceState.sceneId) ? speed : undefined,
        brightness
      });
    } else {
      onPropertyChange({ brightness });
    }
  };

  // Popular scenes for quick access
  const popularScenes = [
    { id: 1000, name: 'Rhythm' },
    { id: 11, name: 'Warm white' },
    { id: 12, name: 'Daylight' },
    { id: 13, name: 'Cool white' },
    { id: 6, name: 'Cozy' },
    { id: 16, name: 'Relax' },
    { id: 15, name: 'Focus' },
    { id: 5, name: 'Fireplace' },
    { id: 1, name: 'Ocean' },
    { id: 4, name: 'Party' },
    { id: 2, name: 'Romance' },
    { id: 18, name: 'TV time' },
  ];

  const getSceneStyle = (sceneId: number) => {
    if (sceneId === 1000) return 'from-red-500 via-purple-500 to-blue-500 animate-pulse';
    if ([11, 12, 13, 14, 29, 30, 34].includes(sceneId)) return 'from-yellow-200 to-white';
    if ([5, 6, 16].includes(sceneId)) return 'from-orange-400 to-yellow-300';
    if ([1, 7, 20, 21, 22, 23, 24, 25].includes(sceneId)) return 'from-green-400 to-blue-400';
    if ([2, 3, 8].includes(sceneId)) return 'from-pink-400 to-purple-400';
    if ([4, 18, 26, 31].includes(sceneId)) return 'from-purple-500 to-pink-500';
    if ([15, 17].includes(sceneId)) return 'from-blue-400 to-indigo-500';
    return 'from-gray-400 to-gray-500';
  };

  return (
    <div className="bg-gray-800/50 border border-gray-600/30 rounded-xl p-4 w-full">
      <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/10">
        <span className="text-white/90 text-sm font-medium">Scene Selection</span>
        {deviceState.sceneId && (
          <span className="text-green-400 text-xs font-medium">
            {WIZ_SCENES[deviceState.sceneId] || `Scene ${deviceState.sceneId}`}
          </span>
        )}
      </div>

      {/* Scene Grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {popularScenes.map(scene => (
          <button
            key={scene.id}
            onClick={() => handleSceneSelect(scene.id)}
            disabled={isUnresponsive}
            className={`relative p-2 rounded-lg border-2 transition-all duration-200 bg-gradient-to-br ${getSceneStyle(scene.id)} ${
              deviceState.sceneId === scene.id
                ? 'border-green-500 ring-2 ring-green-500/30 scale-105'
                : 'border-transparent hover:border-white/30 hover:scale-102'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <span className="text-[10px] font-medium text-gray-900 drop-shadow-sm block truncate">
              {scene.name}
            </span>
            {scene.id === 1000 && (
              <span className="absolute top-0.5 right-0.5 text-[8px]" title="Music Sync">🎵</span>
            )}
            {isDynamicScene(scene.id) && scene.id !== 1000 && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-600 rounded-full" title="Dynamic" />
            )}
          </button>
        ))}
      </div>

      {/* Rhythm Mode Info */}
      {deviceState.sceneId === 1000 && (
        <div className="mb-4 p-3 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-white/90 text-xs">
            <span className="text-lg">🎵</span>
            <div>
              <p className="font-medium">Rhythm Mode Active</p>
              <p className="text-white/60 text-[10px]">Syncs to music via WiZ app microphone</p>
            </div>
          </div>
        </div>
      )}

      {/* Speed Control (for dynamic scenes) */}
      {deviceState.sceneId && isDynamicScene(deviceState.sceneId) && deviceState.sceneId !== 1000 && (
        <div className="mb-4 p-3 bg-white/5 border border-white/10 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <label className="text-white/80 text-xs font-medium">Animation Speed</label>
            <span className="text-blue-400 text-xs font-medium">{speed}%</span>
          </div>
          <input
            type="range"
            min="10"
            max="200"
            value={speed}
            onChange={(e) => handleSpeedChange(parseInt(e.target.value))}
            className="w-full h-1.5 bg-white/10 rounded-full outline-none appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:cursor-pointer"
            disabled={isUnresponsive}
          />
          <div className="flex justify-between text-[10px] text-white/50 mt-1">
            <span>Slow</span>
            <span>Fast</span>
          </div>
        </div>
      )}

      {/* Brightness Control */}
      <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <label className="text-white/80 text-xs font-medium">Brightness</label>
          <span className="text-yellow-400 text-xs font-medium">{deviceState.brightness}%</span>
        </div>
        <input
          type="range"
          min="10"
          max="100"
          value={deviceState.brightness}
          onChange={(e) => handleBrightnessChange(parseInt(e.target.value))}
          className="w-full h-1.5 bg-white/10 rounded-full outline-none appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-yellow-500 [&::-webkit-slider-thumb]:cursor-pointer"
          disabled={isUnresponsive}
        />
      </div>
    </div>
  );
};

// Color Panel Component (simplified)
const ColorPanel: React.FC<{
  deviceState: DeviceState;
  onPropertyChange: (updates: DeviceProperties) => void;
  isUnresponsive?: boolean;
}> = ({ deviceState, onPropertyChange, isUnresponsive = false }) => {
  // Convert HSV to RGB
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

  const rgbToHex = (r: number, g: number, b: number) => {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  };

  // Convert RGB to HSV
  const rgbToHsv = (r: number, g: number, b: number) => {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let h = 0;
    if (delta !== 0) {
      if (max === r) {
        h = ((g - b) / delta) % 6;
      } else if (max === g) {
        h = (b - r) / delta + 2;
      } else {
        h = (r - g) / delta + 4;
      }
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;

    const s = max === 0 ? 0 : delta / max;
    const v = max;

    return { h, s, v };
  };

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
  };

  // Get current color as hex from HSV (default to white if no color)
  const color = deviceState.color || { h: 0, s: 0, v: 1 };
  const currentRgb = hsvToRgb(color.h, color.s, color.v);
  const currentColor = rgbToHex(currentRgb.r, currentRgb.g, currentRgb.b);

  const handleColorChange = (hex: string) => {
    const rgb = hexToRgb(hex);
    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    onPropertyChange({ 
      color: { r: rgb.r, g: rgb.g, b: rgb.b, h: hsv.h, s: hsv.s, v: hsv.v },
      brightness: deviceState.brightness
    } as DeviceProperties);
  };

  const handleBrightnessChange = (brightness: number) => {
    onPropertyChange({ 
      color: { 
        r: currentRgb.r, 
        g: currentRgb.g, 
        b: currentRgb.b,
        h: color.h,
        s: color.s,
        v: color.v
      },
      brightness 
    } as DeviceProperties);
  };

  return (
    <div className="bg-gray-800/50 border border-gray-600/30 rounded-xl p-4 w-full">
      <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/10">
        <span className="text-white/90 text-sm font-medium">Color & Brightness</span>
        <span className="text-purple-400 text-sm font-medium">{deviceState.brightness}%</span>
      </div>
      
      {/* Color Picker */}
      <div className="mb-4">
        <label className="block text-white/80 text-xs mb-2">Color</label>
        <input
          type="color"
          value={currentColor}
          onChange={(e) => handleColorChange(e.target.value)}
          className="w-full h-10 rounded-lg border border-white/20 bg-transparent cursor-pointer"
          disabled={isUnresponsive}
        />
      </div>

      {/* Brightness Slider */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-3">
        <label className="block text-white/80 text-xs mb-2">Brightness</label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="1"
            max="100"
            value={deviceState.brightness}
            onChange={(e) => handleBrightnessChange(parseInt(e.target.value))}
            className="flex-1 h-1.5 bg-white/10 rounded-full outline-none appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-purple-500 [&::-webkit-slider-thumb]:to-purple-600 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:duration-200 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white/20 [&::-webkit-slider-thumb]:hover:scale-110"
            disabled={isUnresponsive}
          />
          <span className="text-white/80 text-sm font-medium">{deviceState.brightness}%</span>
        </div>
      </div>
    </div>
  );
};

interface DeviceControlsProps {
  deviceIp: string;
  deviceState: DeviceState;
  onToggle: () => void;
  onPropertyChange: (updates: DeviceProperties) => void;
  isUnresponsive?: boolean;
}

export const DeviceControls: React.FC<DeviceControlsProps> = ({
  deviceState,
  onToggle,
  onPropertyChange,
  isUnresponsive = false
}) => {
  const [activeTab, setActiveTab] = useState<'scene' | 'temperature' | 'color'>('scene');

  // Controls are disabled when light is OFF or unresponsive
  const isDisabled = isUnresponsive || !deviceState.state;

  return (
    <div className="flex flex-col items-center w-full space-y-4">
      {/* Centered Power Control */}
      <div className="flex justify-center">
        <PowerControl
          isOn={deviceState.state}
          onToggle={onToggle}
          isUnresponsive={isUnresponsive}
        />
      </div>

      {/* Scene/Temperature/Color Switch */}
      <div className={`bg-gray-700/30 border border-gray-600/30 rounded-lg p-1 flex w-full ${isDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <button
          onClick={() => setActiveTab('scene')}
          disabled={isDisabled}
          className={`flex-1 py-2 px-2 rounded-md text-xs font-medium transition-all duration-200 ${
            activeTab === 'scene'
              ? 'bg-green-500 text-white shadow-md'
              : 'text-gray-300 hover:text-white hover:bg-gray-600/30'
          } disabled:cursor-not-allowed`}
        >
          Scene
        </button>
        <button
          onClick={() => setActiveTab('temperature')}
          disabled={isDisabled}
          className={`flex-1 py-2 px-2 rounded-md text-xs font-medium transition-all duration-200 ${
            activeTab === 'temperature'
              ? 'bg-amber-500 text-white shadow-md'
              : 'text-gray-300 hover:text-white hover:bg-gray-600/30'
          } disabled:cursor-not-allowed`}
        >
          Temp
        </button>
        <button
          onClick={() => setActiveTab('color')}
          disabled={isDisabled}
          className={`flex-1 py-2 px-2 rounded-md text-xs font-medium transition-all duration-200 ${
            activeTab === 'color'
              ? 'bg-purple-500 text-white shadow-md'
              : 'text-gray-300 hover:text-white hover:bg-gray-600/30'
          } disabled:cursor-not-allowed`}
        >
          Color
        </button>
      </div>

      {/* Content based on active tab */}
      <div className={`w-full ${isDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
        {activeTab === 'scene' ? (
          <ScenePanel
            deviceState={deviceState}
            onPropertyChange={onPropertyChange}
            isUnresponsive={isDisabled}
          />
        ) : activeTab === 'temperature' ? (
          <TemperaturePanel
            temperature={deviceState.temperature || 4000}
            onPropertyChange={onPropertyChange}
            isUnresponsive={isDisabled}
          />
        ) : (
          <ColorPanel
            deviceState={deviceState}
            onPropertyChange={onPropertyChange}
            isUnresponsive={isDisabled}
          />
        )}
      </div>

      {/* Show hint when light is OFF */}
      {!deviceState.state && !isUnresponsive && (
        <p className="text-gray-400 text-xs text-center">Turn on the light to adjust settings</p>
      )}
    </div>
  );
};