import { UserRepository, userRepository } from '../repositories/user.repository.js';
import { RegisterInput, LoginInput } from '../schemas/auth.schema.js';
import { hashPassword, verifyPassword } from '../common/utils/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../common/utils/jwt.js';
import { ConflictError, UnauthorizedError } from '../common/errors/app-error.js';
import { UserRoles, UserResponseDto } from '../types/auth.types.js';

export interface AuthResult {
  user: UserResponseDto;
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  constructor(private readonly userRepo: UserRepository = userRepository) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) {
      throw new ConflictError('An account with this email address already exists');
    }

    const hashedPassword = await hashPassword(input.password);

    // Business rule: public registrations are ALWAYS GUEST, never allow client-supplied roles
    const user = await this.userRepo.create({
      name: input.name,
      email: input.email,
      passwordHash: hashedPassword,
      role: UserRoles.GUEST,
    });

    const accessToken = signAccessToken({
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    const refreshToken = signRefreshToken({
      sub: user._id.toString(),
    });

    const refreshTokenHash = await hashPassword(refreshToken);
    await this.userRepo.updateRefreshTokenHash(user._id.toString(), refreshTokenHash);

    return {
      user: user.toDto(),
      accessToken,
      refreshToken,
    };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.userRepo.findByEmailWithPassword(input.email);
    if (!user || !user.isActive) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isPasswordValid = await verifyPassword(user.passwordHash, input.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const accessToken = signAccessToken({
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    const refreshToken = signRefreshToken({
      sub: user._id.toString(),
    });

    const refreshTokenHash = await hashPassword(refreshToken);
    await this.userRepo.updateRefreshTokenHash(user._id.toString(), refreshTokenHash);

    return {
      user: user.toDto(),
      accessToken,
      refreshToken,
    };
  }

  async refresh(token: string): Promise<AuthResult> {
    const decoded = verifyRefreshToken(token);

    const user = await this.userRepo.findByIdWithRefreshToken(decoded.sub);
    if (!user || !user.isActive || !user.refreshTokenHash) {
      throw new UnauthorizedError('Invalid or expired refresh session');
    }

    const isMatch = await verifyPassword(user.refreshTokenHash, token);
    if (!isMatch) {
      // Possible token reuse or revoked session: clear existing hash to force relogin
      await this.userRepo.updateRefreshTokenHash(user._id.toString(), null);
      throw new UnauthorizedError('Invalid or reused refresh token');
    }

    // Token rotation: generate new access token and new refresh token
    const newAccessToken = signAccessToken({
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    const newRefreshToken = signRefreshToken({
      sub: user._id.toString(),
    });

    const newRefreshTokenHash = await hashPassword(newRefreshToken);
    await this.userRepo.updateRefreshTokenHash(user._id.toString(), newRefreshTokenHash);

    return {
      user: user.toDto(),
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(userId?: string): Promise<void> {
    if (userId) {
      await this.userRepo.updateRefreshTokenHash(userId, null);
    }
  }

  async getCurrentUser(userId: string): Promise<UserResponseDto> {
    const user = await this.userRepo.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError('User account not found or has been deactivated');
    }
    return user.toDto();
  }
}

export const authService = new AuthService();
