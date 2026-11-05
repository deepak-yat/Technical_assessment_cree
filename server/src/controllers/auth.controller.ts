import { Request, Response, NextFunction, CookieOptions } from 'express';
import { authService } from '../services/auth.service.js';
import { sendSuccess } from '../common/utils/api-response.js';
import { config } from '../config/env.js';
import { UnauthorizedError } from '../common/errors/app-error.js';
import { verifyRefreshToken } from '../common/utils/jwt.js';

const REFRESH_COOKIE_NAME = 'refreshToken';

const getRefreshCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  path: `${config.API_PREFIX}/auth`,
});

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.register(req.body);

      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());

      sendSuccess(
        res,
        {
          user: result.user,
          accessToken: result.accessToken,
        },
        201,
      );
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.login(req.body);

      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());

      sendSuccess(
        res,
        {
          user: result.user,
          accessToken: result.accessToken,
        },
        200,
      );
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;

      if (!token || typeof token !== 'string') {
        throw new UnauthorizedError('Refresh token is required in cookie or body');
      }

      const result = await authService.refresh(token);

      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());

      sendSuccess(
        res,
        {
          user: result.user,
          accessToken: result.accessToken,
        },
        200,
      );
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let userId = req.user?.id;

      // If req.user is not set by auth middleware, attempt to extract user ID from the refresh token
      if (!userId) {
        const token = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
        if (token && typeof token === 'string') {
          try {
            const decoded = verifyRefreshToken(token);
            userId = decoded.sub;
          } catch {
            // Invalid/expired token: we will still clear the cookie below
          }
        }
      }

      if (userId) {
        await authService.logout(userId);
      }

      res.clearCookie(REFRESH_COOKIE_NAME, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: 'lax',
        path: `${config.API_PREFIX}/auth`,
      });

      sendSuccess(res, { message: 'Logged out successfully' }, 200);
    } catch (error) {
      next(error);
    }
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('User is not authenticated');
      }

      const user = await authService.getCurrentUser(req.user.id);
      sendSuccess(res, { user }, 200);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
