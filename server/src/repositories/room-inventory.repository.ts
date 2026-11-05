import { RoomInventory, IRoomInventoryDocument } from '../models/room-inventory.model.js';
import mongoose from 'mongoose';

export class RoomInventoryRepository {
  /**
   * Finds the date with the highest booking count on or after `fromDate`
   * where the booked count exceeds the proposed `newCapacity`.
   */
  async findFutureOverbookedRecord(
    roomTypeId: string,
    fromDate: string,
    newCapacity: number,
  ): Promise<IRoomInventoryDocument | null> {
    return RoomInventory.findOne({
      roomTypeId: new mongoose.Types.ObjectId(roomTypeId),
      date: { $gte: fromDate },
      booked: { $gt: newCapacity },
    })
      .sort({ booked: -1, date: 1 })
      .exec();
  }

  /**
   * Synchronizes the capacity field of existing future RoomInventory documents
   * when staff changes a RoomType's total inventory count.
   */
  async syncFutureCapacities(
    roomTypeId: string,
    fromDate: string,
    newCapacity: number,
  ): Promise<void> {
    await RoomInventory.updateMany(
      {
        roomTypeId: new mongoose.Types.ObjectId(roomTypeId),
        date: { $gte: fromDate },
      },
      {
        $set: { capacity: newCapacity },
      },
    ).exec();
  }

  /**
   * Retrieves all inventory documents for a room type across a specific set of dates.
   */
  async findInventoryForDates(
    roomTypeId: string,
    dates: string[],
  ): Promise<IRoomInventoryDocument[]> {
    return RoomInventory.find({
      roomTypeId: new mongoose.Types.ObjectId(roomTypeId),
      date: { $in: dates },
    }).exec();
  }
}

export const roomInventoryRepository = new RoomInventoryRepository();
