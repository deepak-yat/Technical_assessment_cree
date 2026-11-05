import mongoose, { Document, Model, Schema } from 'mongoose';
import { UserRole, UserRoles, UserResponseDto } from '../types/auth.types.js';

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  refreshTokenHash?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDocument extends IUser, Document {
  toDto(): UserResponseDto;
}

export type IUserModel = Model<IUserDocument>;

const userSchema = new Schema<IUserDocument, IUserModel>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
      index: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false, // Never returned in default queries
    },
    role: {
      type: String,
      enum: {
        values: Object.values(UserRoles),
        message: '{VALUE} is not a valid user role',
      },
      default: UserRoles.GUEST,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    refreshTokenHash: {
      type: String,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.methods.toDto = function (): UserResponseDto {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    isActive: this.isActive,
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString(),
  };
};

export const User = mongoose.model<IUserDocument, IUserModel>('User', userSchema);
