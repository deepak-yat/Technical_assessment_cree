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

describe('Reservations & Concurrency Engine', () => {
  let guestTokenA: string;
  let guestIdA: string;
  let guestTokenB: string;
  let roomTypeId: string;
  let stayCheckIn: string;
  let stayCheckOut: string;

  beforeEach(async () => {
    // 1. Create Guest A
    const pwA = await hashPassword('Password123');
    const guestA = await User.create({
      name: 'Alice Guest',
      email: 'alice.guest@example.com',
      passwordHash: pwA,
      role: UserRoles.GUEST,
    });
    guestIdA = guestA._id.toString();

    const loginResA = await request(app).post('/api/v1/auth/login').send({
      email: 'alice.guest@example.com',
      password: 'Password123',
    });
    guestTokenA = loginResA.body.data.accessToken;

    // 2. Create Guest B
    const pwB = await hashPassword('Password123');
    await User.create({
      name: 'Bob Guest',
      email: 'bob.guest@example.com',
      passwordHash: pwB,
      role: UserRoles.GUEST,
    });

    const loginResB = await request(app).post('/api/v1/auth/login').send({
      email: 'bob.guest@example.com',
      password: 'Password123',
    });
    guestTokenB = loginResB.body.data.accessToken;

    // 3. Create Room Type with inventory = 1 (to easily test sold-out & concurrency)
    const room = await RoomType.create({
      name: 'Single Luxury Suite',
      description: 'Exclusive 1-room penthouse',
      capacity: 2,
      facilities: ['WiFi', 'Terrace'],
      pricePerNight: 200,
      totalInventory: 1, // Only 1 room available!
      isActive: true,
    });
    roomTypeId = room._id.toString();

    // 4. Setup stay dates: tomorrow to +3 days (2 nights)
    const today = getTodayUtcString();
    const [y, m, d] = today.split('-').map(Number);
    stayCheckIn = new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().split('T')[0]!;
    stayCheckOut = new Date(Date.UTC(y!, m! - 1, d! + 3)).toISOString().split('T')[0]!;
  });

  describe('POST /api/v1/reservations (Creation & Server-Side Pricing)', () => {
    it('should create reservation with server-computed price and generate reference', async () => {
      const res = await request(app)
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${guestTokenA}`)
        .send({
          roomTypeId,
          checkIn: stayCheckIn,
          checkOut: stayCheckOut,
          guestCount: 2,
          roomCount: 1,
          // Attacker attempts to forge price
          totalAmount: 1,
          priceSnapshot: 1,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const reservation = res.body.data;
      expect(reservation.reference).toMatch(/^RES-[2-9A-Z]{4}-[2-9A-Z]{4}$/);
      expect(reservation.guestId).toBe(guestIdA);
      expect(reservation.status).toBe('CONFIRMED');

      // Server-side calculated: 2 nights * $200 = $400 (client-sent 1 was ignored)
      expect(reservation.priceSnapshot).toBe(200);
      expect(reservation.totalAmount).toBe(400);

      // Verify inventory document was initialized and booked = 1
      const invCheck = await RoomInventory.findOne({
        roomTypeId,
        date: stayCheckIn,
      });
      expect(invCheck).toBeDefined();
      expect(invCheck?.booked).toBe(1);
      expect(invCheck?.capacity).toBe(1);
    });

    it('should reject booking when guestCount exceeds room capacity (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${guestTokenA}`)
        .send({
          roomTypeId,
          checkIn: stayCheckIn,
          checkOut: stayCheckOut,
          guestCount: 5, // Capacity is 2
          roomCount: 1,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('exceeds total capacity');
    });
  });

  describe('Overbooking & Transaction Atomicity', () => {
    it('should REJECT reservation with 409 Conflict when inventory is exhausted', async () => {
      // 1. Guest A books the only room
      const firstRes = await request(app)
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${guestTokenA}`)
        .send({
          roomTypeId,
          checkIn: stayCheckIn,
          checkOut: stayCheckOut,
          guestCount: 1,
          roomCount: 1,
        });
      expect(firstRes.status).toBe(201);

      // 2. Guest B attempts to book the same room on the same dates
      const secondRes = await request(app)
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${guestTokenB}`)
        .send({
          roomTypeId,
          checkIn: stayCheckIn,
          checkOut: stayCheckOut,
          guestCount: 1,
          roomCount: 1,
        });

      expect(secondRes.status).toBe(409);
      expect(secondRes.body.success).toBe(false);
      expect(secondRes.body.error.code).toBe('INSUFFICIENT_INVENTORY');

      // Verify booked count in DB never exceeded capacity (remains exactly 1)
      const inv = await RoomInventory.findOne({ roomTypeId, date: stayCheckIn });
      expect(inv?.booked).toBe(1);
      expect(inv?.capacity).toBe(1);

      // Verify only 1 reservation exists in DB
      const totalReservations = await Reservation.countDocuments({ roomType: roomTypeId });
      expect(totalReservations).toBe(1);
    });
  });

  describe('Idempotency-Key Handling', () => {
    it('should return existing reservation on duplicate Idempotency-Key without re-booking', async () => {
      const idempotencyKey = 'unique-client-uuid-999';

      // First attempt
      const res1 = await request(app)
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${guestTokenA}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          roomTypeId,
          checkIn: stayCheckIn,
          checkOut: stayCheckOut,
          guestCount: 1,
          roomCount: 1,
        });

      expect(res1.status).toBe(201);
      const originalRef = res1.body.data.reference;

      // Second attempt with identical idempotency key
      const res2 = await request(app)
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${guestTokenA}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          roomTypeId,
          checkIn: stayCheckIn,
          checkOut: stayCheckOut,
          guestCount: 1,
          roomCount: 1,
        });

      expect(res2.status).toBe(200); // 200 returned for existing idempotent result
      expect(res2.body.data.reference).toBe(originalRef);

      // Verify booked count was NOT incremented twice
      const inv = await RoomInventory.findOne({ roomTypeId, date: stayCheckIn });
      expect(inv?.booked).toBe(1);

      const totalRes = await Reservation.countDocuments({ guest: guestIdA });
      expect(totalRes).toBe(1);
    });
  });

  describe('Guest Access Isolation', () => {
    it('should forbid Guest B from viewing Guest A reservation (403 Forbidden)', async () => {
      // Guest A books
      const bookRes = await request(app)
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${guestTokenA}`)
        .send({
          roomTypeId,
          checkIn: stayCheckIn,
          checkOut: stayCheckOut,
          guestCount: 1,
          roomCount: 1,
        });

      const resId = bookRes.body.data.id;

      // Guest B attempts to view Guest A's reservation
      const viewRes = await request(app)
        .get(`/api/v1/reservations/${resId}`)
        .set('Authorization', `Bearer ${guestTokenB}`);

      expect(viewRes.status).toBe(403);
      expect(viewRes.body.error.code).toBe('FORBIDDEN');
    });

    it('should forbid Guest B from cancelling Guest A reservation (403 Forbidden)', async () => {
      // Guest A books
      const bookRes = await request(app)
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${guestTokenA}`)
        .send({
          roomTypeId,
          checkIn: stayCheckIn,
          checkOut: stayCheckOut,
          guestCount: 1,
          roomCount: 1,
        });

      const resId = bookRes.body.data.id;

      // Guest B attempts to cancel Guest A's reservation
      const cancelRes = await request(app)
        .post(`/api/v1/reservations/${resId}/cancel`)
        .set('Authorization', `Bearer ${guestTokenB}`);

      expect(cancelRes.status).toBe(403);
    });

    it('should list only own reservations for authenticated guest', async () => {
      // Guest A books
      await request(app)
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${guestTokenA}`)
        .send({
          roomTypeId,
          checkIn: stayCheckIn,
          checkOut: stayCheckOut,
          guestCount: 1,
          roomCount: 1,
        });

      // Guest A queries their list
      const listA = await request(app)
        .get('/api/v1/reservations/mine')
        .set('Authorization', `Bearer ${guestTokenA}`);

      expect(listA.status).toBe(200);
      expect(listA.body.data.length).toBe(1);

      // Guest B queries their list (should be empty)
      const listB = await request(app)
        .get('/api/v1/reservations/mine')
        .set('Authorization', `Bearer ${guestTokenB}`);

      expect(listB.status).toBe(200);
      expect(listB.body.data.length).toBe(0);
    });
  });

  describe('Exactly-Once Cancellation & Inventory Release', () => {
    it('should release inventory on cancellation and prevent double-release on second cancel', async () => {
      // 1. Guest A books the only room
      const bookRes = await request(app)
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${guestTokenA}`)
        .send({
          roomTypeId,
          checkIn: stayCheckIn,
          checkOut: stayCheckOut,
          guestCount: 1,
          roomCount: 1,
        });

      const resId = bookRes.body.data.id;

      // Verify booked is 1
      let inv = await RoomInventory.findOne({ roomTypeId, date: stayCheckIn });
      expect(inv?.booked).toBe(1);

      // 2. First cancellation: succeeds and releases inventory
      const cancelRes1 = await request(app)
        .post(`/api/v1/reservations/${resId}/cancel`)
        .set('Authorization', `Bearer ${guestTokenA}`)
        .send({ reason: 'Trip plans changed' });

      expect(cancelRes1.status).toBe(200);
      expect(cancelRes1.body.data.reservation.status).toBe('CANCELLED');

      // Verify booked is decremented back to 0
      inv = await RoomInventory.findOne({ roomTypeId, date: stayCheckIn });
      expect(inv?.booked).toBe(0);

      // 3. Second cancellation attempt: must fail with 409 Conflict
      const cancelRes2 = await request(app)
        .post(`/api/v1/reservations/${resId}/cancel`)
        .set('Authorization', `Bearer ${guestTokenA}`);

      expect(cancelRes2.status).toBe(409);
      expect(cancelRes2.body.error.code).toBe('INVALID_STATE_TRANSITION');

      // Crucial: Booked count must NOT become negative (must remain exactly 0)
      inv = await RoomInventory.findOne({ roomTypeId, date: stayCheckIn });
      expect(inv?.booked).toBe(0);
    });
  });

  describe('Duplicate-Key & Idempotency Concurrency Handling (P0-3)', () => {
    it('should handle concurrent first-ever bookings on unseeded dates without 500 or duplicate-key failure', async () => {
      // Room type with 3 rooms
      const multiRoom = await RoomType.create({
        name: 'Triple Deluxe',
        description: '3 rooms available',
        capacity: 2,
        facilities: ['WiFi'],
        pricePerNight: 100,
        totalInventory: 3,
        isActive: true,
      });

      const today = getTodayUtcString();
      const [y, m, d] = today.split('-').map(Number);
      const freshCheckIn = new Date(Date.UTC(y!, m! - 1, d! + 20)).toISOString().split('T')[0]!;
      const freshCheckOut = new Date(Date.UTC(y!, m! - 1, d! + 22)).toISOString().split('T')[0]!;

      // Confirm NO RoomInventory document exists for this date yet
      const preCount = await RoomInventory.countDocuments({
        roomTypeId: multiRoom._id,
        date: freshCheckIn,
      });
      expect(preCount).toBe(0);

      // Fire 3 simultaneous bookings by Guest A and Guest B for 1 room each
      const requests = [
        request(app)
          .post('/api/v1/reservations')
          .set('Authorization', `Bearer ${guestTokenA}`)
          .send({
            roomTypeId: multiRoom._id.toString(),
            checkIn: freshCheckIn,
            checkOut: freshCheckOut,
            guestCount: 1,
            roomCount: 1,
          }),
        request(app)
          .post('/api/v1/reservations')
          .set('Authorization', `Bearer ${guestTokenB}`)
          .send({
            roomTypeId: multiRoom._id.toString(),
            checkIn: freshCheckIn,
            checkOut: freshCheckOut,
            guestCount: 1,
            roomCount: 1,
          }),
        request(app)
          .post('/api/v1/reservations')
          .set('Authorization', `Bearer ${guestTokenA}`)
          .send({
            roomTypeId: multiRoom._id.toString(),
            checkIn: freshCheckIn,
            checkOut: freshCheckOut,
            guestCount: 1,
            roomCount: 1,
          }),
      ];

      const responses = await Promise.all(requests);

      // All 3 should succeed with 201 without throwing E11000 duplicate key error
      for (const res of responses) {
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
      }

      // Verify that RoomInventory was created with booked = 3
      const invDoc = await RoomInventory.findOne({
        roomTypeId: multiRoom._id,
        date: freshCheckIn,
      });
      expect(invDoc).not.toBeNull();
      expect(invDoc?.booked).toBe(3);
      expect(invDoc?.capacity).toBe(3);
    });

    it('should handle simultaneous requests with the same Idempotency-Key gracefully (exactly 1 reservation, identical response, no 500)', async () => {
      const idempotencyKey = 'race-key-' + Date.now();

      // Send 2 identical requests with the SAME Idempotency-Key concurrently
      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/v1/reservations')
          .set('Authorization', `Bearer ${guestTokenA}`)
          .set('Idempotency-Key', idempotencyKey)
          .send({
            roomTypeId,
            checkIn: stayCheckIn,
            checkOut: stayCheckOut,
            guestCount: 1,
            roomCount: 1,
          }),
        request(app)
          .post('/api/v1/reservations')
          .set('Authorization', `Bearer ${guestTokenA}`)
          .set('Idempotency-Key', idempotencyKey)
          .send({
            roomTypeId,
            checkIn: stayCheckIn,
            checkOut: stayCheckOut,
            guestCount: 1,
            roomCount: 1,
          }),
      ]);

      // Neither request should return 500
      expect([200, 201]).toContain(res1.status);
      expect([200, 201]).toContain(res2.status);

      // Both callers receive the exact same reservation
      expect(res1.body.data.id).toBe(res2.body.data.id);
      expect(res1.body.data.reference).toBe(res2.body.data.reference);

      // Verify only 1 reservation was created in DB
      const dbCount = await Reservation.countDocuments({
        guest: guestIdA,
        idempotencyKey,
      });
      expect(dbCount).toBe(1);
    });
  });
});
