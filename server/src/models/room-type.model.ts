import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IRoomType {
  name: string;
  description: string;
  capacity: number;
  facilities: string[];
  pricePerNight: number;
  totalInventory: number;
  isActive: boolean;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRoomTypeDocument extends IRoomType, Document {
  toDto(): RoomTypeResponseDto;
}

export type IRoomTypeModel = Model<IRoomTypeDocument>;

export interface RoomTypeResponseDto {
  id: string;
  name: string;
  description: string;
  capacity: number;
  facilities: string[];
  pricePerNight: number;
  totalInventory: number;
  isActive: boolean;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

const roomTypeSchema = new Schema<IRoomTypeDocument, IRoomTypeModel>(
  {
    name: {
      type: String,
      required: [true, 'Room type name is required'],
      unique: true,
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    capacity: {
      type: Number,
      required: [true, 'Capacity is required'],
      min: [1, 'Capacity must be at least 1 person'],
      max: [20, 'Capacity cannot exceed 20 persons'],
      validate: {
        validator: Number.isInteger,
        message: 'Capacity must be an integer',
      },
    },
    facilities: {
      type: [String],
      default: [],
    },
    pricePerNight: {
      type: Number,
      required: [true, 'Price per night is required'],
      min: [0, 'Price per night cannot be negative'],
    },
    totalInventory: {
      type: Number,
      required: [true, 'Total inventory count is required'],
      min: [1, 'Total inventory must be at least 1 room'],
      validate: {
        validator: Number.isInteger,
        message: 'Total inventory must be an integer',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    imageUrl: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// Compound index for availability search: filter active rooms by capacity
roomTypeSchema.index({ isActive: 1, capacity: 1 });

// Stable pagination index
roomTypeSchema.index({ createdAt: -1, _id: -1 });

roomTypeSchema.methods.toDto = function (): RoomTypeResponseDto {
  return {
    id: this._id.toString(),
    name: this.name,
    description: this.description,
    capacity: this.capacity,
    facilities: this.facilities,
    pricePerNight: this.pricePerNight,
    totalInventory: this.totalInventory,
    isActive: this.isActive,
    imageUrl: this.imageUrl || undefined,
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString(),
  };
};

export const RoomType = mongoose.model<IRoomTypeDocument, IRoomTypeModel>(
  'RoomType',
  roomTypeSchema,
);
