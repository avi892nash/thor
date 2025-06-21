import React from 'react';

interface WebSocketStatusProps {
  isConnected: boolean;
}

export const WebSocketStatus: React.FC<WebSocketStatusProps> = ({ isConnected }) => {
  return (
    <div className={`ws-status ${isConnected ? 'ws-connected' : 'ws-disconnected'}`}>
      {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
    </div>
  );
}; 