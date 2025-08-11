import React, { useState, useRef } from 'react';
import { DeviceState, DeviceProperties } from '../types';

interface ColorBrightnessControlProps {
  deviceState: DeviceState;
  onPropertyChange: (updates: DeviceProperties) => void;
  isUnresponsive?: boolean;
}

export const ColorBrightnessControl: React.FC<ColorBrightnessControlProps> = ({
  deviceState,
  onPropertyChange,
  isUnresponsive = false
}) => {
  const [showPanel, setShowPanel] = useState(false);
  const colorInputRef = useRef<HTMLInputElement>(null);

  // Convert RGB to hex for color input
  const rgbToHex = (r: number, g: number, b: number) => {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  };

  // Convert hex to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
  };

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

  // Convert RGB to HSV
  const rgbToHsv = (r: number, g: number, b: number) => {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    
    let h = 0;
    let s = max === 0 ? 0 : delta / max;
    let v = max;
    
    if (delta !== 0) {
      if (max === r) {
        h = ((g - b) / delta) % 6;
      } else if (max === g) {
        h = (b - r) / delta + 2;
      } else {
        h = (r - g) / delta + 4;
      }
      h *= 60;
      if (h < 0) h += 360;
    }
    
    return { h, s, v };
  };

  // Get current color for display
  const getCurrentRgb = () => {
    console.log('getCurrentRgb called, deviceState.color:', deviceState.color);
    if (deviceState.color && typeof deviceState.color === 'object') {
      // Check if it's RGB format
      if ('r' in deviceState.color && 'g' in deviceState.color && 'b' in deviceState.color) {
        const rgb = {
          r: Number(deviceState.color.r) || 255,
          g: Number(deviceState.color.g) || 255,
          b: Number(deviceState.color.b) || 255
        };
        console.log('Extracted RGB:', rgb);
        return rgb;
      }
      // Check if it's HSV format
      else if ('h' in deviceState.color && 's' in deviceState.color && 'v' in deviceState.color) {
        const h = Number(deviceState.color.h);
        const s = Number(deviceState.color.s);
        const v = Number(deviceState.color.v);
        const rgb = hsvToRgb(h, s, v);
        console.log('Converted HSV to RGB:', { h, s, v }, '->', rgb);
        return rgb;
      }
    }
    console.log('Using default RGB: white');
    return { r: 255, g: 255, b: 255 };
  };

  // Make currentRgb reactive by calling getCurrentRgb() inside the render
  const currentRgb = getCurrentRgb();

  const handleColorChange = (color: { r: number, g: number, b: number }) => {
    console.log('Color change requested (RGB):', color);
    console.log('Current device state:', deviceState);
    
    // Convert RGB to HSV for device state
    const hsv = rgbToHsv(color.r, color.g, color.b);
    console.log('Converting to HSV:', hsv);
    
    onPropertyChange({ 
      color: hsv,
      brightness: deviceState.brightness
    } as DeviceProperties);
  };

  const handleBrightnessChange = (brightness: number) => {
    // Keep the current color in its original format (HSV if that's what's stored)
    onPropertyChange({ 
      color: deviceState.color,
      brightness
    } as DeviceProperties);
  };

  const handleColorInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('Color input changed to:', e.target.value);
    const rgb = hexToRgb(e.target.value);
    console.log('Converted to RGB:', rgb);
    handleColorChange(rgb);
  };

  const togglePanel = () => {
    setShowPanel(!showPanel);
  };

  return (
    <div className="relative inline-block">
      <button 
        onClick={togglePanel}
        className={`w-16 h-16 bg-white/8 border border-white/15 rounded-lg text-white cursor-pointer transition-all duration-300 ease-in-out flex flex-col items-center justify-center gap-1 text-xs font-medium relative hover:not-disabled:bg-white/12 hover:not-disabled:border-white/25 hover:not-disabled:-translate-y-0.5 hover:not-disabled:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${showPanel ? 'bg-violet-500/20 border-violet-500/40 shadow-[0_0_0_2px_rgba(139,92,246,0.2)]' : ''} bg-gradient-to-br from-violet-500 to-violet-600 border-violet-500/30 hover:not-disabled:from-violet-600 hover:not-disabled:to-violet-700 hover:not-disabled:border-violet-500/50`}
        disabled={isUnresponsive}
        title="Color & Brightness Control"
      >
        <div className="flex items-center justify-center w-5 h-5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
            <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
            <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
            <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
          </svg>
        </div>
        <div className="text-[9px] text-white/90 font-semibold text-center leading-tight">
          Color
        </div>
      </button>
      
      {showPanel && (
        <div className="absolute top-full left-0 mt-2 z-20 bg-black/98 border border-white/10 rounded-xl p-4 min-w-[320px] shadow-2xl backdrop-blur-[15px] animate-slideDown">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/10">
            <span className="text-white/90 text-sm font-medium">Color & Brightness</span>
            <button onClick={() => setShowPanel(false)} className="bg-transparent border-none text-white/60 cursor-pointer p-1 rounded transition-all duration-200 hover:bg-white/10 hover:text-white/90">×</button>
          </div>
          
          <div className="flex flex-col gap-4">
            {/* Current Color Display */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label className="text-white/90 text-sm font-medium">Current Color</label>
                <button
                  onClick={() => handleColorChange({ r: 255, g: 255, b: 255 })}
                  className="text-xs text-white/60 hover:text-white/90 bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded transition-all duration-200"
                  disabled={isUnresponsive}
                >
                  Reset
                </button>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div 
                    className="w-16 h-16 rounded-xl border-2 border-white/20 shadow-lg ring-2 ring-violet-500/20"
                    style={{ backgroundColor: `rgb(${currentRgb.r}, ${currentRgb.g}, ${currentRgb.b})` }}
                  />
                  <div className="absolute -bottom-2 -right-2 bg-gray-800 border border-white/20 rounded-full px-2 py-1">
                    <span className="text-xs text-white/70 font-mono">
                      {rgbToHex(currentRgb.r, currentRgb.g, currentRgb.b).toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="relative">
                    <input 
                      ref={colorInputRef}
                      type="color" 
                      value={rgbToHex(currentRgb.r, currentRgb.g, currentRgb.b)}
                      onChange={handleColorInputChange}
                      className="w-full h-12 opacity-0 cursor-pointer absolute inset-0 z-10"
                      disabled={isUnresponsive}
                    />
                    <div 
                      className="w-full h-12 border-2 border-white/20 rounded-lg bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-cyan-500 via-blue-500 to-purple-500 hover:border-violet-400/50 transition-all duration-200 flex items-center justify-center cursor-pointer"
                      onClick={() => colorInputRef.current?.click()}
                    >
                      <span className="text-white/80 text-sm font-medium bg-black/40 px-2 py-1 rounded">
                        Click to pick color
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Color Presets */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label className="text-white/90 text-sm font-medium">Quick Colors</label>
                <span className="text-xs text-white/50">Click to select</span>
              </div>
              <div className="grid grid-cols-6 gap-3">
                {[
                  { name: 'Warm Red', r: 255, g: 99, b: 99, hover: 'red' },
                  { name: 'Orange', r: 255, g: 159, b: 64, hover: 'orange' },
                  { name: 'Yellow', r: 255, g: 205, b: 86, hover: 'yellow' },
                  { name: 'Green', r: 129, g: 199, b: 132, hover: 'green' },
                  { name: 'Blue', r: 54, g: 162, b: 235, hover: 'blue' },
                  { name: 'Purple', r: 153, g: 102, b: 255, hover: 'purple' }
                ].map((color) => (
                  <button 
                    key={color.name}
                    onClick={() => {
                      console.log(`${color.name} selected:`, { r: color.r, g: color.g, b: color.b });
                      handleColorChange({ r: color.r, g: color.g, b: color.b });
                    }}
                    className={`w-12 h-12 rounded-xl border-2 border-white/20 cursor-pointer transition-all duration-200 hover:scale-110 hover:border-${color.hover}-400/60 hover:shadow-lg hover:shadow-${color.hover}-500/20 relative group active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
                    style={{ backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})` }}
                    title={color.name}
                    disabled={isUnresponsive}
                  >
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                      {color.name}
                    </div>
                  </button>
                ))}
              </div>
              
              {/* Second Row */}
              <div className="grid grid-cols-6 gap-3">
                {[
                  { name: 'Pink', r: 255, g: 99, b: 132, hover: 'pink' },
                  { name: 'Amber', r: 255, g: 193, b: 7, hover: 'amber' },
                  { name: 'Teal', r: 75, g: 192, b: 192, hover: 'teal' },
                  { name: 'Cyan', r: 0, g: 188, b: 212, hover: 'cyan' },
                  { name: 'Indigo', r: 63, g: 81, b: 181, hover: 'indigo' },
                  { name: 'Pure White', r: 255, g: 255, b: 255, hover: 'white' }
                ].map((color) => (
                  <button 
                    key={color.name}
                    onClick={() => {
                      console.log(`${color.name} selected:`, { r: color.r, g: color.g, b: color.b });
                      handleColorChange({ r: color.r, g: color.g, b: color.b });
                    }}
                    className={`w-12 h-12 rounded-xl border-2 ${color.name === 'Pure White' ? 'border-white/40 bg-gradient-to-br from-white to-gray-100' : 'border-white/20'} cursor-pointer transition-all duration-200 hover:scale-110 hover:shadow-lg relative group active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
                    style={color.name !== 'Pure White' ? { backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})` } : {}}
                    title={color.name}
                    disabled={isUnresponsive}
                  >
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                      {color.name}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Brightness Control */}
            <div className="pt-4 border-t border-white/10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-white/90 text-sm font-medium">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6A6,6 0 0,1 18,12A6,6 0 0,1 12,18M20,15.31L23.31,12L20,8.69V4H15.31L12,0.69L8.69,4H4V8.69L0.69,12L4,15.31V20H8.69L12,23.31L15.31,20H20V15.31Z"/>
                  </svg>
                  <span>Brightness</span>
                </div>
                <div className="bg-gray-800 border border-white/20 rounded-lg px-3 py-1">
                  <span className="text-white font-mono text-sm">{deviceState.brightness}%</span>
                </div>
              </div>
              <div className="bg-gray-800/50 border border-white/10 rounded-xl p-4">
                <input 
                  type="range" 
                  min="10" 
                  max="100" 
                  value={deviceState.brightness}
                  onChange={(e) => handleBrightnessChange(parseInt(e.target.value))}
                  className="w-full h-2 bg-gradient-to-r from-gray-700 to-yellow-400 rounded-full outline-none appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-yellow-400 [&::-webkit-slider-thumb]:to-orange-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:duration-200 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white/30 [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:hover:shadow-xl [&::-webkit-slider-thumb]:hover:shadow-yellow-500/30 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-gradient-to-br [&::-moz-range-thumb]:from-yellow-400 [&::-moz-range-thumb]:to-orange-500 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white/30 [&::-moz-range-thumb]:shadow-lg"
                  disabled={isUnresponsive}
                />
                <div className="flex justify-between text-xs text-white/50 mt-2">
                  <span>Dim</span>
                  <span>Bright</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};