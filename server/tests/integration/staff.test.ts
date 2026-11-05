import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { User } from '../../src/models/user.model.js';
import { RoomType } from '../../src/models/room-type.model.js';
import { RoomInventory } from '../../src/models/room-inventory.model.js';
import { Reservation } from '../../src/models/reservation.model.js';
import { UserRoles } from '../../src/types/auth.types.js';
import { hashPassword } from '../../src/common/utils/password.js';
import { getTodayUtcString } from '../../src/common/utils/date.js';

describe('Staff Operations & Front-Desk Management', () => {
  let staffToken: string;
  let guestToken: string;
  let guestUser: InstanceType<typeof User>;
  let roomType: InstanceType<typeof RoomType>;
  let today: string;

  beforeEach(async () => {
    today = getTodayUtcString();

    // 1. Seed Staff User
    const staffHash = await hashPassword('StaffPass123');
    await User.create({
      name: 'FrontDesk Staff',
      email: 'staff.frontdesk@hotel.com',
      passwordHash: staffHash,
      role: UserRoles.STAFF,
    });

    const staffLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'staff.frontdesk@hotel.com',
      password: 'StaffPass123',
    });
    staffToken = staffLogin.body.data.accessToken;

    // 2. Seed Guest User
    const guestHash = await hashPassword('GuestPass123');
    guestUser = await User.create({
      name: 'Charlie Brown',
      email: 'charlie@example.com',
      passwordHash: guestHash,
      role: UserRoles.GUEST,
    });

    const guestLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'charlie@example.com',
      password: 'GuestPass123',
    });
    guestToken = guestLogin.body.data.accessToken;

    // 3. Seed Room Type (total inventory = 10)
    roomType = await RoomType.create({
      name: 'Deluxe City View',
      description: 'City view room',
      capacity: 2,
      facilities: ['WiFi', 'City View'],
      pricePerNight: 150,
      totalInventory: 10,
      isActive: true,
    });
  });

  describe('GET /api/v1/staff/dashboard (KPI Summaries)', () => {
    it('should reject Guest from accessing staff dashboard (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/staff/dashboard')
        .set('Authorization', `Bearer ${guestToken}`);

      expect(res.status).toBe(403);
    });

    it('should calculate accurate dashboard KPIs for today', async () => {
      const [y, m, d] = today.split('-').map(Number);
      const tomorrow = new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().split('T')[0]!;
      const yesterday = new Date(Date.UTC(y!, m! - 1, d! - 1)).toISOString().split('T')[0]!;

      // 1. Arrival today (checkIn = today, status = CONFIRMED)
      await Reservation.create({
        reference: 'RES-ARR1-TODAY',
        guest: guestUser._id,
        roomType: roomType._id,
        checkIn: today,
        checkOut: tomorrow,
        guestCount: 1,
        roomCount: 1,
        priceSnapshot: 150,
        totalAmount: 150,
        status: 'CONFIRMED',
      });

      // 2. Departure today (checkOut = today, status = CHECKED_IN)
      await Reservation.create({
        reference: 'RES-DEP1-TODAY',
        guest: guestUser._id,
        roomType: roomType._id,
        checkIn: yesterday,
        checkOut: today,
        guestCount: 2,
        roomCount: 2,
        priceSnapshot: 150,
        totalAmount: 300,
        status: 'CHECKED_IN',
      });

      // 3. Occupied room (status = CHECKED_IN, checking out tomorrow)
      await Reservation.create({
        reference: 'RES-OCC1-ACTIVE',
        guest: guestUser._id,
        roomType: roomType._id,
        checkIn: today,
        checkOut: tomorrow,
        guestCount: 1,
        roomCount: 1,
        priceSnapshot: 150,
        totalAmount: 150,
        status: 'CHECKED_IN',
      });

      // 4. Pending reservation
      await Reservation.create({
        reference: 'RES-PEN1-ACTIVE',
        guest: guestUser._id,
        roomType: roomType._id,
        checkIn: tomorrow,
        checkOut: tomorrow,
        guestCount: 1,
        roomCount: 1,
        priceSnapshot: 150,
        totalAmount: 150,
        status: 'PENDING',
      });

      const res = await request(app)
        .get('/api/v1/staff/dashboard')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        today,
        arrivalsToday: 1,
        departuresToday: 1,
        occupiedRooms: 3, // 2 rooms from dep + 1 from occ = 3 occupied
        totalRooms: 10,
        occupancyRate: 30, // 3/10 * 100 = 30%
        pendingReservations: 1,
      });
    });
  });

  describe('GET /api/v1/staff/reservations (Filter, Search & Pagination)', () => {
    beforeEach(async () => {
      const [y, m, d] = today.split('-').map(Number);
      const d1 = new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().split('T')[0]!;
      const d2 = new Date(Date.UTC(y!, m! - 1, d! + 3)).toISOString().split('T')[0]!;

      await Reservation.create([
        {
          reference: 'RES-SRCH-ALICE',
          guest: guestUser._id,
          roomType: roomType._id,
          checkIn: d1,
          checkOut: d2,
          guestCount: 1,
          roomCount: 1,
          priceSnapshot: 150,
          totalAmount: 300,
          status: 'CONFIRMED',
        },
        {
          reference: 'RES-SRCH-BOBBY',
          guest: guestUser._id,
          roomType: roomType._id,
          checkIn: d2,
          checkOut: d2,
          guestCount: 2,
          roomCount: 1,
          priceSnapshot: 150,
          totalAmount: 150,
          status: 'CHECKED_IN',
        },
      ]);
    });

    it('should list all reservations with pagination and populated details', async () => {
      const res = await request(app)
        .get('/api/v1/staff/reservations')
        .set('Authorization', `Bearer ${staffToken}`)
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].guestDetails.email).toBe(guestUser.email);
      expect(res.body.data[0].roomTypeName).toBe(roomType.name);
      expect(res.body.meta.total).toBe(2);
    });

    it('should filter reservations by status', async () => {
      const res = await request(app)
        .get('/api/v1/staff/reservations')
        .set('Authorization', `Bearer ${staffToken}`)
        .query({ status: 'CHECKED_IN' });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].reference).toBe('RES-SRCH-BOBBY');
    });

    it('should search reservations by reference string', async () => {
      const res = await request(app)
        .get('/api/v1/staff/reservations')
        .set('Authorization', `Bearer ${staffToken}`)
        .query({ search: 'ALICE' });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].reference).toBe('RES-SRCH-ALICE');
    });

    it('should search reservations by guest email', async () => {
      const res = await request(app)
        .get('/api/v1/staff/reservations')
        .set('Authorization', `Bearer ${staffToken}`)
        .query({ search: 'charlie@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });
  });

  describe('Front-Desk Check-In & Check-Out Flow', () => {
    it('should allow check-in on or after check-in date', async () => {
      const [y, m, d] = today.split('-').map(Number);
      const tomorrow = new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().split('T')[0]!;

      // Reservation scheduled for today
      const resDoc = await Reservation.create({
        reference: 'RES-CHKIN-VALID',
        guest: guestUser._id,
        roomType: roomType._id,
        checkIn: today,
        checkOut: tomorrow,
        guestCount: 1,
        roomCount: 1,
        priceSnapshot: 150,
        totalAmount: 150,
        status: 'CONFIRMED',
      });

      const res = await request(app)
        .post(`/api/v1/staff/reservations/${resDoc._id.toString()}/check-in`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.reservation.status).toBe('CHECKED_IN');
      expect(res.body.data.reservation.statusHistory.length).toBe(1);
      expect(res.body.data.reservation.statusHistory[0].toStatus).toBe('CHECKED_IN');
    });

    it('should REJECT check-in prior to scheduled check-in date (409 Conflict)', async () => {
      const [y, m, d] = today.split('-').map(Number);
      const futureCheckIn = new Date(Date.UTC(y!, m! - 1, d! + 3)).toISOString().split('T')[0]!;
      const futureCheckOut = new Date(Date.UTC(y!, m! - 1, d! + 5)).toISOString().split('T')[0]!;

      const resDoc = await Reservation.create({
        reference: 'RES-CHKIN-EARLY',
        guest: guestUser._id,
        roomType: roomType._id,
        checkIn: futureCheckIn,
        checkOut: futureCheckOut,
        guestCount: 1,
        roomCount: 1,
        priceSnapshot: 150,
        totalAmount: 300,
        status: 'CONFIRMED',
      });

      const res = await request(app)
        .post(`/api/v1/staff/reservations/${resDoc._id.toString()}/check-in`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('prior to the scheduled check-in date');
    });

    it('should check out guest and release inventory with exactly-once semantics', async () => {
      const [y, m, d] = today.split('-').map(Number);
      const tomorrow = new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().split('T')[0]!;

      // Setup inventory document for today: booked = 1
      await RoomInventory.create({
        roomTypeId: roomType._id,
        date: today,
        capacity: 10,
        booked: 1,
      });

      const resDoc = await Reservation.create({
        reference: 'RES-CHKOUT-TEST',
        guest: guestUser._id,
        roomType: roomType._id,
        checkIn: today,
        checkOut: tomorrow,
        guestCount: 1,
        roomCount: 1,
        priceSnapshot: 150,
        totalAmount: 150,
        status: 'CHECKED_IN', // Currently checked in
      });

      // 1. Perform check-out
      const res = await request(app)
        .post(`/api/v1/staff/reservations/${resDoc._id.toString()}/check-out`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.reservation.status).toBe('CHECKED_OUT');

      // Verify inventory was released (booked decremented from 1 to 0)
      let inv = await RoomInventory.findOne({ roomTypeId: roomType._id, date: today });
      expect(inv?.booked).toBe(0);

      // 2. Second check-out call: must reject with 409
      const secondCall = await request(app)
        .post(`/api/v1/staff/reservations/${resDoc._id.toString()}/check-out`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(secondCall.status).toBe(409);

      // Verify inventory was not double-released (does not become -1)
      inv = await RoomInventory.findOne({ roomTypeId: roomType._id, date: today });
      expect(inv?.booked).toBe(0);
    });

    it('should reject check-out if reservation is not in CHECKED_IN status (409 Conflict)', async () => {
      const [y, m, d] = today.split('-').map(Number);
      const tomorrow = new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().split('T')[0]!;

      const resDoc = await Reservation.create({
        reference: 'RES-NOT-CHKIN',
        guest: guestUser._id,
        roomType: roomType._id,
        checkIn: today,
        checkOut: tomorrow,
        guestCount: 1,
        roomCount: 1,
        priceSnapshot: 150,
        totalAmount: 150,
        status: 'CONFIRMED', // Not checked in yet
      });

      const res = await request(app)
        .post(`/api/v1/staff/reservations/${resDoc._id.toString()}/check-out`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_STATE_TRANSITION');
    });
  });

  describe('PATCH /api/v1/staff/reservations/:id/status (State Machine Endpoint)', () => {
    it('should reject invalid state transition with 409 Conflict', async () => {
      const [y, m, d] = today.split('-').map(Number);
      const tomorrow = new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().split('T')[0]!;

      const resDoc = await Reservation.create({
        reference: 'RES-INVALID-TRANS',
        guest: guestUser._id,
        roomType: roomType._id,
        checkIn: today,
        checkOut: tomorrow,
        guestCount: 1,
        roomCount: 1,
        priceSnapshot: 150,
        totalAmount: 150,
        status: 'CANCELLED', // Terminal state
      });

      const res = await request(app)
        .patch(`/api/v1/staff/reservations/${resDoc._id.toString()}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'CONFIRMED' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_STATE_TRANSITION');
    });
  });
});
