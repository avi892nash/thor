const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const TOKEN_KEY = 'thor.token';

export interface PublicUser {
  username: string;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: PublicUser;
}

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY);

const request = async <T>(path: string, init: RequestInit): Promise<T> => {
  const res = await fetch(`${API_BASE}${path}`, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error || `HTTP ${res.status}`);
  }
  return body as T;
};

export const fetchStatus = async (): Promise<{ bootstrapped: boolean }> =>
  request('/auth/status', { method: 'GET' });

export const login = async (username: string, password: string): Promise<AuthResponse> => {
  const res = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  setToken(res.token);
  return res;
};

export const register = async (
  username: string,
  password: string,
): Promise<AuthResponse> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await request<AuthResponse>('/auth/register', {
    method: 'POST',
    headers,
    body: JSON.stringify({ username, password }),
  });
  // Only set token if we weren't already authed (bootstrap case)
  if (!token) setToken(res.token);
  return res;
};

export const fetchMe = async (): Promise<PublicUser> => {
  const token = getToken();
  if (!token) throw new Error('no token');
  const res = await request<{ user: PublicUser }>('/auth/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.user;
};

export const logout = (): void => {
  clearToken();
  window.dispatchEvent(new Event('thor:auth-change'));
};
