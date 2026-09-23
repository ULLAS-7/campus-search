/**
 * raceCondition.test.js
 * ----------------------
 * Proves that two concurrent "request" calls for the same single-quantity
 * listing result in exactly one success and one 409 conflict.
 *
 * Uses Node's built-in test runner (node --test).
 */
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { v4: uuid } = require("uuid");
const { setupTestDb, teardownTestDb } = require("./testDb");

let db;

before(async () => {
  db = await setupTestDb();
});

after(() => {
  teardownTestDb();
});

// -------------------------------------------------------
// helpers
// -------------------------------------------------------
async function seedUsers(n = 2) {
  const bcrypt = require("bcryptjs");
  const hash   = await bcrypt.hash("password123", 4); // low rounds for speed
  const ids    = [];
  for (let i = 0; i < n; i++) {
    const id = uuid();
    await db.prepare(
      `INSERT INTO users (id, name, email, phone, department, year, usn, role, password_hash, verified, admin_verified)
       VALUES (?, ?, ?, ?, 'ECE', '2nd yr', ?, 'student', ?, 1, 1)`
    ).run(id, `User${i}`, `user${i}_${Date.now()}@test.edu`, `98765${i}${i}${i}${i}${i}${i}`, `USN${i}${Date.now()}`, hash);
    ids.push(id);
  }
  return ids;
}

async function seedListing(sellerId) {
  const id = uuid();
  await db.prepare(
    `INSERT INTO listings (id, seller_id, item_name, category, price, quantity, status, expires_at)
     VALUES (?, ?, 'Arduino Uno', 'Microcontrollers', 350, 1, 'available', datetime('now', '+60 days'))`
  ).run(id, sellerId);
  return id;
}

// -------------------------------------------------------
// tests
// -------------------------------------------------------
describe("Race condition: createRequest", () => {
  it("second concurrent request for same single-item listing gets 409", async () => {
    const [sellerId, buyer1Id, buyer2Id] = await seedUsers(3);
    const listingId = await seedListing(sellerId);

    // Load matchingService AFTER db is seeded so it uses the test db
    const { createRequest, HttpError } = require("../src/services/matchingService");

    // Fire both requests simultaneously — Promise.allSettled so we always get both results
    const [r1, r2] = await Promise.allSettled([
      createRequest(listingId, buyer1Id, 1),
      createRequest(listingId, buyer2Id, 1),
    ]);

    const results = [r1, r2];
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected  = results.filter((r) => r.status === "rejected");

    // Exactly one should succeed
    assert.equal(fulfilled.length, 1, "Exactly one request should succeed");

    // The other should reject with status 409
    assert.equal(rejected.length, 1, "Exactly one request should fail");
    const err = rejected[0].reason;
    assert.ok(err, "Rejection should have an error");
    assert.equal(err.status, 409, `Expected 409, got ${err.status}: ${err.message}`);

    // The listing quantity should be 0 and status 'pending'
    const listing = await db.prepare("SELECT * FROM listings WHERE id = ?").get(listingId);
    assert.equal(listing.quantity, 0, "Listing quantity should be 0 after one successful request");
    assert.equal(listing.status, "pending", "Listing should be pending");
  });

  it("two requests for a listing with quantity 2 both succeed", async () => {
    const [sellerId, buyer1Id, buyer2Id] = await seedUsers(3);
    const listingId = uuid();
    await db.prepare(
      `INSERT INTO listings (id, seller_id, item_name, category, price, quantity, status, expires_at)
       VALUES (?, ?, 'Sensor Pack', 'Sensors', 150, 2, 'available', datetime('now', '+60 days'))`
    ).run(listingId, sellerId);

    const { createRequest } = require("../src/services/matchingService");

    const [r1, r2] = await Promise.allSettled([
      createRequest(listingId, buyer1Id, 1),
      createRequest(listingId, buyer2Id, 1),
    ]);

    const fulfilled = [r1, r2].filter((r) => r.status === "fulfilled");
    assert.equal(fulfilled.length, 2, "Both requests should succeed for qty-2 listing");
  });

  it("buyer cannot request their own listing", async () => {
    const [sellerId] = await seedUsers(1);
    const listingId = await seedListing(sellerId);

    const { createRequest } = require("../src/services/matchingService");

    await assert.rejects(
      () => createRequest(listingId, sellerId, 1),
      (err) => {
        assert.equal(err.status, 400);
        return true;
      }
    );
  });
});
