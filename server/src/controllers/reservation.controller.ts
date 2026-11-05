import { Request, Response, NextFunction } from 'express';
import { reservationService } from '../services/reservation.service.js';
import { sendSuccess } from '../common/utils/api-response.js';
import { UnauthorizedError } from '../common/errors/app-error.js';

export class ReservationController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('User authentication required');
      }

      const idempotencyKey =
        (req.headers['idempotency-key'] as string | undefined) ||
        (req.body.idempotencyKey as string | undefined);

      const result = await reservationService.createReservation(
        req.user.id,
        req.body,
        idempotencyKey,
      );

      const statusCode = result.isDuplicate ? 200 : 201;
      sendSuccess(res, result.reservation, statusCode);
    } catch (error) {
      next(error);
    }
  }

  async getMyReservations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('User authentication required');
      }

      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 10;

      const result = await reservationService.listGuestReservations(req.user.id, page, limit);

      sendSuccess(res, result.data, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('User authentication required');
      }

      const reservation = await reservationService.getReservation(
        req.params.id!,
        req.user.id,
        req.user.role,
      );

      sendSuccess(res, { reservation }, 200);
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('User authentication required');
      }

      const cancelled = await reservationService.cancelReservation(
        req.params.id!,
        req.user.id,
        req.user.role,
        req.body,
      );

      sendSuccess(res, { reservation: cancelled }, 200);
    } catch (error) {
      next(error);
    }
  }
}

export const reservationController = new ReservationController();
