import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { User } from '../../src/models/user.model.js';
import { UserRoles } from '../../src/types/auth.types.js';
import { hashPassword } from '../../src/common/utils/password.js';

describe('Authentication and RBAC Endpoints', () => {
  const validGuestPayload = {
    name: 'Alice Wonder',
    email: 'alice@example.com',
    password: 'Password123',
  };

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user with strictly GUEST role and return tokens', async () => {
      const res = await request(app).post('/api/v1/auth/register').send(validGuestPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toMatchObject({
        name: 'Alice Wonder',
        email: 'alice@example.com',
        role: UserRoles.GUEST,
      });
      expect(res.body.data.accessToken).toBeDefined();

      // Verify httpOnly cookie was set
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieStr = Array.isArray(cookies) ? cookies.join(';') : String(cookies);
      expect(cookieStr).toContain('refreshToken=');
      expect(cookieStr).toContain('HttpOnly');
    });

    it('should NEVER allow client to register as ADMIN or STAFF (enforces GUEST)', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Hacker Joe',
        email: 'hacker@example.com',
        password: 'Password123',
        role: 'ADMIN', // Attacker attempts privilege escalation
      });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe(UserRoles.GUEST);

      // Verify in DB directly
      const savedUser = await User.findOne({ email: 'hacker@example.com' });
      expect(savedUser?.role).toBe(UserRoles.GUEST);
    });

    it('should reject registration when email already exists with 409 Conflict', async () => {
      // First registration
      await request(app).post('/api/v1/auth/register').send({
        name: 'First User',
        email: 'duplicate@example.com',
        password: 'Password123',
      });

      // Second registration with identical email
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Second User',
        email: 'duplicate@example.com',
        password: 'Password123',
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('should reject invalid password format with 422 ValidationError', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'short', // Too short and no number
      });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      // Seed a user for login tests
      await request(app).post('/api/v1/auth/register').send(validGuestPayload);
    });

    it('should log in successfully with valid credentials', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: validGuestPayload.email,
        password: validGuestPayload.password,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(validGuestPayload.email);
      expect(res.body.data.accessToken).toBeDefined();

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
    });

    it('should reject login with wrong password (401 Unauthorized)', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: validGuestPayload.email,
        password: 'WrongPassword999',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject non-existent user with generic 401 to prevent enumeration', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'nobody@example.com',
        password: 'Password123',
      });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Invalid email or password');
    });
  });

  describe('POST /api/v1/auth/refresh and logout', () => {
    it('should rotate tokens when valid refresh cookie is provided', async () => {
      // 1. Register to obtain initial cookie
      const regRes = await request(app).post('/api/v1/auth/register').send(validGuestPayload);

      const cookieHeader = regRes.headers['set-cookie'];
      expect(cookieHeader).toBeDefined();

      // 2. Call refresh endpoint with cookie
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookieHeader!);

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.success).toBe(true);
      expect(refreshRes.body.data.accessToken).toBeDefined();
      expect(refreshRes.headers['set-cookie']).toBeDefined();
    });

    it('should reject refresh without cookie (401 Unauthorized)', async () => {
      const res = await request(app).post('/api/v1/auth/refresh');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should clear cookie and invalidate refresh session on logout', async () => {
      const regRes = await request(app).post('/api/v1/auth/register').send(validGuestPayload);

      const token = regRes.body.data.accessToken;
      const cookieHeader = regRes.headers['set-cookie'];

      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', cookieHeader!);

      expect(logoutRes.status).toBe(200);

      // Verify that after logout, refreshing fails
      const postLogoutRefresh = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookieHeader!);

      expect(postLogoutRefresh.status).toBe(401);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return profile for authenticated user', async () => {
      const regRes = await request(app).post('/api/v1/auth/register').send(validGuestPayload);

      const token = regRes.body.data.accessToken;

      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.data.user.email).toBe(validGuestPayload.email);
    });

    it('should reject request without Authorization header (401)', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });
  });

  describe('RBAC Route Protection (Guest vs Staff)', () => {
    it('should reject unauthenticated request to staff endpoint (401)', async () => {
      const res = await request(app).get('/api/v1/staff-test');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject Guest accessing staff endpoint (403 Forbidden)', async () => {
      // Register guest
      const regRes = await request(app).post('/api/v1/auth/register').send(validGuestPayload);

      const guestToken = regRes.body.data.accessToken;

      const res = await request(app)
        .get('/api/v1/staff-test')
        .set('Authorization', `Bearer ${guestToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should ALLOW Staff member to access staff endpoint (200 OK)', async () => {
      // Seed a staff user directly into DB
      const pwHash = await hashPassword('StaffPassword123');
      const staffUser = await User.create({
        name: 'Staff Bob',
        email: 'staff.bob@hotel.com',
        passwordHash: pwHash,
        role: UserRoles.STAFF,
      });

      // Login as staff
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: 'staff.bob@hotel.com',
        password: 'StaffPassword123',
      });

      const staffToken = loginRes.body.data.accessToken;

      const res = await request(app)
        .get('/api/v1/staff-test')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Staff access granted');
      expect(res.body.data.user.id).toBe(staffUser._id.toString());
    });

    it('should ALLOW Admin to access staff endpoint (role inheritance 200 OK)', async () => {
      // Seed an admin user directly into DB
      const pwHash = await hashPassword('AdminPassword123');
      await User.create({
        name: 'Admin Boss',
        email: 'admin.boss@hotel.com',
        passwordHash: pwHash,
        role: UserRoles.ADMIN,
      });

      // Login as admin
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: 'admin.boss@hotel.com',
        password: 'AdminPassword123',
      });

      const adminToken = loginRes.body.data.accessToken;

      const res = await request(app)
        .get('/api/v1/staff-test')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Staff access granted');
    });
  });
});
