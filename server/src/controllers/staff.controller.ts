import { Request, Response, NextFunction } from 'express';
import { staffService } from '../services/staff.service.js';
import { sendSuccess } from '../common/utils/api-response.js';
import { UnauthorizedError } from '../common/errors/app-error.js';

export class StaffController {
  async getDashboard(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await staffService.getDashboardSummary();
      sendSuccess(res, summary, 200);
    } catch (error) {
      next(error);
    }
  }

  async listReservations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const status = req.query.status as string | undefined;
      const checkInFrom = req.query.checkInFrom as string | undefined;
      const checkInTo = req.query.checkInTo as string | undefined;
      const search = req.query.search as string | undefined;
      const sortBy =
        (req.query.sortBy as 'createdAt' | 'checkIn' | 'checkOut' | 'totalAmount') || 'createdAt';
      const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';

      const result = await staffService.listReservations({
        page,
        limit,
        status,
        checkInFrom,
        checkInTo,
        search,
        sortBy,
        sortOrder,
      });

      sendSuccess(res, result.data, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async checkIn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const updated = await staffService.checkIn(req.params.id!, req.user.id);
      sendSuccess(res, { reservation: updated }, 200);
    } catch (error) {
      next(error);
    }
  }

  async checkOut(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const updated = await staffService.checkOut(req.params.id!, req.user.id);
      sendSuccess(res, { reservation: updated }, 200);
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const updated = await staffService.updateStatus(req.params.id!, req.body, req.user.id);

      sendSuccess(res, { reservation: updated }, 200);
    } catch (error) {
      next(error);
    }
  }
}

export const staffController = new StaffController();
