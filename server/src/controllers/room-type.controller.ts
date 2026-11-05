import { Request, Response, NextFunction } from 'express';
import { roomTypeService } from '../services/room-type.service.js';
import { sendSuccess } from '../common/utils/api-response.js';

export class RoomTypeController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const roomType = await roomTypeService.create(req.body);
      sendSuccess(res, { roomType }, 201);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const roomType = await roomTypeService.getById(req.params.id!);
      sendSuccess(res, { roomType }, 200);
    } catch (error) {
      next(error);
    }
  }

  async listPublic(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const result = await roomTypeService.list({ page, limit }, true);
      sendSuccess(res, result.data, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async listStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const isActive =
        req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;

      const result = await roomTypeService.list({ page, limit, isActive }, false);
      sendSuccess(res, result.data, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const roomType = await roomTypeService.update(req.params.id!, req.body);
      sendSuccess(res, { roomType }, 200);
    } catch (error) {
      next(error);
    }
  }

  async setStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const isActive = Boolean(req.body.isActive);
      const roomType = await roomTypeService.setStatus(req.params.id!, isActive);
      sendSuccess(res, { roomType }, 200);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await roomTypeService.delete(req.params.id!);
      sendSuccess(res, { message: 'Room type deleted successfully' }, 200);
    } catch (error) {
      next(error);
    }
  }

  async searchAvailability(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const results = await roomTypeService.searchAvailability({
        checkIn: req.query.checkIn as string,
        checkOut: req.query.checkOut as string,
        guests: req.query.guests ? Number(req.query.guests) : 1,
        rooms: req.query.rooms ? Number(req.query.rooms) : 1,
      });
      sendSuccess(res, results, 200);
    } catch (error) {
      next(error);
    }
  }
}

export const roomTypeController = new RoomTypeController();
