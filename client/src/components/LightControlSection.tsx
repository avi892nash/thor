import React, { useState } from 'react';
import { useStatusQueue } from '../hooks/useStatusQueue';

interface LightControlSectionProps {
  connectedLights: string[];
  lightStates: { [ip: string]: boolean };
  onToggleAll: (state: boolean) => Promise<any>;
  onSetColor: (r: number, g: number, b: number, brightness: number) => Promise<void>;
  onSetBrightness: (brightness: number) => Promise<void>;
  onSetTemperature: (temperature: number) => Promise<void>;
}

export const LightControlSection: React.FC<LightControlSectionProps> = ({
  connectedLights,
  lightStates,
  onToggleAll,
  onSetColor,
  onSetBrightness,
  onSetTemperature
}) => {
  const [color, setColor] = useState('#ffffff');
  const [brightness, setBrightness] = useState(80);
  const [temperature, setTemperature] = useState(4200);
  const { currentStatus, statusVisible, addStatus } = useStatusQueue();

  const handleAllLightsOn = async () => {
    try {
      const result = await onToggleAll(true);
      if (result.success) {
        addStatus('✅ All lights turned on', 'success', 3000);
      } else {
        addStatus(`❌ Failed to turn on all lights: ${result.error}`, 'error', 4000);
      }
    } catch (error) {
      addStatus(`❌ Failed to turn on all lights: ${error}`, 'error', 4000);
    }
  };

  const handleAllLightsOff = async () => {
    try {
      const result = await onToggleAll(false);
      if (result.success) {
        addStatus('✅ All lights turned off', 'success', 3000);
      } else {
        addStatus(`❌ Failed to turn off all lights: ${result.error}`, 'error', 4000);
      }
    } catch (error) {
      addStatus(`❌ Failed to turn off all lights: ${error}`, 'error', 4000);
    }
  };

  const handleColorChange = async (newColor: string) => {
    setColor(newColor);
    const r = parseInt(newColor.substr(1, 2), 16);
    const g = parseInt(newColor.substr(3, 2), 16);
    const b = parseInt(newColor.substr(5, 2), 16);
    
    try {
      await onSetColor(r, g, b, brightness);
      addStatus(`🎨 Color set to ${newColor}`, 'success', 2500);
    } catch (error) {
      addStatus(`❌ Failed to set color: ${error}`, 'error', 4000);
    }
  };

  const handleBrightnessChange = async (newBrightness: number) => {
    setBrightness(newBrightness);
    try {
      await onSetBrightness(newBrightness);
      addStatus(`💡 Brightness set to ${newBrightness}%`, 'success', 2000);
    } catch (error) {
      addStatus(`❌ Failed to set brightness: ${error}`, 'error', 4000);
    }
  };

  const handleTemperatureChange = async (newTemperature: number) => {
    setTemperature(newTemperature);
    try {
      await onSetTemperature(newTemperature);
      addStatus(`🌡️ Temperature set to ${newTemperature}K`, 'success', 2000);
    } catch (error) {
      addStatus(`❌ Failed to set temperature: ${error}`, 'error', 4000);
    }
  };

  const handlePresetTemperature = async (temp: number) => {
    setTemperature(temp);
    try {
      await onSetTemperature(temp);
      addStatus(`🌡️ Temperature preset set to ${temp}K`, 'success', 3000);
    } catch (error) {
      addStatus(`❌ Failed to set temperature: ${error}`, 'error', 4000);
    }
  };

  if (connectedLights.length === 0) {
    return (
      <div className="section">
        <h2>Light Control</h2>
        <div className="status info">
          No lights connected. Please discover and connect to lights first.
        </div>
      </div>
    );
  }

  return (
    <div className="section">
      <h2>Light Control</h2>
      
      <div className="button-group">
        <button className="success" onClick={handleAllLightsOn}>
          All Lights On
        </button>
        <button className="danger" onClick={handleAllLightsOff}>
          All Lights Off
        </button>
      </div>

      <div className="input-group">
        <label>Set Color for All:</label>
        <input
          type="color"
          value={color}
          onChange={(e) => handleColorChange(e.target.value)}
        />
        <input
          type="range"
          min="1"
          max="100"
          value={brightness}
          onChange={(e) => handleBrightnessChange(parseInt(e.target.value))}
        />
        <span>{brightness}%</span>
      </div>

      <div className="input-group">
        <label>Set Temperature for All:</label>
        <input
          type="range"
          min="2200"
          max="6500"
          value={temperature}
          onChange={(e) => handleTemperatureChange(parseInt(e.target.value))}
        />
        <span>{temperature}K</span>
        <small>(2200K=Warm, 6500K=Cool)</small>
      </div>

      <div className="button-group">
        <button 
          className="temp-warm"
          onClick={() => handlePresetTemperature(2700)}
        >
          Warm (2700K)
        </button>
        <button 
          className="temp-neutral"
          onClick={() => handlePresetTemperature(4200)}
        >
          Neutral (4200K)
        </button>
        <button 
          className="temp-cool"
          onClick={() => handlePresetTemperature(6500)}
        >
          Cool (6500K)
        </button>
      </div>

      <div className={`status-container ${!currentStatus ? 'empty' : ''}`}>
        {currentStatus && (
          <div className={`status ${currentStatus.type} ${statusVisible ? 'show' : 'hide'}`}>
            {currentStatus.message}
          </div>
        )}
      </div>

      <div className="status info">
        Connected to {connectedLights.length} light{connectedLights.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}; 