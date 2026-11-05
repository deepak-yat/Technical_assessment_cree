import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IRoomInventory {
  roomTypeId: Types.ObjectId;
  date: string; // ISO format: YYYY-MM-DD
  capacity: number;
  booked: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRoomInventoryDocument extends IRoomInventory, Document {}

export type IRoomInventoryModel = Model<IRoomInventoryDocument>;

const roomInventorySchema = new Schema<IRoomInventoryDocument, IRoomInventoryModel>(
  {
    roomTypeId: {
      type: Schema.Types.ObjectId,
      ref: 'RoomType',
      required: [true, 'roomTypeId is required'],
      index: true,
    },
    date: {
      type: String,
      required: [true, 'Date string is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'],
    },
    capacity: {
      type: Number,
      required: [true, 'Capacity is required'],
      min: [0, 'Capacity cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Capacity must be an integer',
      },
    },
    booked: {
      type: Number,
      default: 0,
      min: [0, 'Booked count cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Booked count must be an integer',
      },
    },
  },
  {
    timestamps: true,
  },
);

// CRITICAL UNIQUE COMPOUND INDEX: guarantees exactly one inventory record per room type per day
roomInventorySchema.index({ roomTypeId: 1, date: 1 }, { unique: true });

// Index for date range queries across room types
roomInventorySchema.index({ date: 1 });

export const RoomInventory = mongoose.model<IRoomInventoryDocument, IRoomInventoryModel>(
  'RoomInventory',
  roomInventorySchema,
);
