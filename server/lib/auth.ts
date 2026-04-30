import fs from 'fs/promises';
import { join } from 'path';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { logger } from './logger.js';

export type Role = 'root' | 'user';

export interface User {
  username: string;
  passwordHash: string;
  role: Role;
  createdAt: string;
  mustChangePassword?: boolean;
}

export interface PublicUser {
  username: string;
  role: Role;
  mustChangePassword: boolean;
}

interface UsersFile {
  users: Array<Partial<User> & { username: string; passwordHash: string }>;
}

const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 6;
const DEFAULT_ROOT_USERNAME = 'root';
const DEFAULT_ROOT_PASSWORD = 'thor';

let users: User[] = [];
let usersPath = '';

const toPublic = (u: User): PublicUser => ({
  username: u.username,
  role: u.role,
  mustChangePassword: u.mustChangePassword === true,
});

export const initAuth = async (dataDir: string): Promise<void> => {
  usersPath = join(dataDir, 'users.json');
  let raw: string | null = null;
  try {
    raw = await fs.readFile(usersPath, 'utf8');
  } catch {
    raw = null;
  }
  let loaded: UsersFile['users'] = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as UsersFile;
      loaded = Array.isArray(parsed.users) ? parsed.users : [];
    } catch {
      loaded = [];
    }
  }

  users = await migrateAndSeed(loaded);
  await persist();
  logger.info(`Loaded ${users.length} users from ${usersPath}`);
};

const migrateAndSeed = async (
  loaded: UsersFile['users'],
): Promise<User[]> => {
  // E1: empty users file → seed default root
  if (loaded.length === 0) {
    logger.warn('users.json is empty — seeding default root user (root/thor)');
    const passwordHash = await bcrypt.hash(DEFAULT_ROOT_PASSWORD, BCRYPT_ROUNDS);
    return [
      {
        username: DEFAULT_ROOT_USERNAME,
        passwordHash,
        role: 'root',
        createdAt: new Date().toISOString(),
        mustChangePassword: true,
      },
    ];
  }

  // Sort by createdAt for stable role assignment during migration
  const sorted = [...loaded].sort((a, b) => {
    const ac = a.createdAt ?? '';
    const bc = b.createdAt ?? '';
    return ac.localeCompare(bc);
  });

  const anyMissingRole = sorted.some((u) => u.role !== 'root' && u.role !== 'user');
  if (anyMissingRole) {
    logger.warn('Migrating users.json: assigning roles (oldest user → root, rest → user)');
    return sorted.map((u, idx) => ({
      username: u.username,
      passwordHash: u.passwordHash,
      role: idx === 0 ? 'root' : 'user',
      createdAt: u.createdAt ?? new Date().toISOString(),
      mustChangePassword: u.mustChangePassword === true,
    }));
  }

  // E3: no root present → promote oldest
  const hasRoot = sorted.some((u) => u.role === 'root');
  if (!hasRoot) {
    logger.warn('No root user found — promoting oldest user to root');
    return sorted.map((u, idx) => ({
      username: u.username,
      passwordHash: u.passwordHash,
      role: (idx === 0 ? 'root' : (u.role as Role)) as Role,
      createdAt: u.createdAt ?? new Date().toISOString(),
      mustChangePassword: u.mustChangePassword === true,
    }));
  }

  return sorted.map((u) => ({
    username: u.username,
    passwordHash: u.passwordHash,
    role: u.role as Role,
    createdAt: u.createdAt ?? new Date().toISOString(),
    mustChangePassword: u.mustChangePassword === true,
  }));
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

export const findUser = (username: string): User | undefined =>
  users.find((u) => u.username === username);

export const listUsers = (): PublicUser[] =>
  users.map((u) => toPublic(u)).sort((a, b) => a.username.localeCompare(b.username));

export const verifyPassword = async (username: string, password: string): Promise<PublicUser | null> => {
  const user = findUser(username);
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? toPublic(user) : null;
};

export const getPublicUser = (username: string): PublicUser | null => {
  const u = findUser(username);
  return u ? toPublic(u) : null;
};

export const signToken = (user: PublicUser): string => {
  const opts: SignOptions = { expiresIn: TOKEN_TTL_SECONDS, subject: user.username };
  return jwt.sign({ role: user.role }, getSecret(), opts);
};

export interface DecodedToken {
  username: string;
  role: Role;
}

export const verifyToken = (token: string): DecodedToken | null => {
  try {
    const decoded = jwt.verify(token, getSecret()) as jwt.JwtPayload;
    if (typeof decoded.sub !== 'string') return null;
    const role = decoded['role'];
    if (role !== 'root' && role !== 'user') return null;
    return { username: decoded.sub, role };
  } catch {
    return null;
  }
};

const validatePassword = (password: string): void => {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`password too short (min ${MIN_PASSWORD_LENGTH} chars)`);
  }
};

const validateUsername = (username: string): string => {
  const trimmed = (username ?? '').trim();
  if (!trimmed) throw new Error('username is required');
  return trimmed;
};

export const createUser = async (
  username: string,
  password: string,
  role: Role = 'user',
  mustChangePassword = true,
): Promise<PublicUser> => {
  const trimmed = validateUsername(username);
  validatePassword(password);
  if (findUser(trimmed)) {
    throw new Error('username already exists');
  }
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user: User = {
    username: trimmed,
    passwordHash,
    role,
    createdAt: new Date().toISOString(),
    mustChangePassword,
  };
  users.push(user);
  await persist();
  return toPublic(user);
};

export const changeOwnPassword = async (
  username: string,
  currentPassword: string,
  newPassword: string,
): Promise<PublicUser> => {
  const user = findUser(username);
  if (!user) throw new Error('user not found');
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw new Error('current password incorrect');
  validatePassword(newPassword);
  user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  user.mustChangePassword = false;
  await persist();
  return toPublic(user);
};

export const adminResetPassword = async (
  targetUsername: string,
  newPassword: string,
): Promise<PublicUser> => {
  const user = findUser(targetUsername);
  if (!user) throw new Error('user not found');
  validatePassword(newPassword);
  user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  user.mustChangePassword = true;
  await persist();
  return toPublic(user);
};

const countRoots = (): number => users.filter((u) => u.role === 'root').length;

export const deleteUser = async (targetUsername: string): Promise<void> => {
  const idx = users.findIndex((u) => u.username === targetUsername);
  if (idx === -1) throw new Error('user not found');
  const target = users[idx]!;
  if (target.role === 'root' && countRoots() <= 1) {
    throw new Error('cannot delete the last root user');
  }
  users.splice(idx, 1);
  await persist();
};
