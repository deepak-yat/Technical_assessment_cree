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

describe('Take-Home Assignment Specific Scenarios (1-6)', () => {
  let today: string;
  let checkIn: string;
  let checkOut: string;

  beforeEach(async () => {
    today = getTodayUtcString();
    const [y, m, d] = today.split('-').map(Number);
    checkIn = new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().split('T')[0]!;
    checkOut = new Date(Date.UTC(y!, m! - 1, d! + 3)).toISOString().split('T')[0]!;
  });

  /**
   * Helper to create and authenticate a test user.
   */
  async function createTestGuest(
    name: string,
    email: string,
  ): Promise<{ token: string; id: string }> {
    const pw = await hashPassword('Password123');
    const user = await User.create({
      name,
      email,
      passwordHash: pw,
      role: UserRoles.GUEST,
    });

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email,
      password: 'Password123',
    });

    return { token: loginRes.body.data.accessToken, id: user._id.toString() };
  }

  // ==========================================================================
  // SCENARIO 1: Overbooking rejected when inventory exhausted
  // ==========================================================================
  it('Scenario 1: Overbooking rejected when inventory exhausted', async () => {
    // Setup: Room type with 2 total rooms
    const room = await RoomType.create({
      name: 'Scenario 1 Room',
      description: 'Room for scenario 1',
      capacity: 2,
      facilities: ['WiFi'],
      pricePerNight: 100,
      totalInventory: 2,
      isActive: true,
    });

    const guest1 = await createTestGuest('Guest One', 'scenario1.g1@example.com');
    const guest2 = await createTestGuest('Guest Two', 'scenario1.g2@example.com');

    // 1. Guest 1 books 2 rooms (exhausting all inventory)
    const res1 = await request(app)
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${guest1.token}`)
      .send({
        roomTypeId: room._id.toString(),
        checkIn,
        checkOut,
        guestCount: 2,
        roomCount: 2,
      });

    expect(res1.status).toBe(201);
    expect(res1.body.success).toBe(true);

    // 2. Guest 2 attempts to book 1 room for the same dates
    const res2 = await request(app)
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${guest2.token}`)
      .send({
        roomTypeId: room._id.toString(),
        checkIn,
        checkOut,
        guestCount: 1,
        roomCount: 1,
      });

    expect(res2.status).toBe(409);
    expect(res2.body.success).toBe(false);
    expect(res2.body.error.code).toBe('INSUFFICIENT_INVENTORY');

    // Invariant: DB booked count never exceeds capacity
    const inv = await RoomInventory.findOne({ roomTypeId: room._id, date: checkIn });
    expect(inv?.booked).toBe(2);
    expect(inv?.capacity).toBe(2);

    // Invariant: Exactly 1 reservation exists in DB
    const count = await Reservation.countDocuments({ roomType: room._id });
    expect(count).toBe(1);
  });

  // ==========================================================================
  // SCENARIO 2: Guest cannot access another guest's reservation
  // ==========================================================================
  it('Scenario 2: Guest cannot access another guest reservation', async () => {
    const room = await RoomType.create({
      name: 'Scenario 2 Room',
      description: 'Room for scenario 2',
      capacity: 2,
      facilities: ['WiFi'],
      pricePerNight: 100,
      totalInventory: 5,
      isActive: true,
    });

    const guestA = await createTestGuest('Guest A', 'scenario2.a@example.com');
    const guestB = await createTestGuest('Guest B', 'scenario2.b@example.com');

    // Guest A creates reservation
    const bookRes = await request(app)
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${guestA.token}`)
      .send({
        roomTypeId: room._id.toString(),
        checkIn,
        checkOut,
        guestCount: 1,
        roomCount: 1,
      });

    const reservationId = bookRes.body.data.id;

    // 1. Guest B attempts to GET Guest A's reservation -> 403 Forbidden
    const getRes = await request(app)
      .get(`/api/v1/reservations/${reservationId}`)
      .set('Authorization', `Bearer ${guestB.token}`);

    expect(getRes.status).toBe(403);
    expect(getRes.body.error.code).toBe('FORBIDDEN');

    // 2. Guest B attempts to CANCEL Guest A's reservation -> 403 Forbidden
    const cancelRes = await request(app)
      .post(`/api/v1/reservations/${reservationId}/cancel`)
      .set('Authorization', `Bearer ${guestB.token}`);

    expect(cancelRes.status).toBe(403);
    expect(cancelRes.body.error.code).toBe('FORBIDDEN');

    // 3. Guest A CAN access their own reservation -> 200 OK
    const ownerRes = await request(app)
      .get(`/api/v1/reservations/${reservationId}`)
      .set('Authorization', `Bearer ${guestA.token}`);

    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.data.reservation.id).toBe(reservationId);
  });

  // ==========================================================================
  // SCENARIO 3: Invalid status transitions rejected
  // ==========================================================================
  it('Scenario 3: Invalid status transitions rejected', async () => {
    // Seed staff user
    const staffPw = await hashPassword('StaffPass123');
    await User.create({
      name: 'Staff Reviewer',
      email: 'staff.scen3@hotel.com',
      passwordHash: staffPw,
      role: UserRoles.STAFF,
    });

    const staffLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'staff.scen3@hotel.com',
      password: 'StaffPass123',
    });
    const staffToken = staffLogin.body.data.accessToken;

    const room = await RoomType.create({
      name: 'Scenario 3 Room',
      description: 'Room for scenario 3',
      capacity: 2,
      facilities: ['WiFi'],
      pricePerNight: 100,
      totalInventory: 5,
      isActive: true,
    });

    const guest = await createTestGuest('Guest 3', 'scenario3.g@example.com');

    const bookRes = await request(app)
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${guest.token}`)
      .send({
        roomTypeId: room._id.toString(),
        checkIn,
        checkOut,
        guestCount: 1,
        roomCount: 1,
      });

    const reservationId = bookRes.body.data.id;

    // Check-in guest to reach CHECKED_IN status (simulate checkIn is today)
    await Reservation.findByIdAndUpdate(reservationId, { checkIn: today });
    await request(app)
      .post(`/api/v1/staff/reservations/${reservationId}/check-in`)
      .set('Authorization', `Bearer ${staffToken}`);

    // Invalid Transition 1: CHECKED_IN cannot transition to CANCELLED
    const invalidCancel = await request(app)
      .patch(`/api/v1/staff/reservations/${reservationId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'CANCELLED' });

    expect(invalidCancel.status).toBe(409);
    expect(invalidCancel.body.error.code).toBe('INVALID_STATE_TRANSITION');

    // Complete check-out to reach CHECKED_OUT (terminal state)
    await request(app)
      .post(`/api/v1/staff/reservations/${reservationId}/check-out`)
      .set('Authorization', `Bearer ${staffToken}`);

    // Invalid Transition 2: CHECKED_OUT cannot transition to CONFIRMED
    const invalidReopen = await request(app)
      .patch(`/api/v1/staff/reservations/${reservationId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'CONFIRMED' });

    expect(invalidReopen.status).toBe(409);
    expect(invalidReopen.body.error.code).toBe('INVALID_STATE_TRANSITION');
  });

  // ==========================================================================
  // SCENARIO 4: Price is computed server-side and a client-sent total is ignored
  // ==========================================================================
  it('Scenario 4: Price is computed server-side and a client-sent total is ignored', async () => {
    // Room costs $350 / night
    const room = await RoomType.create({
      name: 'Penthouse Panorama',
      description: 'Luxury penthouse',
      capacity: 4,
      facilities: ['WiFi', 'Terrace'],
      pricePerNight: 350,
      totalInventory: 3,
      isActive: true,
    });

    const guest = await createTestGuest('Rich Guest', 'rich.guest@example.com');

    // Stay: checkIn to checkOut is 2 nights. Room count: 2 rooms.
    // Legitimate server price = $350 * 2 nights * 2 rooms = $1400.
    // Client maliciously attempts to send priceSnapshot: $1 and totalAmount: $2.
    const res = await request(app)
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${guest.token}`)
      .send({
        roomTypeId: room._id.toString(),
        checkIn,
        checkOut,
        guestCount: 3,
        roomCount: 2,
        priceSnapshot: 1,
        totalAmount: 2,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.priceSnapshot).toBe(350); // Server price preserved
    expect(res.body.data.totalAmount).toBe(1400); // 350 * 2 nights * 2 rooms = 1400

    // Direct database document inspection
    const doc = await Reservation.findById(res.body.data.id);
    expect(doc?.priceSnapshot).toBe(350);
    expect(doc?.totalAmount).toBe(1400);
  });

  // ==========================================================================
  // SCENARIO 5: CONCURRENCY: 1 room left, 10 parallel POST /reservations
  // -> exactly one 201, rest 409, inventory.booked == capacity
  // ==========================================================================
  it('Scenario 5: CONCURRENCY: 1 room left, 10 parallel POST /reservations -> exactly one 201, rest 409, inventory.booked == capacity', async () => {
    // Room type with exactly 1 room in total inventory
    const room = await RoomType.create({
      name: 'Single Diamond Room',
      description: 'Only one room exists',
      capacity: 2,
      facilities: ['WiFi'],
      pricePerNight: 200,
      totalInventory: 1, // Only 1 room!
      isActive: true,
    });

    // Create 10 distinct guests with individual auth tokens
    const guests = await Promise.all(
      Array.from({ length: 10 }).map((_, i) =>
        createTestGuest(`Racer ${i}`, `racer${i}@example.com`),
      ),
    );

    // Fire 10 parallel reservation requests simultaneously competing for the single room
    const parallelRequests = guests.map((g) =>
      request(app).post('/api/v1/reservations').set('Authorization', `Bearer ${g.token}`).send({
        roomTypeId: room._id.toString(),
        checkIn,
        checkOut,
        guestCount: 1,
        roomCount: 1,
      }),
    );

    const results = await Promise.all(parallelRequests);

    const successResponses = results.filter((r) => r.status === 201);
    const conflictResponses = results.filter((r) => r.status === 409);

    // Invariant 1: Exactly ONE request succeeded with 201 Created
    expect(successResponses.length).toBe(1);

    // Invariant 2: Exactly NINE requests failed with 409 Conflict
    expect(conflictResponses.length).toBe(9);
    for (const conflict of conflictResponses) {
      expect(conflict.body.error.code).toBe('INSUFFICIENT_INVENTORY');
    }

    // Invariant 3: DB inventory.booked == capacity (never exceeds capacity)
    const inv = await RoomInventory.findOne({ roomTypeId: room._id, date: checkIn });
    expect(inv).toBeDefined();
    expect(inv?.booked).toBe(1);
    expect(inv?.capacity).toBe(1);

    // Invariant 4: Exactly one reservation exists in the database
    const totalReservations = await Reservation.countDocuments({ roomType: room._id });
    expect(totalReservations).toBe(1);
  });

  // ==========================================================================
  // SCENARIO 6: Double-cancel releases inventory once
  // ==========================================================================
  it('Scenario 6: Double-cancel releases inventory once', async () => {
    const room = await RoomType.create({
      name: 'Scenario 6 Room',
      description: 'Room for scenario 6',
      capacity: 2,
      facilities: ['WiFi'],
      pricePerNight: 120,
      totalInventory: 1,
      isActive: true,
    });

    const guest = await createTestGuest('Double Canceller', 'canceller@example.com');

    // 1. Guest books the room
    const bookRes = await request(app)
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${guest.token}`)
      .send({
        roomTypeId: room._id.toString(),
        checkIn,
        checkOut,
        guestCount: 1,
        roomCount: 1,
      });

    const reservationId = bookRes.body.data.id;

    // Verify initial booked state is 1
    let inv = await RoomInventory.findOne({ roomTypeId: room._id, date: checkIn });
    expect(inv?.booked).toBe(1);

    // 2. Fire 2 cancel requests in parallel
    const [cancel1, cancel2] = await Promise.all([
      request(app)
        .post(`/api/v1/reservations/${reservationId}/cancel`)
        .set('Authorization', `Bearer ${guest.token}`),
      request(app)
        .post(`/api/v1/reservations/${reservationId}/cancel`)
        .set('Authorization', `Bearer ${guest.token}`),
    ]);

    const statuses = [cancel1.status, cancel2.status].sort();

    // Exactly one succeeds with 200 OK, the other fails with 409 Conflict
    expect(statuses).toEqual([200, 409]);

    // Invariant: Booked count was decremented from 1 to 0, NOT to -1
    inv = await RoomInventory.findOne({ roomTypeId: room._id, date: checkIn });
    expect(inv?.booked).toBe(0);

    // Third sequential cancel still fails with 409
    const cancel3 = await request(app)
      .post(`/api/v1/reservations/${reservationId}/cancel`)
      .set('Authorization', `Bearer ${guest.token}`);

    expect(cancel3.status).toBe(409);
    inv = await RoomInventory.findOne({ roomTypeId: room._id, date: checkIn });
    expect(inv?.booked).toBe(0); // Still 0, never negative
  });
});
