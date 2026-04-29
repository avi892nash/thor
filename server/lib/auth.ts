import fs from 'fs/promises';
import { join } from 'path';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { logger } from './logger.js';

export interface User {
  username: string;
  passwordHash: string;
  createdAt: string;
}

export interface PublicUser {
  username: string;
}

interface UsersFile {
  users: User[];
}

const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const BCRYPT_ROUNDS = 10;

let users: User[] = [];
let usersPath = '';

export const initAuth = async (dataDir: string): Promise<void> => {
  usersPath = join(dataDir, 'users.json');
  try {
    const raw = await fs.readFile(usersPath, 'utf8');
    const parsed = JSON.parse(raw) as UsersFile;
    users = Array.isArray(parsed.users) ? parsed.users : [];
  } catch {
    users = [];
    await persist();
  }
  logger.info(`Loaded ${users.length} users from ${usersPath}`);
};

const persist = async (): Promise<void> => {
  const tmp = `${usersPath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify({ users }, null, 2));
  await fs.rename(tmp, usersPath);
};

const getSecret = (): string => {
  const secret = process.env['JWT_SECRET'];
  if (!secret) {
    throw new Error('JWT_SECRET is not set — refusing to sign tokens');
  }
  return secret;
};

export const isBootstrapped = (): boolean => users.length > 0;

export const findUser = (username: string): User | undefined =>
  users.find((u) => u.username === username);

export const createUser = async (username: string, password: string): Promise<PublicUser> => {
  const trimmed = username.trim();
  if (!trimmed || !password) {
    throw new Error('username and password are required');
  }
  if (findUser(trimmed)) {
    throw new Error('username already exists');
  }
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user: User = {
    username: trimmed,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  await persist();
  return { username: user.username };
};

export const verifyPassword = async (username: string, password: string): Promise<PublicUser | null> => {
  const user = findUser(username);
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? { username: user.username } : null;
};

export const signToken = (user: PublicUser): string => {
  const opts: SignOptions = { expiresIn: TOKEN_TTL_SECONDS, subject: user.username };
  return jwt.sign({}, getSecret(), opts);
};

export const verifyToken = (token: string): PublicUser | null => {
  try {
    const decoded = jwt.verify(token, getSecret()) as jwt.JwtPayload;
    if (typeof decoded.sub !== 'string') return null;
    return { username: decoded.sub };
  } catch {
    return null;
  }
};
