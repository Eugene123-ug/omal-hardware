import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError, ForbiddenError } from '../common/errors';
import { getConfig } from '../config/env';

export interface AuthenticatedUser {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
  branchIds: number[];
  primaryBranchId?: number;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Authentication token required');
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    throw new UnauthorizedError('Malformed authorization header');
  }

  try {
    const config = getConfig();
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    req.user = {
      id: Number(decoded.sub),
      username: decoded.username,
      email: decoded.email,
      fullName: decoded.fullName,
      role: decoded.role,
      branchIds: decoded.branchIds || [],
      primaryBranchId: decoded.primaryBranchId ? Number(decoded.primaryBranchId) : undefined,
      permissions: Array.isArray(decoded.permissions) ? decoded.permissions : [],
    };
    next();
  } catch (err: any) {
    throw new UnauthorizedError('Invalid or expired authentication token');
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }
    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError(`Access denied: requires role ${roles.join(' or ')}`);
    }
    next();
  };
}

export function requirePermission(...requiredPerms: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }
    // Owner and IT Administrator have full access to everything
    if (req.user.role === 'owner' || req.user.role === 'administrator') {
      return next();
    }
    const userPerms = req.user.permissions || [];
    const hasAccess = requiredPerms.some((perm) => userPerms.includes(perm));
    if (!hasAccess) {
      throw new ForbiddenError(
        `Access denied: Your account lacks required permission [${requiredPerms.join(' or ')}]`,
      );
    }
    next();
  };
}
