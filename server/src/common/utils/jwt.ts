import jwt from 'jsonwebtoken';
import { config } from '../../config/env.js';
import { JwtAccessPayload, JwtRefreshPayload } from '../../types/auth.types.js';
import { UnauthorizedError } from '../errors/app-error.js';

export function signAccessToken(payload: JwtAccessPayload): string {
  return jwt.sign(payload, config.JWT_ACCESS_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function signRefreshToken(payload: JwtRefreshPayload): string {
  return jwt.sign(payload, config.JWT_REFRESH_SECRET, {
    expiresIn: config.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): JwtAccessPayload {
  try {
    const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET);
    return decoded as JwtAccessPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Access token has expired');
    }
    throw new UnauthorizedError('Invalid access token');
  }
}

export function verifyRefreshToken(token: string): JwtRefreshPayload {
  try {
    const decoded = jwt.verify(token, config.JWT_REFRESH_SECRET);
    return decoded as JwtRefreshPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Refresh token has expired');
    }
    throw new UnauthorizedError('Invalid refresh token');
  }
}
