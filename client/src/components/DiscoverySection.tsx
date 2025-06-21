import React, { useState } from 'react';
import { Light, NetworkInfo } from '../types';
import { useStatusQueue } from '../hooks/useStatusQueue';

interface DiscoverySectionProps {
  discoveredLights: Light[];
  connectedLights: string[];
  lightStates: { [ip: string]: boolean };
  networkInfo: NetworkInfo | null;
  onDiscover: (subnet?: string) => Promise<any>;
  onConnect: (ip: string) => Promise<any>;
  onToggle: (ip: string) => Promise<any>;
  onRefresh: () => Promise<void>;
  onTestSingleIP: (ip: string) => Promise<any>;
}

export const DiscoverySection: React.FC<DiscoverySectionProps> = ({
  discoveredLights,
  connectedLights,
  lightStates,
  networkInfo,
  onDiscover,
  onConnect,
  onToggle,
  onRefresh,
  onTestSingleIP
}) => {
  const [subnet, setSubnet] = useState('');
  const [testIP, setTestIP] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { currentStatus, statusVisible, addStatus } = useStatusQueue();

  const handleDiscover = async () => {
    setIsLoading(true);
    try {
      const result = await onDiscover(subnet || networkInfo?.primaryBroadcast);
      if (result.success) {
        addStatus(`🔍 Found ${result.count} lights`, 'success', 5000);
      } else {
        addStatus(`❌ Discovery failed: ${result.error}`, 'error', 5000);
      }
    } catch (error) {
      addStatus(`❌ Discovery failed: ${error}`, 'error', 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async (ip: string) => {
    try {
      const result = await onConnect(ip);
      if (result.success) {
        addStatus(`✅ Connected to ${ip}`, 'success', 5000);
      } else {
        addStatus(`❌ Failed to connect to ${ip}: ${result.error}`, 'error', 5000);
      }
    } catch (error) {
      addStatus(`❌ Failed to connect to ${ip}: ${error}`, 'error', 5000);
    }
  };

  const handleToggle = async (ip: string) => {
    try {
      const result = await onToggle(ip);
      if (result.success) {
        const newState = lightStates[ip] ? 'off' : 'on';
        addStatus(`💡 Turned ${newState} light ${ip}`, 'success', 3000);
      } else {
        addStatus(`❌ Failed to toggle ${ip}: ${result.error}`, 'error', 5000);
      }
    } catch (error) {
      addStatus(`❌ Failed to toggle ${ip}: ${error}`, 'error', 5000);
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      await onRefresh();
      addStatus('🔄 Lights list refreshed', 'info', 3000);
    } catch (error) {
      addStatus(`❌ Failed to refresh: ${error}`, 'error', 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestSingleIP = async () => {
    if (!testIP.trim()) {
      addStatus('❌ Please enter an IP address to test', 'error', 4000);
      return;
    }

    setIsLoading(true);
    try {
      const result = await onTestSingleIP(testIP.trim());
      if (result.success) {
        addStatus(`✅ Successfully communicated with ${testIP}`, 'success', 5000);
      } else {
        addStatus(`❌ Failed to communicate with ${testIP}: ${result.error}`, 'error', 5000);
      }
    } catch (error) {
      addStatus(`❌ Failed to communicate with ${testIP}: ${error}`, 'error', 5000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="section">
      <h2>Discover Lights</h2>
      
      <div className="input-group">
        <input
          type="text"
          value={subnet}
          onChange={(e) => setSubnet(e.target.value)}
          placeholder={networkInfo?.primaryBroadcast || 'Auto-detecting...'}
        />
        <button onClick={handleDiscover} disabled={isLoading}>
          {isLoading ? 'Discovering...' : 'Discover Lights'}
        </button>
        <button onClick={handleRefresh} disabled={isLoading}>
          Refresh
        </button>
        <button onClick={() => setSubnet(networkInfo?.primaryBroadcast || '')} title="Auto-detect network">
          🔄 Auto
        </button>
      </div>

      <div className="input-group">
        <input
          type="text"
          value={testIP}
          onChange={(e) => setTestIP(e.target.value)}
          placeholder="192.168.0.110"
        />
        <button onClick={handleTestSingleIP} disabled={isLoading}>
          Test Single IP
        </button>
        <small>Test UDP communication with specific IP:38899</small>
      </div>

      <div className={`status-container ${!currentStatus ? 'empty' : ''}`}>
        {currentStatus && (
          <div className={`status ${currentStatus.type} ${statusVisible ? 'show' : 'hide'}`}>
            {currentStatus.message}
          </div>
        )}
      </div>

      <div className="lights-list">
        {discoveredLights.map((light) => (
          <div key={light.ip} className={`light-card ${connectedLights.includes(light.ip) ? 'connected' : ''}`}>
            <h3>💡 Light {light.ip}</h3>
            <p>Port: {light.port}</p>
            {light.mac && <p>MAC: {light.mac}</p>}
            
            <div className="button-group">
              {connectedLights.includes(light.ip) ? (
                <button 
                  className={lightStates[light.ip] ? 'danger' : 'success'}
                  onClick={() => handleToggle(light.ip)}
                >
                  {lightStates[light.ip] ? 'Turn Off' : 'Turn On'}
                </button>
              ) : (
                <button onClick={() => handleConnect(light.ip)}>
                  Connect
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {discoveredLights.length === 0 && !isLoading && (
        <div className="status info">
          No lights discovered. Try clicking "Discover Lights" to scan your network.
        </div>
      )}
    </div>
  );
}; 