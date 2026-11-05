import { User, IUserDocument } from '../models/user.model.js';
import { UserRole } from '../types/auth.types.js';

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  role?: UserRole;
}

export class UserRepository {
  async findById(id: string): Promise<IUserDocument | null> {
    return User.findById(id).exec();
  }

  async findByEmail(email: string): Promise<IUserDocument | null> {
    return User.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  async findByEmailWithPassword(email: string): Promise<IUserDocument | null> {
    return User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash').exec();
  }

  async findByIdWithRefreshToken(id: string): Promise<IUserDocument | null> {
    return User.findById(id).select('+refreshTokenHash').exec();
  }

  async create(data: CreateUserData): Promise<IUserDocument> {
    const user = new User({
      name: data.name.trim(),
      email: data.email.toLowerCase().trim(),
      passwordHash: data.passwordHash,
      role: data.role,
    });
    return user.save();
  }

  async updateRefreshTokenHash(id: string, refreshTokenHash: string | null): Promise<void> {
    await User.findByIdAndUpdate(id, { refreshTokenHash }).exec();
  }
}

export const userRepository = new UserRepository();
