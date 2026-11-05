/**
 * seed.ts — Idempotent database seed script.
 *
 * Run with: npm run seed --workspace=server
 * (or: cd server && npm run seed)
 *
 * ⚠️  DEMO CREDENTIALS — never use these passwords in production.
 *
 * Uses "find or create" logic (findOne → skip if exists) so it is safe to
 * re-run at any time without duplicating data.
 *
 * Design decisions:
 * - We import models directly (no service layer) so the seed does not depend
 *   on business-rule guards that would reject back-dated reservations.
 * - Argon2id hashing is intentionally reused from the production password
 *   helper so passwords can be verified by the real login endpoint.
 * - We build RoomInventory documents manually (one doc per room-type per
 *   occupied night) to match what the booking service writes, keeping the
 *   "booked" counter in sync with seeded reservations.
 * - totalInventory is kept deliberately small (1-3 rooms) so the sold-out
 *   scenario is trivially reproducible in a demo.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { hashPassword } from '../common/utils/password.js';
import { generateReservationReference } from '../common/utils/reference.js';
import { getDateRangeArray } from '../common/utils/date.js';
import { User } from '../models/user.model.js';
import { RoomType } from '../models/room-type.model.js';
import { RoomInventory } from '../models/room-inventory.model.js';
import { Reservation } from '../models/reservation.model.js';
import {
  ReservationStatuses,
  type ReservationStatus,
} from '../common/state/reservation-state-machine.js';
import { UserRoles } from '../types/auth.types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** "today" anchored to UTC midnight so seed dates are always relative. */
function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function subDays(dateStr: string, n: number): string {
  return addDays(dateStr, -n);
}

/** Compute server-side total (same formula as pricing.ts). */
function computeTotal(
  checkIn: string,
  checkOut: string,
  pricePerNight: number,
  roomCount: number,
): { nights: number; totalAmount: number } {
  const msPerDay = 86_400_000;
  const nights = Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / msPerDay,
  );
  return { nights, totalAmount: nights * pricePerNight * roomCount };
}

// ---------------------------------------------------------------------------
// Seed data definitions
// ---------------------------------------------------------------------------

const USERS = [
  {
    name: 'Grand Horizon Admin',
    email: 'admin@grandhorizon.com',
    password: 'Admin@123456',
    role: UserRoles.ADMIN,
  },
  {
    name: 'Front Desk Staff',
    email: 'staff@grandhorizon.com',
    password: 'Staff@123456',
    role: UserRoles.STAFF,
  },
  {
    name: 'Alice Guest',
    email: 'alice@example.com',
    password: 'Guest@123456',
    role: UserRoles.GUEST,
  },
  {
    name: 'Bob Guest',
    email: 'bob@example.com',
    password: 'Guest@123456',
    role: UserRoles.GUEST,
  },
] as const;

