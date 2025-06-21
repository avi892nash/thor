import { useState, useEffect, useRef } from 'react';

interface StatusMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration: number;
}

export const useStatusQueue = () => {
  const [currentStatus, setCurrentStatus] = useState<StatusMessage | null>(null);
  const [statusVisible, setStatusVisible] = useState(false);
  const [queue, setQueue] = useState<StatusMessage[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const addStatus = (message: string, type: 'success' | 'error' | 'info', duration: number = 3000) => {
    const newStatus: StatusMessage = {
      id: Date.now().toString() + Math.random(),
      message,
      type,
      duration
    };

    setQueue(prev => [...prev, newStatus]);
  };

  const processQueue = () => {
    if (queue.length === 0 || currentStatus) return;

    const nextStatus = queue[0];
    setQueue(prev => prev.slice(1));
    setCurrentStatus(nextStatus);

    // Show the status with a small delay for smooth animation
    setTimeout(() => setStatusVisible(true), 10);

    // Hide the status after duration
    timeoutRef.current = setTimeout(() => {
      setStatusVisible(false);
      
      // Remove from DOM after animation completes
      animationTimeoutRef.current = setTimeout(() => {
        setCurrentStatus(null);
      }, 400);
    }, nextStatus.duration);
  };

  // Process queue when it changes or when current status is cleared
  useEffect(() => {
    if (!currentStatus && queue.length > 0) {
      processQueue();
    }
  }, [queue.length, currentStatus]);

  // Initial queue processing when first status is added
  useEffect(() => {
    processQueue();
  }, [queue.length]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
    };
  }, []);

  return {
    currentStatus,
    statusVisible,
    addStatus,
    queueLength: queue.length
  };
}; 