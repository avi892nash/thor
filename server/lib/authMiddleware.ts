import type { Request, Response, NextFunction } from 'express';
import { verifyToken, type DecodedToken } from './auth.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: DecodedToken;
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

export const requireRoot = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'authentication required' });
    return;
  }
  if (req.user.role !== 'root') {
    res.status(403).json({ success: false, error: 'forbidden — root only' });
    return;
  }
  next();
};
