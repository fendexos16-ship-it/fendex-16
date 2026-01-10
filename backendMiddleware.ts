
import { Request, Response, NextFunction } from 'express';
import { UserRole } from './types';

// Mock session/JWT extraction - in production, this decodes the token
export const authenticate = (req: any, res: Response, next: NextFunction) => {
  const userId = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];
  const entityId = req.headers['x-entity-id']; // e.g., LMDC_ID

  if (!userId || !userRole) {
    return res.status(401).json({ success: false, message: "Unauthenticated" });
  }

  req.user = {
    id: userId,
    role: userRole as UserRole,
    linkedEntityId: entityId
  };
  next();
};

export const authorize = (roles: UserRole[]) => {
  return (req: any, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: `Forbidden: Action restricted to ${roles.join(', ')}` 
      });
    }
    next();
  };
};
