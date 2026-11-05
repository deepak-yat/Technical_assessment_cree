import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { validateRequest } from '../common/middleware/validate.js';
import { registerSchema, loginSchema } from '../schemas/auth.schema.js';
import { authenticate } from '../common/middleware/auth.js';
import { authRateLimiter } from '../common/middleware/rate-limiter.js';

const router = Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user account (strictly GUEST role)
 * @access  Public
 */
router.post('/register', authRateLimiter, validateRequest(registerSchema), (req, res, next) =>
  authController.register(req, res, next),
);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticate user and return JWT access token + httpOnly refresh cookie
 * @access  Public
 */
router.post('/login', authRateLimiter, validateRequest(loginSchema), (req, res, next) =>
  authController.login(req, res, next),
);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Exchange valid refresh token (from httpOnly cookie) for a new access token
 * @access  Public (Requires valid refresh token)
 */
router.post('/refresh', (req, res, next) => authController.refresh(req, res, next));

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Revoke refresh token and clear cookie
 * @access  Public / Authenticated
 */
router.post('/logout', (req, res, next) => authController.logout(req, res, next));

/**
 * @route   GET /api/v1/auth/me
 * @desc    Retrieve profile of the currently logged-in user
 * @access  Private (Requires valid access token)
 */
router.get('/me', authenticate, (req, res, next) => authController.me(req, res, next));

export const authRoutes = router;
