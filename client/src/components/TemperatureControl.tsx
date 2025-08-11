import React, { useState } from 'react';
import { DeviceProperties } from '../types';

interface TemperatureControlProps {
  temperature: number;
  onPropertyChange: (updates: Partial<DeviceProperties>) => void;
  isUnresponsive?: boolean;
}

export const TemperatureControl: React.FC<TemperatureControlProps> = ({
  temperature,
  onPropertyChange,
  isUnresponsive = false
}) => {
  const [showPanel, setShowPanel] = useState(false);

  const handleTemperatureChange = (newTemperature: number) => {
    onPropertyChange({ temperature: newTemperature } as DeviceProperties);
  };

  const togglePanel = () => {
    setShowPanel(!showPanel);
  };

  return (
    <div className="relative inline-block">
      <button 
        onClick={togglePanel}
        className={`w-16 h-16 bg-white/8 border border-white/15 rounded-lg text-white cursor-pointer transition-all duration-300 ease-in-out flex flex-col items-center justify-center gap-1 text-xs font-medium relative hover:not-disabled:bg-white/12 hover:not-disabled:border-white/25 hover:not-disabled:-translate-y-0.5 hover:not-disabled:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${showPanel ? 'bg-amber-500/20 border-amber-500/40 shadow-[0_0_0_2px_rgba(245,158,11,0.2)]' : ''} bg-gradient-to-br from-amber-500 to-amber-600 border-amber-500/30 hover:not-disabled:from-amber-400 hover:not-disabled:to-amber-500 hover:not-disabled:border-amber-500/50`}
        disabled={isUnresponsive}
        title="Temperature Control"
      >
        <div className="flex items-center justify-center w-5 h-5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>
            <path d="M12 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/>
          </svg>
        </div>
        <div className="text-[9px] text-white/90 font-semibold text-center leading-tight">
          {temperature}K
        </div>
      </button>
      
      {showPanel && (
        <div className="absolute top-full left-0 mt-2 z-20 bg-black/98 border border-white/10 rounded-xl p-4 min-w-[280px] shadow-2xl backdrop-blur-[15px] animate-slideDown">
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/10">
            <span className="text-white/90 text-sm font-medium">Temperature</span>
            <button onClick={() => setShowPanel(false)} className="bg-transparent border-none text-white/60 cursor-pointer p-1 rounded transition-all duration-200 hover:bg-white/10 hover:text-white/90">×</button>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button 
              onClick={() => handleTemperatureChange(2200)}
              className={`flex flex-col items-center gap-1 p-3 px-2 bg-white/5 border border-white/10 rounded-md text-white/90 cursor-pointer transition-all duration-200 text-xs font-medium hover:bg-white/10 hover:border-white/20 ${temperature === 2200 ? 'bg-violet-500/20 border-violet-500/40' : ''} bg-amber-500/10 border-amber-500/20`}
            >
              Warm
              <span className="text-[10px] text-white/70">2200K</span>
            </button>
            <button 
              onClick={() => handleTemperatureChange(3000)}
              className={`flex flex-col items-center gap-1 p-3 px-2 bg-white/5 border border-white/10 rounded-md text-white/90 cursor-pointer transition-all duration-200 text-xs font-medium hover:bg-white/10 hover:border-white/20 ${temperature === 3000 ? 'bg-violet-500/20 border-violet-500/40' : ''}`}
            >
              Soft
              <span className="text-[10px] text-white/70">3000K</span>
            </button>
            <button 
              onClick={() => handleTemperatureChange(4000)}
              className={`flex flex-col items-center gap-1 p-3 px-2 bg-white/5 border border-white/10 rounded-md text-white/90 cursor-pointer transition-all duration-200 text-xs font-medium hover:bg-white/10 hover:border-white/20 ${temperature === 4000 ? 'bg-violet-500/20 border-violet-500/40' : ''}`}
            >
              Natural
              <span className="text-[10px] text-white/70">4000K</span>
            </button>
            <button 
              onClick={() => handleTemperatureChange(6500)}
              className={`flex flex-col items-center gap-1 p-3 px-2 bg-white/5 border border-white/10 rounded-md text-white/90 cursor-pointer transition-all duration-200 text-xs font-medium hover:bg-white/10 hover:border-white/20 ${temperature === 6500 ? 'bg-violet-500/20 border-violet-500/40' : ''}`}
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
              className="flex-1 h-1.5 bg-white/10 rounded-full outline-none appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-violet-500 [&::-webkit-slider-thumb]:to-violet-600 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:duration-200 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white/20 [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:hover:shadow-xl [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-gradient-to-br [&::-moz-range-thumb]:from-violet-500 [&::-moz-range-thumb]:to-violet-600 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white/20 [&::-moz-range-thumb]:shadow-lg bg-gradient-to-r from-amber-500 via-amber-400 to-blue-500"
              disabled={isUnresponsive}
            />
            <span className="text-white/80 text-sm font-medium">{temperature}K</span>
          </div>
        </div>
      )}
    </div>
  );
};