import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import {
  ReservationStatus,
  ReservationStatuses,
} from '../common/state/reservation-state-machine.js';

export interface IStatusHistoryEntry {
  fromStatus: ReservationStatus | null;
  toStatus: ReservationStatus;
  changedAt: Date;
  reason?: string;
  changedBy?: Types.ObjectId;
}

export interface IReservation {
  reference: string;
  guest: Types.ObjectId;
  roomType: Types.ObjectId;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  guestCount: number;
  roomCount: number;
  priceSnapshot: number;
  totalAmount: number;
  status: ReservationStatus;
  idempotencyKey?: string | null;
  statusHistory: IStatusHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IReservationDocument extends IReservation, Document {
  toDto(): ReservationResponseDto;
}

export type IReservationModel = Model<IReservationDocument>;

export interface ReservationResponseDto {
  id: string;
  reference: string;
  guestId: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  roomCount: number;
  priceSnapshot: number;
  totalAmount: number;
  status: ReservationStatus;
  idempotencyKey?: string | null;
  statusHistory: {
    fromStatus: ReservationStatus | null;
    toStatus: ReservationStatus;
    changedAt: string;
    reason?: string;
    changedBy?: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

const statusHistorySchema = new Schema<IStatusHistoryEntry>(
  {
    fromStatus: {
      type: String,
      enum: [...Object.values(ReservationStatuses), null],
      default: null,
    },
    toStatus: {
      type: String,
      enum: Object.values(ReservationStatuses),
      required: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    reason: {
      type: String,
      trim: true,
    },
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { _id: false },
);

const reservationSchema = new Schema<IReservationDocument, IReservationModel>(
  {
    reference: {
      type: String,
      required: [true, 'Reference is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    guest: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Guest user reference is required'],
      index: true,
    },
    roomType: {
      type: Schema.Types.ObjectId,
      ref: 'RoomType',
      required: [true, 'RoomType reference is required'],
      index: true,
    },
    checkIn: {
      type: String,
      required: [true, 'Check-in date is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Check-in date must be formatted as YYYY-MM-DD'],
      index: true,
    },
    checkOut: {
      type: String,
      required: [true, 'Check-out date is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Check-out date must be formatted as YYYY-MM-DD'],
      index: true,
    },
    guestCount: {
      type: Number,
      required: [true, 'Guest count is required'],
      min: [1, 'Guest count must be at least 1'],
      validate: {
        validator: Number.isInteger,
        message: 'Guest count must be an integer',
      },
    },
    roomCount: {
      type: Number,
      required: [true, 'Room count is required'],
      default: 1,
      min: [1, 'Room count must be at least 1'],
      validate: {
        validator: Number.isInteger,
        message: 'Room count must be an integer',
      },
    },
    priceSnapshot: {
      type: Number,
      required: [true, 'Price snapshot is required'],
      min: [0, 'Price snapshot cannot be negative'],
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount cannot be negative'],
    },
    status: {
      type: String,
      enum: Object.values(ReservationStatuses),
      default: ReservationStatuses.CONFIRMED,
      index: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      default: null,
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

// Compound Unique Index: Prevents double booking for the same guest and idempotency key
reservationSchema.index(
  { guest: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);

// Compound Index: For guest's paginated reservation queries (stable sort)
reservationSchema.index({ guest: 1, createdAt: -1, _id: -1 });

// Compound Index: For staff reservation filtering by status and date range
reservationSchema.index({ status: 1, checkIn: 1, createdAt: -1 });

// Compound Indexes for front-desk dashboard: Arrivals & Departures today
reservationSchema.index({ checkIn: 1, status: 1 });
reservationSchema.index({ checkOut: 1, status: 1 });

reservationSchema.methods.toDto = function (): ReservationResponseDto {
  return {
    id: this._id.toString(),
    reference: this.reference,
    guestId: this.guest.toString(),
    roomTypeId: this.roomType.toString(),
    checkIn: this.checkIn,
    checkOut: this.checkOut,
    guestCount: this.guestCount,
    roomCount: this.roomCount,
    priceSnapshot: this.priceSnapshot,
    totalAmount: this.totalAmount,
    status: this.status,
    idempotencyKey: this.idempotencyKey || null,
    statusHistory: this.statusHistory.map((h: IStatusHistoryEntry) => ({
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      changedAt: h.changedAt.toISOString(),
      reason: h.reason,
      changedBy: h.changedBy ? h.changedBy.toString() : undefined,
    })),
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString(),
  };
};

export const Reservation = mongoose.model<IReservationDocument, IReservationModel>(
  'Reservation',
  reservationSchema,
);
