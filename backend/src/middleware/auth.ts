import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { appError } from './errorHandler';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  organizationId: string;
  branchId?: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export function authenticate(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw appError('UNAUTHORIZED', 'Token not provided', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret) as AuthUser;
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return next(appError('UNAUTHORIZED', 'Invalid token', 401));
    }
    next(error);
  }
}

export function authorize(...roles: string[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(appError('UNAUTHORIZED', 'Not authenticated', 401));
    }
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return next(appError('FORBIDDEN', 'Insufficient permissions', 403));
    }
    next();
  };
}
