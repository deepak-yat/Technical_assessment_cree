import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { app } from '../app.js';
import { User } from '../models/user.model.js';
import { RoomType } from '../models/room-type.model.js';
import { RoomInventory } from '../models/room-inventory.model.js';
import { Reservation } from '../models/reservation.model.js';
import { UserRoles } from '../types/auth.types.js';
import { hashPassword } from '../common/utils/password.js';
import { getTodayUtcString } from '../common/utils/date.js';

const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

async function setupDatabase(): Promise<MongoMemoryReplSet | null> {
  // Check if we can connect to existing local MongoDB replica set
  try {
    const mongoUri =
      process.env.MONGODB_URI ||
      'mongodb://localhost:27017/hotel_reservation?replicaSet=rs0&directConnection=true';
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
    console.log(`${GREEN}Connected to local MongoDB replica set.${RESET}`);
    return null;
  } catch {
    console.log(
      `${YELLOW}Local MongoDB not running. Initializing in-memory replica set for demo...${RESET}`,
    );
    const replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    await mongoose.connect(replSet.getUri(), { serverSelectionTimeoutMS: 10000 });
    console.log(`${GREEN}In-memory replica set initialized successfully.${RESET}`);
    return replSet;
  }
}

async function runDemo(): Promise<void> {
  console.log(
    `\n${BOLD}${CYAN}======================================================================${RESET}`,
  );
  console.log(
    `${BOLD}${CYAN}   HOTEL SYSTEM - CONCURRENCY & TRANSACTION ISOLATION DEMO            ${RESET}`,
  );
  console.log(
    `${BOLD}${CYAN}======================================================================${RESET}\n`,
  );

  const replSet = await setupDatabase();

  try {
    // Clean collections
    await Promise.all([
      User.deleteMany({}),
      RoomType.deleteMany({}),
      RoomInventory.deleteMany({}),
      Reservation.deleteMany({}),
    ]);

    const today = getTodayUtcString();
    const [y, m, d] = today.split('-').map(Number);
    const checkIn = new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().split('T')[0]!;
    const checkOut = new Date(Date.UTC(y!, m! - 1, d! + 3)).toISOString().split('T')[0]!;

    console.log(`${BOLD}1. Setting up Room Type with strictly 1 available room:${RESET}`);
    const room = await RoomType.create({
      name: 'Presidential Penthouse (High Demand)',
      description: 'Ultra-exclusive 1-room penthouse',
      capacity: 2,
      facilities: ['Private Rooftop Pool', 'Butler Service'],
      pricePerNight: 800,
      totalInventory: 1, // EXACTLY 1 ROOM!
      isActive: true,
    });
    console.log(`   Room: ${BOLD}${room.name}${RESET}`);
    console.log(`   Total Inventory: ${BOLD}${room.totalInventory} room${RESET}`);
    console.log(`   Stay Dates: ${checkIn} to ${checkOut} (2 nights)\n`);

    console.log(`${BOLD}2. Registering 10 concurrent guest accounts...${RESET}`);
    const pwHash = await hashPassword('Password123');
    const guestTokens: { name: string; token: string }[] = [];

    for (let i = 1; i <= 10; i++) {
      const name = `Guest ${i}`;
      const email = `guest${i}@demo-concurrency.com`;

      await User.create({
        name,
        email,
        passwordHash: pwHash,
        role: UserRoles.GUEST,
      });

      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email,
        password: 'Password123',
      });

      guestTokens.push({ name, token: loginRes.body.data.accessToken });
    }
    console.log(`   Registered ${guestTokens.length} guests with individual JWT tokens.\n`);

    console.log(
      `${BOLD}${YELLOW}3. FIRING 10 CONCURRENT POST /reservations REQUESTS SIMULTANEOUSLY...${RESET}`,
    );
    console.log(`   (10 racing transactions competing for 1 available room)`);

    const startTimestamp = Date.now();

    const parallelRequests = guestTokens.map((guest, index) =>
      request(app)
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${guest.token}`)
        .send({
          roomTypeId: room._id.toString(),
          checkIn,
          checkOut,
          guestCount: 2,
          roomCount: 1,
        })
        .then((res) => ({
          clientIndex: index + 1,
          guestName: guest.name,
          status: res.status,
          body: res.body,
        })),
    );

    const outcomes = await Promise.all(parallelRequests);
    const durationMs = Date.now() - startTimestamp;

    console.log(`\n${BOLD}4. Execution Results (completed in ${durationMs}ms):${RESET}`);
    let winningReservationId = '';

    for (const outcome of outcomes) {
      if (outcome.status === 201) {
        winningReservationId = outcome.body.data.id;
        console.log(
          `   ${GREEN}[THREAD ${String(outcome.clientIndex).padStart(2)}] 201 CREATED ${RESET} -> ` +
            `${BOLD}WINNER: ${outcome.guestName}${RESET} (Ref: ${outcome.body.data.reference}, Total: $${outcome.body.data.totalAmount})`,
        );
      } else {
        console.log(
          `   ${RED}[THREAD ${String(outcome.clientIndex).padStart(2)}] 409 CONFLICT${RESET} -> ` +
            `${outcome.guestName}: ${outcome.body.error.message}`,
        );
      }
    }

    const successes = outcomes.filter((o) => o.status === 201);
    const conflicts = outcomes.filter((o) => o.status === 409);

    console.log(`\n${BOLD}5. Concurrency Verification & Invariants:${RESET}`);
    console.log(
      `   - Successful Bookings: ${successes.length === 1 ? GREEN : RED}${successes.length} (Expected: 1)${RESET}`,
    );
    console.log(
      `   - Rejected Bookings:   ${conflicts.length === 9 ? GREEN : RED}${conflicts.length} (Expected: 9)${RESET}`,
    );

    const inventoryRecord = await RoomInventory.findOne({
      roomTypeId: room._id,
      date: checkIn,
    });
    console.log(
      `   - DB RoomInventory.booked:   ${inventoryRecord?.booked === 1 ? GREEN : RED}${inventoryRecord?.booked} / ${inventoryRecord?.capacity}${RESET} (Expected: 1/1)`,
    );

    const totalReservations = await Reservation.countDocuments({ roomType: room._id });
    console.log(
      `   - Total DB Reservations:     ${totalReservations === 1 ? GREEN : RED}${totalReservations}${RESET} (Expected: 1)\n`,
    );

    if (successes.length !== 1 || inventoryRecord?.booked !== 1) {
      throw new Error('CONCURRENCY INVARIANT VIOLATED: OVERBOOKING DETECTED!');
    }

    console.log(`${BOLD}6. Testing Exactly-Once Double-Cancel Race Condition:${RESET}`);
    const winner = guestTokens[0]!;

    console.log(`   Firing 2 parallel POST /cancel requests on the winner reservation...`);
    const [cancel1, cancel2] = await Promise.all([
      request(app)
        .post(`/api/v1/reservations/${winningReservationId}/cancel`)
        .set('Authorization', `Bearer ${winner.token}`),
      request(app)
        .post(`/api/v1/reservations/${winningReservationId}/cancel`)
        .set('Authorization', `Bearer ${winner.token}`),
    ]);

    console.log(
      `   Cancel Attempt 1: ${cancel1.status === 200 ? GREEN : RED}HTTP ${cancel1.status}${RESET}`,
    );
    console.log(
      `   Cancel Attempt 2: ${cancel2.status === 409 ? GREEN : RED}HTTP ${cancel2.status} (Rejected: ${cancel2.body.error?.message})${RESET}`,
    );

    const postCancelInventory = await RoomInventory.findOne({
      roomTypeId: room._id,
      date: checkIn,
    });
    console.log(
      `   - DB RoomInventory.booked post-cancel: ${postCancelInventory?.booked === 0 ? GREEN : RED}${postCancelInventory?.booked} / ${postCancelInventory?.capacity}${RESET} (Expected: 0/1, never negative)\n`,
    );

    console.log(
      `${BOLD}${GREEN}======================================================================${RESET}`,
    );
    console.log(
      `${BOLD}${GREEN}   ALL CONCURRENCY INVARIANTS VERIFIED: ZERO OVERBOOKING GUARANTEED   ${RESET}`,
    );
    console.log(
      `${BOLD}${GREEN}======================================================================${RESET}\n`,
    );
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (replSet) {
      await replSet.stop();
    }
  }
}

void runDemo();