const ROOM_TYPES = [
  {
    name: 'Standard Single',
    description: 'Cosy room with a queen bed, ideal for solo travellers.',
    capacity: 1,
    facilities: ['Free Wi-Fi', 'Air conditioning', 'Smart TV', 'En-suite bathroom'],
    pricePerNight: 89,
    totalInventory: 2, // small → sold-out is easy to demo
    isActive: true,
    imageUrl: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800',
  },
  {
    name: 'Deluxe Double',
    description: 'Spacious room with a king bed and city views.',
    capacity: 2,
    facilities: ['Free Wi-Fi', 'Air conditioning', 'Smart TV', 'Mini-bar', 'En-suite bathroom'],
    pricePerNight: 149,
    totalInventory: 3,
    isActive: true,
    imageUrl: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800',
  },
  {
    name: 'Family Suite',
    description: 'Two-bedroom suite perfect for families up to four.',
    capacity: 4,
    facilities: [
      'Free Wi-Fi',
      'Air conditioning',
      'Smart TV',
      'Kitchenette',
      'Living area',
      'En-suite bathrooms',
    ],
    pricePerNight: 249,
    totalInventory: 2,
    isActive: true,
    imageUrl: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800',
  },
  {
    name: 'Penthouse Suite',
    description: 'Top-floor luxury suite with panoramic skyline views and private terrace.',
    capacity: 2,
    facilities: [
      'Free Wi-Fi',
      'Air conditioning',
      '4K Smart TV',
      'Mini-bar',
      'Jacuzzi',
      'Butler service',
      'Private terrace',
    ],
    pricePerNight: 499,
    totalInventory: 1, // exactly 1 → concurrency demo target
    isActive: true,
    imageUrl: 'https://images.unsplash.com/photo-1631049552057-403cdb8f0658?w=800',
  },
  {
    name: 'Garden Villa',
    description: 'Private villa with lush garden, pool access, and 3 bedrooms.',
    capacity: 6,
    facilities: [
      'Free Wi-Fi',
      'Air conditioning',
      '4K Smart TV',
      'Full kitchen',
      'Private pool',
      'Garden',
      'BBQ area',
    ],
    pricePerNight: 699,
    totalInventory: 1,
    isActive: false, // inactive → tests "isActive filter" in availability search
    imageUrl: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=800',
  },
] as const;

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

