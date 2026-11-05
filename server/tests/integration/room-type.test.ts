import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { User } from '../../src/models/user.model.js';
import { RoomType } from '../../src/models/room-type.model.js';
import { RoomInventory } from '../../src/models/room-inventory.model.js';
import { UserRoles } from '../../src/types/auth.types.js';
import { hashPassword } from '../../src/common/utils/password.js';
import { getTodayUtcString } from '../../src/common/utils/date.js';

describe('Room Types and Availability Search', () => {
  let staffToken: string;
  let guestToken: string;

  beforeEach(async () => {
    // 1. Seed Staff User
    const staffHash = await hashPassword('StaffPass123');
    await User.create({
      name: 'Staff Member',
      email: 'staff@hotel.com',
      passwordHash: staffHash,
      role: UserRoles.STAFF,
    });

    const staffLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'staff@hotel.com',
      password: 'StaffPass123',
    });
    staffToken = staffLogin.body.data.accessToken;

    // 2. Seed Guest User
    const guestHash = await hashPassword('GuestPass123');
    await User.create({
      name: 'Guest User',
      email: 'guest@hotel.com',
      passwordHash: guestHash,
      role: UserRoles.GUEST,
    });

    const guestLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'guest@hotel.com',
      password: 'GuestPass123',
    });
    guestToken = guestLogin.body.data.accessToken;
  });

  describe('Public Listing & Retrieval', () => {
    it('GET /api/v1/room-types should return paginated list of ONLY active room types', async () => {
      // Create 1 active and 1 inactive room type
      await RoomType.create([
        {
          name: 'Deluxe Suite',
          description: 'Spacious deluxe room with king bed',
          capacity: 2,
          facilities: ['WiFi', 'AC'],
          pricePerNight: 150,
          totalInventory: 5,
          isActive: true,
        },
        {
          name: 'Economy Single (Hidden)',
          description: 'Budget single room under renovation',
          capacity: 1,
          facilities: ['WiFi'],
          pricePerNight: 80,
          totalInventory: 2,
          isActive: false, // Inactive
        },
      ]);

      const res = await request(app).get('/api/v1/room-types');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Deluxe Suite');
      expect(res.body.meta).toMatchObject({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });

    it('GET /api/v1/room-types/:id should return single room type details', async () => {
      const room = await RoomType.create({
        name: 'Presidential Suite',
        description: 'Luxury top-floor suite with panoramic views',
        capacity: 4,
        facilities: ['WiFi', 'Jacuzzi', 'Balcony'],
        pricePerNight: 500,
        totalInventory: 1,
        isActive: true,
      });

      const res = await request(app).get(`/api/v1/room-types/${room._id.toString()}`);

      expect(res.status).toBe(200);
      expect(res.body.data.roomType.name).toBe('Presidential Suite');
      expect(res.body.data.roomType.capacity).toBe(4);
    });
  });

  describe('Staff CRUD and Permissions', () => {
    it('should reject room type creation by Guest (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/room-types')
        .set('Authorization', `Bearer ${guestToken}`)
        .send({
          name: 'Hacker Room',
          description: 'Unauthorized creation attempt',
          capacity: 2,
          facilities: ['WiFi'],
          pricePerNight: 100,
          totalInventory: 5,
        });

      expect(res.status).toBe(403);
    });

    it('should allow Staff to create a new room type (201 Created)', async () => {
      const res = await request(app)
        .post('/api/v1/room-types')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          name: 'Ocean View King',
          description: 'Magnificent ocean view with plush king-sized bed',
          capacity: 2,
          facilities: ['WiFi', 'Ocean View', 'Balcony'],
          pricePerNight: 220,
          totalInventory: 4,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.roomType.name).toBe('Ocean View King');
      expect(res.body.data.roomType.totalInventory).toBe(4);
    });

    it('should reject creating duplicate room type name with 409 Conflict', async () => {
      await RoomType.create({
        name: 'Standard Twin',
        description: 'Standard twin room with two single beds',
        capacity: 2,
        facilities: ['WiFi'],
        pricePerNight: 120,
        totalInventory: 3,
      });

      const res = await request(app)
        .post('/api/v1/room-types')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          name: 'Standard Twin',
          description: 'Another standard twin room',
          capacity: 2,
          facilities: ['WiFi'],
          pricePerNight: 120,
          totalInventory: 3,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('should allow Staff to activate / deactivate room type', async () => {
      const room = await RoomType.create({
        name: 'Garden Villa',
        description: 'Private villa in the hotel garden',
        capacity: 4,
        facilities: ['Private Garden'],
        pricePerNight: 350,
        totalInventory: 2,
        isActive: true,
      });

      const res = await request(app)
        .patch(`/api/v1/room-types/${room._id.toString()}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.data.roomType.isActive).toBe(false);

      // Verify it is now hidden from public list
      const publicRes = await request(app).get('/api/v1/room-types');
      expect(
        publicRes.body.data.find((r: { id: string }) => r.id === room._id.toString()),
      ).toBeUndefined();
    });
  });

  describe('Inventory Lowering Business Rule Enforcement', () => {
    it('should REJECT lowering total inventory below already-booked nights in the future (409 Conflict)', async () => {
      const room = await RoomType.create({
        name: 'Executive Studio',
        description: 'Studio with workstation and city views',
        capacity: 2,
        facilities: ['Desk', 'WiFi'],
        pricePerNight: 180,
        totalInventory: 5,
        isActive: true,
      });

      const today = getTodayUtcString();
      const [y, m, d] = today.split('-').map(Number);
      const futureDate = new Date(Date.UTC(y!, m! - 1, d! + 5)).toISOString().split('T')[0]!;

      // Simulate existing booking: 4 rooms booked on futureDate
      await RoomInventory.create({
        roomTypeId: room._id,
        date: futureDate,
        capacity: 5,
        booked: 4,
      });

      // Staff attempts to reduce total inventory to 3 (which is less than 4 booked rooms)
      const res = await request(app)
        .put(`/api/v1/room-types/${room._id.toString()}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          totalInventory: 3,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('already has 4 room(s) booked');

      // Verify DB totalInventory remained unchanged at 5
      const refreshed = await RoomType.findById(room._id);
      expect(refreshed?.totalInventory).toBe(5);
    });

    it('should ALLOW lowering total inventory when >= maximum future booked count', async () => {
      const room = await RoomType.create({
        name: 'Family Suite',
        description: 'Large family suite with two bedrooms',
        capacity: 5,
        facilities: ['Kitchenette', 'WiFi'],
        pricePerNight: 300,
        totalInventory: 10,
        isActive: true,
      });

      const today = getTodayUtcString();
      const [y, m, d] = today.split('-').map(Number);
      const futureDate = new Date(Date.UTC(y!, m! - 1, d! + 2)).toISOString().split('T')[0]!;

      // 3 rooms booked on futureDate
      await RoomInventory.create({
        roomTypeId: room._id,
        date: futureDate,
        capacity: 10,
        booked: 3,
      });

      // Staff reduces total inventory to 5 (safe, since 5 >= 3)
      const res = await request(app)
        .put(`/api/v1/room-types/${room._id.toString()}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          totalInventory: 5,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.roomType.totalInventory).toBe(5);

      // Verify future inventory document was synchronized
      const updatedInv = await RoomInventory.findOne({ roomTypeId: room._id, date: futureDate });
      expect(updatedInv?.capacity).toBe(5);
    });

    it('should synchronize future RoomInventory capacity when raising totalInventory (2 to 5)', async () => {
      const room = await RoomType.create({
        name: 'Cozy Loft',
        description: 'Loft apartment in downtown',
        capacity: 2,
        facilities: ['WiFi'],
        pricePerNight: 120,
        totalInventory: 2,
        isActive: true,
      });

      const today = getTodayUtcString();
      const [y, m, d] = today.split('-').map(Number);
      const futureCheckIn = new Date(Date.UTC(y!, m! - 1, d! + 2)).toISOString().split('T')[0]!;
      const futureCheckOut = new Date(Date.UTC(y!, m! - 1, d! + 3)).toISOString().split('T')[0]!;

      // Pre-existing future inventory doc with old capacity of 2
      await RoomInventory.create({
        roomTypeId: room._id,
        date: futureCheckIn,
        capacity: 2,
        booked: 0,
      });

      // Before raising: availability search returns 2 rooms available
      const beforeSearch = await request(app)
        .get('/api/v1/room-types/availability')
        .query({
          checkIn: futureCheckIn,
          checkOut: futureCheckOut,
          guests: 1,
        });

      const beforeItem = beforeSearch.body.data.find(
        (item: { roomType: { id: string } }) => item.roomType.id === room._id.toString(),
      );
      expect(beforeItem.availableRooms).toBe(2);

      // Staff raises totalInventory from 2 to 5
      const updateRes = await request(app)
        .put(`/api/v1/room-types/${room._id.toString()}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          totalInventory: 5,
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.roomType.totalInventory).toBe(5);

      // Verify the future RoomInventory doc capacity was synchronized to 5
      const updatedInv = await RoomInventory.findOne({
        roomTypeId: room._id,
        date: futureCheckIn,
      });
      expect(updatedInv?.capacity).toBe(5);

      // After raising: availability search now correctly reflects 5 rooms available
      const afterSearch = await request(app)
        .get('/api/v1/room-types/availability')
        .query({
          checkIn: futureCheckIn,
          checkOut: futureCheckOut,
          guests: 1,
        });

      const afterItem = afterSearch.body.data.find(
        (item: { roomType: { id: string } }) => item.roomType.id === room._id.toString(),
      );
      expect(afterItem.availableRooms).toBe(5);
    });
  });

  describe('Availability Search Aggregation Algorithm', () => {
    it('should calculate stay availability correctly across recorded and unrecorded nights', async () => {
      const today = getTodayUtcString();
      const [y, m, d] = today.split('-').map(Number);

      const d1 = new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().split('T')[0]!;
      const d2 = new Date(Date.UTC(y!, m! - 1, d! + 2)).toISOString().split('T')[0]!;
      const d3 = new Date(Date.UTC(y!, m! - 1, d! + 3)).toISOString().split('T')[0]!;
      const checkout = new Date(Date.UTC(y!, m! - 1, d! + 4)).toISOString().split('T')[0]!;

      // Room 1: Total inventory 4. Capacity 2. Price 100/night.
      // d1 has 1 booked (3 available)
      // d2 has 3 booked (1 available)
      // d3 has NO inventory doc (4 available = full capacity)
      // Minimum available across stay [d1, d2, d3] is MIN(3, 1, 4) = 1 room.
      const room1 = await RoomType.create({
        name: 'Sea View Suite',
        description: 'Room 1 test',
        capacity: 2,
        facilities: ['WiFi'],
        pricePerNight: 100,
        totalInventory: 4,
        isActive: true,
      });

      await RoomInventory.create([
        { roomTypeId: room1._id, date: d1, capacity: 4, booked: 1 },
        { roomTypeId: room1._id, date: d2, capacity: 4, booked: 3 },
      ]);

      // Room 2: Inactive room type - MUST NOT be returned
      await RoomType.create({
        name: 'Closed Room',
        description: 'Room 2 test',
        capacity: 4,
        facilities: ['WiFi'],
        pricePerNight: 150,
        totalInventory: 5,
        isActive: false,
      });

      // Room 3: Insufficient guest capacity (capacity 1, but searching for 2 guests)
      await RoomType.create({
        name: 'Solo Pod',
        description: 'Room 3 test',
        capacity: 1,
        facilities: ['WiFi'],
        pricePerNight: 50,
        totalInventory: 10,
        isActive: true,
      });

      // Execute availability search for 2 guests, 1 room from d1 to checkout (3 nights)
      const res = await request(app).get('/api/v1/room-types/availability').query({
        checkIn: d1,
        checkOut: checkout,
        guests: 2,
        rooms: 1,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const results = res.body.data;
      expect(results.length).toBe(1);

      const match = results[0];
      expect(match.roomType.name).toBe('Sea View Suite');
      expect(match.nightsCount).toBe(3);
      expect(match.availableRooms).toBe(1); // Min(3, 1, 4) = 1
      expect(match.pricePerNight).toBe(100);
      expect(match.totalPrice).toBe(300); // 3 nights * 100 * 1 room
      expect(match.isAvailable).toBe(true);
    });

    it('should exclude room types that are fully booked on any night of the stay', async () => {
      const today = getTodayUtcString();
      const [y, m, d] = today.split('-').map(Number);

      const d1 = new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().split('T')[0]!;
      const d2 = new Date(Date.UTC(y!, m! - 1, d! + 2)).toISOString().split('T')[0]!;
      const checkout = new Date(Date.UTC(y!, m! - 1, d! + 3)).toISOString().split('T')[0]!;

      const room = await RoomType.create({
        name: 'Cozy Room',
        description: 'Room test',
        capacity: 2,
        facilities: ['WiFi'],
        pricePerNight: 100,
        totalInventory: 2,
        isActive: true,
      });

      // Fully booked on night 2 (booked: 2, capacity: 2 -> 0 available)
      await RoomInventory.create({
        roomTypeId: room._id,
        date: d2,
        capacity: 2,
        booked: 2,
      });

      const res = await request(app).get('/api/v1/room-types/availability').query({
        checkIn: d1,
        checkOut: checkout,
        guests: 2,
        rooms: 1,
      });

      expect(res.status).toBe(200);
      // Because night 2 has 0 rooms left, availableRooms is 0 (< 1 requested room), so excluded
      expect(res.body.data.length).toBe(0);
    });
  });
});
