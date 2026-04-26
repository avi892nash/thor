import React, { useState } from 'react';
import { WIZ_SCENES, SCENE_CATEGORIES, DYNAMIC_SCENE_IDS, DeviceProperties } from '../types';

interface SceneSelectorProps {
  currentSceneId?: number;
  onSceneChange: (sceneId: number, speed?: number) => void;
  onClose: () => void;
  brightness?: number;
  onBrightnessChange?: (brightness: number) => void;
}

export const SceneSelector: React.FC<SceneSelectorProps> = ({
  currentSceneId,
  onSceneChange,
  onClose,
  brightness = 80,
  onBrightnessChange
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [speed, setSpeed] = useState(100);
  const [localBrightness, setLocalBrightness] = useState(brightness);

  const isDynamicScene = (sceneId: number) => DYNAMIC_SCENE_IDS.includes(sceneId);

  const handleSceneSelect = (sceneId: number) => {
    onSceneChange(sceneId, isDynamicScene(sceneId) ? speed : undefined);
  };

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    if (currentSceneId && isDynamicScene(currentSceneId)) {
      onSceneChange(currentSceneId, newSpeed);
    }
  };

  const handleBrightnessChange = (newBrightness: number) => {
    setLocalBrightness(newBrightness);
    onBrightnessChange?.(newBrightness);
  };

  // Get scene icon/color based on category
  const getSceneStyle = (sceneId: number) => {
    const sceneName = WIZ_SCENES[sceneId];
    if (!sceneName) return 'bg-gray-600';

    // Color coding based on scene type
    if ([11, 12, 13, 14, 29, 30, 34].includes(sceneId)) return 'bg-gradient-to-br from-yellow-200 to-white';
    if ([5, 6, 16, 29].includes(sceneId)) return 'bg-gradient-to-br from-orange-400 to-yellow-300';
    if ([1, 7, 20, 21, 22, 23, 24, 25].includes(sceneId)) return 'bg-gradient-to-br from-green-400 to-blue-400';
    if ([2, 3, 8].includes(sceneId)) return 'bg-gradient-to-br from-pink-400 to-purple-400';
    if ([4, 18, 26, 31].includes(sceneId)) return 'bg-gradient-to-br from-purple-500 to-pink-500';
    if ([27, 28, 33, 36].includes(sceneId)) return 'bg-gradient-to-br from-red-500 to-green-500';
    if ([9, 10, 15, 17, 19, 32, 35].includes(sceneId)) return 'bg-gradient-to-br from-blue-400 to-indigo-500';
    return 'bg-gray-500';
  };

  return (
    <div className="absolute top-full mt-2 right-0 bg-gray-900 border border-gray-700 rounded-xl p-4 z-20 w-80 max-h-96 overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
      <div className="flex justify-between items-center mb-4">
        <h5 className="text-white text-sm font-semibold">Scene Selector</h5>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-1 mb-3">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-2 py-1 text-xs rounded-lg transition-colors ${
            selectedCategory === null
              ? 'bg-purple-500 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          All
        </button>
        {Object.keys(SCENE_CATEGORIES).map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-2 py-1 text-xs rounded-lg transition-colors ${
              selectedCategory === category
                ? 'bg-purple-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Scene Grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {(selectedCategory
          ? SCENE_CATEGORIES[selectedCategory as keyof typeof SCENE_CATEGORIES]
          : Object.keys(WIZ_SCENES).map(Number).filter(id => id <= 36)
        ).map(sceneId => {
          const sceneName = WIZ_SCENES[sceneId];
          if (!sceneName) return null;

          return (
            <button
              key={sceneId}
              onClick={() => handleSceneSelect(sceneId)}
              className={`relative p-2 rounded-lg border-2 transition-all duration-200 ${
                currentSceneId === sceneId
                  ? 'border-purple-500 ring-2 ring-purple-500/30'
                  : 'border-transparent hover:border-gray-500'
              } ${getSceneStyle(sceneId)}`}
            >
              <span className="text-xs font-medium text-gray-900 drop-shadow-sm block truncate">
                {sceneName}
              </span>
              {isDynamicScene(sceneId) && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full" title="Dynamic scene" />
              )}
            </button>
          );
        })}
      </div>

      {/* Speed Control (for dynamic scenes) */}
      {currentSceneId && isDynamicScene(currentSceneId) && (
        <div className="mb-4 p-3 bg-gray-800 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <label className="text-white text-xs font-medium">Animation Speed</label>
            <span className="text-gray-400 text-xs">{speed}%</span>
          </div>
          <input
            type="range"
            min="10"
            max="200"
            value={speed}
            onChange={(e) => handleSpeedChange(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Slow</span>
            <span>Fast</span>
          </div>
        </div>
      )}

      {/* Brightness Control */}
      {onBrightnessChange && (
        <div className="p-3 bg-gray-800 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <label className="text-white text-xs font-medium">Brightness</label>
            <span className="text-gray-400 text-xs">{localBrightness}%</span>
          </div>
          <input
            type="range"
            min="10"
            max="100"
            value={localBrightness}
            onChange={(e) => handleBrightnessChange(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      )}
    </div>
  );
};