async function seed(): Promise<void> {
  const mongoUri = process.env['MONGODB_URI'];
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not set. Copy .env.example → .env and fill in values.');
  }

  console.log('🌱  Connecting to MongoDB…');
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10_000 });
  console.log('✅  Connected.\n');

  // ── 1. Users ──────────────────────────────────────────────────────────────
  console.log('👤  Seeding users…');
  const userDocs: { [email: string]: mongoose.Types.ObjectId } = {};

  for (const u of USERS) {
    const existing = await User.findOne({ email: u.email }).lean();
    if (existing) {
      console.log(`    ↩  ${u.role.padEnd(5)}  ${u.email}  (already exists)`);
      userDocs[u.email] = existing._id as mongoose.Types.ObjectId;
    } else {
      const passwordHash = await hashPassword(u.password);
      const created = await User.create({
        name: u.name,
        email: u.email,
        passwordHash,
        role: u.role,
        isActive: true,
      });
      console.log(`    ✔  ${u.role.padEnd(5)}  ${u.email}`);
      userDocs[u.email] = created._id as mongoose.Types.ObjectId;
    }
  }

  // ── 2. Room Types ─────────────────────────────────────────────────────────
  console.log('\n🏨  Seeding room types…');
  const roomTypeDocs: { [name: string]: mongoose.Types.ObjectId } = {};

  for (const rt of ROOM_TYPES) {
    const existing = await RoomType.findOne({ name: rt.name }).lean();
    if (existing) {
      console.log(`    ↩  "${rt.name}"  (already exists)`);
      roomTypeDocs[rt.name] = existing._id as mongoose.Types.ObjectId;
    } else {
      const created = await RoomType.create({ ...rt });
      console.log(`    ✔  "${rt.name}"  inventory=${rt.totalInventory}  active=${rt.isActive}`);
      roomTypeDocs[rt.name] = created._id as mongoose.Types.ObjectId;
    }
  }

  // ── 3. Reservations + Inventory ───────────────────────────────────────────
  /**
   * We seed reservations in multiple statuses so reviewers can see every
   * lifecycle stage without manually clicking through the UI.
   *
   * Statuses covered:
   *  CHECKED_OUT  — historical, booked nights are already released (no active inventory)
   *  CHECKED_IN   — ongoing stay, inventory consumed
   *  CONFIRMED    — upcoming, inventory consumed
   *  PENDING      — just created, inventory consumed
   *  CANCELLED    — cancelled, inventory already released (no active inventory)
   *
   * Inventory docs are written only for statuses that hold real inventory
   * (CONFIRMED, CHECKED_IN, PENDING).  CHECKED_OUT and CANCELLED have already
   * released their rooms, so we write NO inventory docs for them.
   */

  const today = utcToday();

  type ReservationSeed = {
    guestEmail: string;
    roomTypeName: string;
    checkIn: string;
    checkOut: string;
    guestCount: number;
    roomCount: number;
    status: ReservationStatus;
    holdInventory: boolean; // true → write RoomInventory docs for these nights
    reason: string; // description for logging
  };

  const reservationSeeds: ReservationSeed[] = [
    // Past completed stay — Alice in Standard Single
    {
      guestEmail: 'alice@example.com',
      roomTypeName: 'Standard Single',
      checkIn: subDays(today, 10),
      checkOut: subDays(today, 7),
      guestCount: 1,
      roomCount: 1,
      status: ReservationStatuses.CHECKED_OUT,
      holdInventory: false,
      reason: 'past CHECKED_OUT stay',
    },
    // Past cancelled — Bob tried to book Deluxe Double
    {
      guestEmail: 'bob@example.com',
      roomTypeName: 'Deluxe Double',
      checkIn: subDays(today, 5),
      checkOut: subDays(today, 3),
      guestCount: 2,
      roomCount: 1,
      status: ReservationStatuses.CANCELLED,
      holdInventory: false,
      reason: 'past CANCELLED reservation',
    },
    // Current in-progress stay — Alice in Deluxe Double (checked in yesterday)
    {
      guestEmail: 'alice@example.com',
      roomTypeName: 'Deluxe Double',
      checkIn: subDays(today, 1),
      checkOut: addDays(today, 2),
      guestCount: 2,
      roomCount: 1,
      status: ReservationStatuses.CHECKED_IN,
      holdInventory: true,
      reason: 'active CHECKED_IN stay',
    },
    // Upcoming confirmed — Bob in Family Suite
    {
      guestEmail: 'bob@example.com',
      roomTypeName: 'Family Suite',
      checkIn: addDays(today, 3),
      checkOut: addDays(today, 6),
      guestCount: 3,
      roomCount: 1,
      status: ReservationStatuses.CONFIRMED,
      holdInventory: true,
      reason: 'upcoming CONFIRMED booking',
    },
    // Fresh pending — Alice in Penthouse Suite (the 1-room type, great for demo)
    {
      guestEmail: 'alice@example.com',
      roomTypeName: 'Penthouse Suite',
      checkIn: addDays(today, 7),
      checkOut: addDays(today, 9),
      guestCount: 2,
      roomCount: 1,
      status: ReservationStatuses.PENDING,
      holdInventory: true,
      reason: 'fresh PENDING booking (Penthouse — inventory now full for those nights)',
    },
  ];

  console.log('\n📋  Seeding reservations…');

  for (const seed of reservationSeeds) {
    const guestId = userDocs[seed.guestEmail];
    const roomTypeId = roomTypeDocs[seed.roomTypeName];

    if (!guestId || !roomTypeId) {
      console.warn(`    ⚠  Skipping: cannot resolve guest/roomType for "${seed.reason}"`);
      continue;
    }

    // Find the pricePerNight from our seed data
    const rtData = ROOM_TYPES.find((r) => r.name === seed.roomTypeName);
    if (!rtData) {
      console.warn(`    ⚠  Skipping: no room type data for "${seed.roomTypeName}"`);
      continue;
    }

    // Build a stable idempotency key so re-runs skip gracefully
    const idempotencyKey = `seed-${seed.guestEmail}-${seed.roomTypeName}-${seed.checkIn}`;

    // Check whether this reservation already exists (by idempotencyKey + guest)
    const existing = await Reservation.findOne({
      guest: guestId,
      idempotencyKey,
    }).lean();

    if (existing) {
      console.log(
        `    ↩  ${seed.status.padEnd(12)} "${seed.roomTypeName}"  ${seed.checkIn} → ${seed.checkOut}  (already exists)`,
      );
      continue;
    }

    const { nights, totalAmount } = computeTotal(
      seed.checkIn,
      seed.checkOut,
      rtData.pricePerNight,
      seed.roomCount,
    );

    if (nights <= 0) {
      console.warn(`    ⚠  Skipping "${seed.reason}": computed 0 nights (past dates may overlap)`);
      continue;
    }

    // Build status history to look realistic
    const history: Array<{
      fromStatus: ReservationStatus | null;
      toStatus: ReservationStatus;
      changedAt: Date;
      reason?: string;
    }> = [{ fromStatus: null, toStatus: ReservationStatuses.PENDING, changedAt: new Date() }];

    if (
      seed.status === ReservationStatuses.CONFIRMED ||
      seed.status === ReservationStatuses.CHECKED_IN ||
      seed.status === ReservationStatuses.CHECKED_OUT
    ) {
      history.push({
        fromStatus: ReservationStatuses.PENDING,
        toStatus: ReservationStatuses.CONFIRMED,
        changedAt: new Date(),
      });
    }
    if (
      seed.status === ReservationStatuses.CHECKED_IN ||
      seed.status === ReservationStatuses.CHECKED_OUT
    ) {
      history.push({
        fromStatus: ReservationStatuses.CONFIRMED,
        toStatus: ReservationStatuses.CHECKED_IN,
        changedAt: new Date(),
      });
    }
    if (seed.status === ReservationStatuses.CHECKED_OUT) {
      history.push({
        fromStatus: ReservationStatuses.CHECKED_IN,
        toStatus: ReservationStatuses.CHECKED_OUT,
        changedAt: new Date(),
      });
    }
    if (seed.status === ReservationStatuses.CANCELLED) {
      history.push({
        fromStatus: ReservationStatuses.PENDING,
        toStatus: ReservationStatuses.CANCELLED,
        changedAt: new Date(),
        reason: 'Guest cancelled (seed)',
      });
    }

    await Reservation.create({
      reference: generateReservationReference(),
      guest: guestId,
      roomType: roomTypeId,
      checkIn: seed.checkIn,
      checkOut: seed.checkOut,
      guestCount: seed.guestCount,
      roomCount: seed.roomCount,
      priceSnapshot: rtData.pricePerNight,
      totalAmount,
      status: seed.status,
      idempotencyKey,
      statusHistory: history,
    });

    // Write RoomInventory docs only for statuses that hold inventory
    if (seed.holdInventory) {
      const nights_ = getDateRangeArray(seed.checkIn, seed.checkOut); // [checkIn, checkOut)
      for (const dateStr of nights_) {
        await RoomInventory.findOneAndUpdate(
          { roomTypeId, date: dateStr },
          {
            $setOnInsert: { capacity: rtData.totalInventory },
            $inc: { booked: seed.roomCount },
          },
          { upsert: true, new: true },
        );
      }
    }

    console.log(
      `    ✔  ${seed.status.padEnd(12)} "${seed.roomTypeName}"  ${seed.checkIn} → ${seed.checkOut}  (${nights}n × $${rtData.pricePerNight} = $${totalAmount})`,
    );
  }

  // ── 4. Summary ────────────────────────────────────────────────────────────
  console.log('\n📊  Seed summary:');
  console.log(`    Users:        ${await User.countDocuments()}`);
  console.log(`    Room types:   ${await RoomType.countDocuments()}`);
  console.log(`    Reservations: ${await Reservation.countDocuments()}`);
  console.log(`    Inventory:    ${await RoomInventory.countDocuments()} night-docs`);

  console.log('\n🔑  Demo credentials (NEVER use in production):');
  console.log('    admin@grandhorizon.com   / Admin@123456  (ADMIN)');
  console.log('    staff@grandhorizon.com   / Staff@123456  (STAFF)');
  console.log('    alice@example.com        / Guest@123456  (GUEST)');
  console.log('    bob@example.com          / Guest@123456  (GUEST)');

  await mongoose.disconnect();
  console.log('\n✅  Seed complete.\n');
}

seed().catch((err: unknown) => {
  console.error('❌  Seed failed:', err);
  process.exit(1);
});
