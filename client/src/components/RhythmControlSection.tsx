import React, { useState } from 'react';
import { RhythmStatus } from '../types';
import { useStatusQueue } from '../hooks/useStatusQueue';

interface RhythmControlSectionProps {
  connectedLights: string[];
  rhythmStatus: RhythmStatus | null;
  onSetupRhythm: () => Promise<any>;
  onStartEffect: (effect: string, bpm: number) => Promise<any>;
  onStopRhythm: () => Promise<any>;
  onSetBPM: (bpm: number) => Promise<any>;
  onTriggerBeat: () => Promise<any>;
}

const effects = [
  { name: 'pulse', description: 'Flash on each beat', icon: '' },
  { name: 'rainbow', description: 'Cycle through colors', icon: '' },
  { name: 'strobe', description: 'Random flashing', icon: '' },
  { name: 'wave', description: 'Smooth wave pattern', icon: '' },
  { name: 'beat', description: 'Random colors', icon: '' },
  { name: 'breathe', description: 'Breathing effect', icon: '' }
];

export const RhythmControlSection: React.FC<RhythmControlSectionProps> = ({
  connectedLights,
  rhythmStatus,
  onSetupRhythm,
  onStartEffect,
  onStopRhythm,
  onSetBPM,
  onTriggerBeat
}) => {
  const [bpm, setBpm] = useState(120);
  const [isLoading, setIsLoading] = useState(false);
  const { currentStatus, statusVisible, addStatus } = useStatusQueue();

  const handleSetupRhythm = async () => {
    if (connectedLights.length === 0) {
      addStatus('❌ No lights connected. Connect lights first.', 'error', 4000);
      return;
    }

    setIsLoading(true);
    try {
      const result = await onSetupRhythm();
      if (result.success) {
        addStatus(`🎵 Rhythm setup with ${result.lights.length} lights`, 'success', 4000);
      } else {
        addStatus(`❌ Setup failed: ${result.error}`, 'error', 4000);
      }
    } catch (error) {
      addStatus(`❌ Setup failed: ${error}`, 'error', 4000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartEffect = async (effect: string) => {
    setIsLoading(true);
    try {
      const result = await onStartEffect(effect, bpm);
      if (result.success) {
        addStatus(`🎵 Started ${effect} effect at ${bpm} BPM`, 'success', 4000);
      } else {
        addStatus(`❌ Failed to start effect: ${result.error}`, 'error', 4000);
      }
    } catch (error) {
      addStatus(`❌ Failed to start effect: ${error}`, 'error', 4000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopRhythm = async () => {
    setIsLoading(true);
    try {
      const result = await onStopRhythm();
      if (result.success) {
        addStatus('⏹️ All effects stopped', 'info', 3000);
      } else {
        addStatus(`❌ Failed to stop effects: ${result.error}`, 'error', 4000);
      }
    } catch (error) {
      addStatus(`❌ Failed to stop effects: ${error}`, 'error', 4000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBPMChange = async (newBpm: number) => {
    setBpm(newBpm);
    try {
      await onSetBPM(newBpm);
    } catch (error) {
      addStatus(`❌ Failed to set BPM: ${error}`, 'error', 4000);
    }
  };

  const handleTriggerBeat = async () => {
    try {
      await onTriggerBeat();
      addStatus('🎯 Beat triggered!', 'success', 2000);
    } catch (error) {
      addStatus(`❌ Failed to trigger beat: ${error}`, 'error', 4000);
    }
  };

  return (
    <div className="section">
      <h2>Rhythm & Music Sync</h2>
      
      <div className="button-group">
        <button onClick={handleSetupRhythm} disabled={isLoading}>
          Setup Rhythm (All Lights)
        </button>
        <button className="danger" onClick={handleStopRhythm} disabled={isLoading}>
          Stop All Effects
        </button>
      </div>

      <div className="input-group">
        <label>BPM:</label>
        <input
          type="number"
          min="60"
          max="200"
          value={bpm}
          onChange={(e) => handleBPMChange(parseInt(e.target.value))}
        />
        <button onClick={handleTriggerBeat} disabled={isLoading}>
          Manual Beat
        </button>
      </div>

      {rhythmStatus && (
        <div className="status info">
          Status: {rhythmStatus.isRunning ? 
            `Running ${rhythmStatus.currentEffect || 'unknown'} at ${rhythmStatus.bpm || 'unknown'} BPM` : 
            'Stopped'
          }
          {rhythmStatus.lightsCount && ` (${rhythmStatus.lightsCount} lights)`}
        </div>
      )}

      <div className="rhythm-controls">
        {effects.map((effect) => (
          <button
            key={effect.name}
            className="effect-button"
            onClick={() => handleStartEffect(effect.name)}
            disabled={isLoading}
          >
            {effect.icon} {effect.name.charAt(0).toUpperCase() + effect.name.slice(1)}
            <br />
            <small>{effect.description}</small>
          </button>
        ))}
      </div>

      <div className={`status-container ${!currentStatus ? 'empty' : ''}`}>
        {currentStatus && (
          <div className={`status ${currentStatus.type} ${statusVisible ? 'show' : 'hide'}`}>
            {currentStatus.message}
          </div>
        )}
      </div>

      {connectedLights.length === 0 && (
        <div className="status info">
          Connect to lights first to enable rhythm control.
        </div>
      )}
    </div>
  );
}; 