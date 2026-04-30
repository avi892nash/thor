const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const TOKEN_KEY = 'thor.token';

export type Role = 'root' | 'user';

export interface PublicUser {
  username: string;
  role: Role;
  mustChangePassword: boolean;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: PublicUser;
}

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY);

const authedHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

const request = async <T>(path: string, init: RequestInit): Promise<T> => {
  const res = await fetch(`${API_BASE}${path}`, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error || `HTTP ${res.status}`);
  }
  return body as T;
};

export const login = async (username: string, password: string): Promise<AuthResponse> => {
  const res = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  setToken(res.token);
  return res;
};

export const fetchMe = async (): Promise<PublicUser> => {
  const res = await request<{ user: PublicUser }>('/auth/me', {
    method: 'GET',
    headers: authedHeaders(),
  });
  return res.user;
};

export const changePassword = async (
  currentPassword: string,
  newPassword: string,
): Promise<PublicUser> => {
  const res = await request<{ user: PublicUser }>('/auth/password', {
    method: 'POST',
    headers: authedHeaders(),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  return res.user;
};

export const listUsers = async (): Promise<PublicUser[]> => {
  const res = await request<{ users: PublicUser[] }>('/auth/users', {
    method: 'GET',
    headers: authedHeaders(),
  });
  return res.users;
};

export const createUser = async (username: string, password: string): Promise<PublicUser> => {
  const res = await request<{ user: PublicUser }>('/auth/users', {
    method: 'POST',
    headers: authedHeaders(),
    body: JSON.stringify({ username, password }),
  });
  return res.user;
};

export const deleteUser = async (username: string): Promise<void> => {
  await request<{ success: boolean }>(`/auth/users/${encodeURIComponent(username)}`, {
    method: 'DELETE',
    headers: authedHeaders(),
  });
};

export const resetUserPassword = async (
  username: string,
  newPassword: string,
): Promise<PublicUser> => {
  const res = await request<{ user: PublicUser }>(
    `/auth/users/${encodeURIComponent(username)}/password`,
    {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ newPassword }),
    },
  );
  return res.user;
};

export const logout = (): void => {
  clearToken();
  window.dispatchEvent(new Event('thor:auth-change'));
};
