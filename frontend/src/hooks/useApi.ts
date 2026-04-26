import { useCallback } from 'react';
import { ApiResponse } from '../types';

export const useApi = () => {
  const apiCall = useCallback(async <T = any>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any
  ): Promise<ApiResponse<T>> => {
    try {
      const config: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      if (data && (method === 'POST' || method === 'PUT')) {
        config.body = JSON.stringify(data);
      }

      const response = await fetch(endpoint, config);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      return result;
    } catch (error) {
      console.error(`API call failed for ${method} ${endpoint}:`, error);
      throw error;
    }
  }, []);

  return { apiCall };
}; 