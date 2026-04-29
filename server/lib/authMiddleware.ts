import type { Request, Response, NextFunction } from 'express';
import { verifyToken, type PublicUser } from './auth.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: PublicUser;
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'authentication required' });
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  const user = verifyToken(token);
  if (!user) {
    res.status(401).json({ success: false, error: 'invalid or expired token' });
    return;
  }
  req.user = user;
  next();
};
