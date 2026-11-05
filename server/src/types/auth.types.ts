export const UserRoles = {
  GUEST: 'GUEST',
  STAFF: 'STAFF',
  ADMIN: 'ADMIN',
} as const;

export type UserRole = (typeof UserRoles)[keyof typeof UserRoles];

export interface AuthUserPayload {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}

export interface JwtAccessPayload {
  sub: string; // User ID
  email: string;
  role: UserRole;
}

export interface JwtRefreshPayload {
  sub: string; // User ID
  tokenVersion?: number;
}

export interface UserResponseDto {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
