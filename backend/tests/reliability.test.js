/**
 * reliability.test.js
 * --------------------
 * Tests for Task 7:
 *   - recordNoShow increments no_show count correctly
 *   - reliability_flag is NOT set below threshold
 *   - reliability_flag IS set at threshold
 *   - flagging is idempotent (re-running doesn't break anything)
 *   - getFlaggedUsers returns only flagged users
 *
 * Uses Node's built-in test runner (node --test), no new framework.
 */
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { v4: uuid } = require("uuid");
const { setupTestDb, teardownTestDb } = require("./testDb");

let db;

before(async () => {
  db = await setupTestDb();
});
after(() => teardownTestDb());

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
async function seedUser(suffix = "") {
  const bcrypt = require("bcryptjs");
  const hash = await bcrypt.hash("password1", 4);
  const id = uuid();
  await db.prepare(
    `INSERT INTO users (id, name, email, phone, department, year, usn, role, password_hash, verified, admin_verified)
     VALUES (?, ?, ?, '9876543210', 'ECE', '2nd yr', ?, 'student', ?, 1, 1)`
  ).run(id, `User${suffix}`, `rel_${id}@test.edu`, `USN${id.slice(0,6)}`, hash);
  return id;
}

async function seedSeller() {
  return seedUser("seller");
}

async function markNoShow(buyerId, sellerId, n = 1) {
  // Creates n request rows with status 'no_show' for this buyer
  for (let i = 0; i < n; i++) {
    const listingId = uuid();
    const requestId = uuid();
    await db.prepare(
      `INSERT INTO listings (id, seller_id, item_name, category, price, quantity, status, expires_at)
       VALUES (?, ?, 'Sensor', 'Sensors', 100, 1, 'available', datetime('now','+60 days'))`
    ).run(listingId, sellerId);
    await db.prepare(
      `INSERT INTO requests (id, listing_id, buyer_id, quantity, status, accepted_at)
       VALUES (?, ?, ?, 1, 'no_show', datetime('now','-5 days'))`
    ).run(requestId, listingId, buyerId);
  }
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------
describe("recordNoShow", () => {
  let recordNoShow, getFlaggedUsers, NO_SHOW_THRESHOLD;

  before(() => {
    const svc = require("../src/services/reliabilityService");
    recordNoShow      = svc.recordNoShow;
    getFlaggedUsers   = svc.getFlaggedUsers;
    NO_SHOW_THRESHOLD = svc.NO_SHOW_THRESHOLD;
  });

  it("does NOT set reliability_flag below threshold", async () => {
    const buyerId  = await seedUser("belowThresh");
    const sellerId = await seedSeller();

    // Seed (threshold - 1) no-shows directly in the DB
    await markNoShow(buyerId, sellerId, NO_SHOW_THRESHOLD - 1);

    const { flagged } = await recordNoShow(buyerId);
    assert.equal(flagged, false, "should not be flagged below threshold");

    const user = await db.prepare("SELECT reliability_flag FROM users WHERE id = ?").get(buyerId);
    assert.equal(parseInt(user.reliability_flag || 0, 10), 0, "reliability_flag should remain 0");
  });

  it("sets reliability_flag = 1 at threshold", async () => {
    const buyerId  = await seedUser("atThresh");
    const sellerId = await seedSeller();

    // Seed exactly threshold no-shows
    await markNoShow(buyerId, sellerId, NO_SHOW_THRESHOLD);

    const { noShowCount, flagged } = await recordNoShow(buyerId);
    assert.ok(noShowCount >= NO_SHOW_THRESHOLD, `expected count >= ${NO_SHOW_THRESHOLD}, got ${noShowCount}`);
    assert.equal(flagged, true, "should be flagged at threshold");

    const user = await db.prepare("SELECT reliability_flag FROM users WHERE id = ?").get(buyerId);
    assert.equal(parseInt(user.reliability_flag, 10), 1, "reliability_flag should be 1");
  });

  it("getFlaggedUsers returns the flagged user", async () => {
    const buyerId  = await seedUser("inFlaggedList");
    const sellerId = await seedSeller();

    await markNoShow(buyerId, sellerId, NO_SHOW_THRESHOLD);
    await recordNoShow(buyerId);

    const flagged = await getFlaggedUsers();
    const found   = flagged.find((u) => u.id === buyerId);
    assert.ok(found, "flagged user should appear in getFlaggedUsers()");
    assert.ok(parseInt(found.no_show_count, 10) >= NO_SHOW_THRESHOLD);
  });

  it("flagging is idempotent — calling recordNoShow again doesn't break state", async () => {
    const buyerId  = await seedUser("idempotent");
    const sellerId = await seedSeller();

    await markNoShow(buyerId, sellerId, NO_SHOW_THRESHOLD);
    await recordNoShow(buyerId);
    // Call again — should not throw, flag stays 1
    const { flagged } = await recordNoShow(buyerId);
    assert.equal(flagged, true);

    const user = await db.prepare("SELECT reliability_flag FROM users WHERE id = ?").get(buyerId);
    assert.equal(parseInt(user.reliability_flag, 10), 1, "reliability_flag should still be 1");
  });

  it("unflagged user is NOT returned by getFlaggedUsers", async () => {
    const cleanBuyer = await seedUser("clean");
    const flagged    = await getFlaggedUsers();
    const found      = flagged.find((u) => u.id === cleanBuyer);
    assert.ok(!found, "clean user should not appear in getFlaggedUsers()");
  });
});
