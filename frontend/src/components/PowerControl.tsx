import React from 'react';

interface PowerControlProps {
  isOn: boolean;
  onToggle: () => void;
  isUnresponsive?: boolean;
}

export const PowerControl: React.FC<PowerControlProps> = ({
  isOn,
  onToggle,
  isUnresponsive = false
}) => {
  const handleClick = () => {
    if (!isUnresponsive) {
      onToggle();
    }
  };

  return (
    <div className="relative inline-block">
      <button 
        onClick={handleClick}
        className={`w-20 h-20 text-white cursor-pointer transition-all duration-300 ease-in-out flex flex-col items-center justify-center gap-2 text-sm font-medium relative hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl shadow-lg ${
          isOn 
            ? 'bg-gradient-to-br from-green-500 to-green-600 border-2 border-green-400 shadow-green-500/30' 
            : 'bg-gradient-to-br from-gray-600 to-gray-700 border-2 border-gray-500 shadow-gray-500/20'
        }`}
        disabled={isUnresponsive}
        title={isOn ? 'Turn Off' : 'Turn On'}
      >
        <div className="flex items-center justify-center w-8 h-8">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2v10" />
            <path d="M18.4 6.6a9 9 0 1 1-12.77.04" />
          </svg>
        </div>
        <div className="text-xs text-white font-bold tracking-wide">
          {isOn ? 'ON' : 'OFF'}
        </div>
      </button>
    </div>
  );
};