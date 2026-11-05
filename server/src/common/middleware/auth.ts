import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { UnauthorizedError, ForbiddenError } from '../errors/app-error.js';
import { UserRole, UserRoles, AuthUserPayload } from '../../types/auth.types.js';
import { userRepository } from '../../repositories/user.repository.js';

/**
 * Middleware that verifies the Bearer JWT access token from the Authorization header.
 * Attaches the authenticated user payload to `req.user`.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(
      new UnauthorizedError('Access token is missing or malformed (expected Bearer token)'),
    );
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return next(new UnauthorizedError('Access token is missing'));
  }

  try {
    const decoded = verifyAccessToken(token);

    // Verify user still exists in database and has not been deactivated
    const user = await userRepository.findById(decoded.sub);
    if (!user || !user.isActive) {
      return next(new UnauthorizedError('User account not found or has been deactivated'));
    }

    const authUser: AuthUserPayload = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    };

    req.user = authUser;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Role-Based Access Control (RBAC) middleware.
 * Ensures the authenticated user possesses one of the required roles.
 * Note: ADMIN role inherently holds all STAFF permissions.
 */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required before authorization check'));
    }

    // Role inheritance: ADMIN inherits STAFF privileges
    const permittedRoles = new Set<UserRole>(allowedRoles);
    if (permittedRoles.has(UserRoles.STAFF)) {
      permittedRoles.add(UserRoles.ADMIN);
    }

    if (!permittedRoles.has(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access forbidden: required role [${allowedRoles.join(', ')}], current role is [${req.user.role}]`,
        ),
      );
    }

    next();
  };
}
