/**
 * pricing.test.js
 * ----------------
 * Tests for Tasks 12 & 13:
 *   - suggestPrice condition-factor ordering
 *   - suggestPrice reference-table fallback
 *   - isSuspiciouslyLowPrice
 *   - refreshPriceReferences (≥3 sales gate, ignore sales >30 days old)
 *   - flagStalePricedListings (>40% drift, no duplicate flags, skip free)
 *   - runDailyPricingSweep (returns summary object)
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
async function seedUser() {
  const bcrypt = require("bcryptjs");
  const hash = await bcrypt.hash("pw123456", 4);
  const id = uuid();
  await db.prepare(
    `INSERT INTO users (id, name, email, phone, department, year, usn, role, password_hash, verified, admin_verified)
     VALUES (?, 'Test', ?, '9876543210', 'ECE', '2nd yr', ?, 'student', ?, 1, 1)`
  ).run(id, `u_${id}@test.edu`, `USN${id.slice(0, 6)}`, hash);
  return id;
}

async function seedListing({ sellerId, item_name, category, price, status = "available", condition = "used_working" }) {
  const id = uuid();
  await db.prepare(
    `INSERT INTO listings (id, seller_id, item_name, category, price, quantity, status, condition, expires_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?, datetime('now', '+60 days'))`
  ).run(id, sellerId, item_name, category, price, status, condition);
  return id;
}

async function seedDeliveredSale({ sellerId, buyerId, item_name, category, price, daysAgo = 5 }) {
  const listingId = uuid();
  const requestId = uuid();
  const deliveredAt = new Date(Date.now() - daysAgo * 86400000).toISOString();
  await db.prepare(
    `INSERT INTO listings (id, seller_id, item_name, category, price, quantity, status, condition, expires_at)
     VALUES (?, ?, ?, ?, ?, 1, 'claimed', 'used_working', datetime('now', '+60 days'))`
  ).run(listingId, sellerId, item_name, category, price);
  await db.prepare(
    `INSERT INTO requests (id, listing_id, buyer_id, quantity, status, accepted_at, delivered_confirmed_at)
     VALUES (?, ?, ?, 1, 'delivered', datetime('now', '-10 days'), ?)`
  ).run(requestId, listingId, buyerId, deliveredAt);
  return { listingId, requestId };
}

async function seedPriceRef({ category, item_key, base_price }) {
  const id = uuid();
  await db.prepare(
    `INSERT OR IGNORE INTO price_reference (id, category, item_key, base_price) VALUES (?, ?, ?, ?)`
  ).run(id, category, item_key, base_price);
  return id;
}

// ---------------------------------------------------------------------------
// isSuspiciouslyLowPrice — pure function, no DB needed
// ---------------------------------------------------------------------------
describe("isSuspiciouslyLowPrice", () => {
  let fn;
  before(() => {
    fn = require("../src/services/pricingService").isSuspiciouslyLowPrice;
  });

  it("returns false for price=0 (free giveaway)", () => {
    assert.equal(fn(0, 400), false);
  });

  it("returns false when suggestion is null", () => {
    assert.equal(fn(100, null), false);
  });

  it("returns false when price >= 30% of suggestion", () => {
    assert.equal(fn(120, 400), false); // 120/400 = 30% — exactly on threshold, not under
  });

  it("returns true when price is under 30% of suggestion", () => {
    assert.equal(fn(99, 400), true);  // 99/400 = 24.75%
  });

  it("returns true for very low price vs large suggestion", () => {
    assert.equal(fn(10, 1000), true);
  });

  it("returns false when suggestion is 0", () => {
    assert.equal(fn(50, 0), false);
  });
});

// ---------------------------------------------------------------------------
// suggestPrice — condition-factor ordering
// ---------------------------------------------------------------------------
describe("suggestPrice: condition-factor ordering", () => {
  let suggestPrice;
  let sellerId, buyerId;

  before(async () => {
    suggestPrice = require("../src/services/pricingService").suggestPrice;
    sellerId = await seedUser();
    buyerId  = await seedUser();
    // Seed price_reference so we have a reliable base price
    await db.prepare(`DELETE FROM price_reference WHERE category = 'Tools'`).run();
    await seedPriceRef({ category: "Tools", item_key: "multimeter", base_price: 1000 });
  });

  it("new > like_new > used_working > heavily_used for same base", async () => {
    const prices = await Promise.all([
      suggestPrice({ category: "Tools", item_name: "Multimeter DT-830", condition: "new" }),
      suggestPrice({ category: "Tools", item_name: "Multimeter DT-830", condition: "like_new" }),
      suggestPrice({ category: "Tools", item_name: "Multimeter DT-830", condition: "used_working" }),
      suggestPrice({ category: "Tools", item_name: "Multimeter DT-830", condition: "heavily_used" }),
    ]);
    const [pNew, pLikeNew, pUsed, pHeavy] = prices;

    assert.ok(pNew    !== null, "new should return a price");
    assert.ok(pLikeNew !== null, "like_new should return a price");
    assert.ok(pUsed   !== null, "used_working should return a price");
    assert.ok(pHeavy  !== null, "heavily_used should return a price");

    assert.ok(pNew > pLikeNew,   `new(${pNew}) should be > like_new(${pLikeNew})`);
    assert.ok(pLikeNew > pUsed,  `like_new(${pLikeNew}) should be > used_working(${pUsed})`);
    assert.ok(pUsed > pHeavy,    `used_working(${pUsed}) should be > heavily_used(${pHeavy})`);
  });

  it("returns null when no price_reference entry exists for the item", async () => {
    const price = await suggestPrice({
      category:  "Tools",
      item_name: "QuantumFluxCapacitorXYZ999",
      condition: "new",
    });
    assert.equal(price, null);
  });
});

// ---------------------------------------------------------------------------
// suggestPrice — reference-table fallback
// ---------------------------------------------------------------------------
describe("suggestPrice: price_reference fallback", () => {
  let suggestPrice;
  let sellerId;

  before(async () => {
    suggestPrice = require("../src/services/pricingService").suggestPrice;
    sellerId     = await seedUser();
    await db.prepare(`DELETE FROM price_reference WHERE category = 'Sensors'`).run();
    await seedPriceRef({ category: "Sensors", item_key: "ultrasonic", base_price: 70 });
  });

  it("uses price_reference when no delivered sales exist", async () => {
    const price = await suggestPrice({
      category:  "Sensors",
      item_name: "HC-SR04 Ultrasonic Sensor",
      condition: "new",
    });
    // new condition_factor = 1.0; demand_factor ≈ 1.0; so result ≈ 70
    assert.ok(price !== null, "should return a price from reference table");
    assert.ok(price >= 50 && price <= 120, `expected price near 70, got ${price}`);
  });

  it("prefers recent delivered sales over reference table", async () => {
    const buyerId = await seedUser();
    // Seed 5 delivered sales at price 200 — well above the reference of 70
    for (let i = 0; i < 5; i++) {
      await seedDeliveredSale({
        sellerId, buyerId,
        item_name: "HC-SR04 Ultrasonic Sensor",
        category:  "Sensors",
        price:     200,
        daysAgo:   3,
      });
    }
    const price = await suggestPrice({
      category:  "Sensors",
      item_name: "HC-SR04 Ultrasonic Sensor",
      condition: "new",
    });
    // Should use median of 200, not 70 from reference
    assert.ok(price !== null);
    assert.ok(price > 100, `expected price based on sales ~200, got ${price}`);
  });
});

// ---------------------------------------------------------------------------
// refreshPriceReferences
// ---------------------------------------------------------------------------
describe("refreshPriceReferences", () => {
  let refreshPriceReferences;
  let sellerId, buyerId;

  before(async () => {
    refreshPriceReferences = require("../src/services/pricingService").refreshPriceReferences;
    sellerId = await seedUser();
    buyerId  = await seedUser();
  });

  it("does NOT update reference when fewer than 3 recent sales", async () => {
    await db.prepare(`DELETE FROM price_reference WHERE category = 'Power & Wiring'`).run();
    const refId = await seedPriceRef({ category: "Power & Wiring", item_key: "relay", base_price: 40 });

    // Seed only 2 delivered sales (below the ≥3 gate)
    for (let i = 0; i < 2; i++) {
      await seedDeliveredSale({
        sellerId, buyerId,
        item_name: "Relay Module 5V",
        category: "Power & Wiring",
        price: 999, // would skew base_price if gate fails
        daysAgo: 3,
      });
    }

    await refreshPriceReferences();

    const ref = await db.prepare("SELECT base_price FROM price_reference WHERE id = ?").get(refId);
    assert.equal(ref.base_price, 40, "base_price should not change with <3 sales");
  });

  it("DOES update reference when ≥3 recent sales exist", async () => {
    await db.prepare(`DELETE FROM price_reference WHERE category = 'Power & Wiring'`).run();
    const refId = await seedPriceRef({ category: "Power & Wiring", item_key: "relay", base_price: 40 });

    for (let i = 0; i < 4; i++) {
      await seedDeliveredSale({
        sellerId, buyerId,
        item_name: "Relay Module 5V",
        category: "Power & Wiring",
        price: 200,
        daysAgo: 3,
      });
    }

    await refreshPriceReferences();

    const ref = await db.prepare("SELECT base_price FROM price_reference WHERE id = ?").get(refId);
    assert.ok(ref.base_price > 40, `base_price should have updated from 40, got ${ref.base_price}`);
  });

  it("ignores sales older than 30 days", async () => {
    await db.prepare(`DELETE FROM price_reference WHERE category = 'Passive Components'`).run();
    const refId = await seedPriceRef({ category: "Passive Components", item_key: "breadboard", base_price: 80 });

    // Seed 4 sales but all 40 days old (outside 30-day window)
    for (let i = 0; i < 4; i++) {
      await seedDeliveredSale({
        sellerId, buyerId,
        item_name: "Breadboard 830-point",
        category: "Passive Components",
        price: 9999, // would obviously skew base_price
        daysAgo: 40,
      });
    }

    await refreshPriceReferences();

    const ref = await db.prepare("SELECT base_price FROM price_reference WHERE id = ?").get(refId);
    assert.equal(ref.base_price, 80, "base_price must not change when all sales are outside 30-day window");
  });
});

// ---------------------------------------------------------------------------
// flagStalePricedListings
// ---------------------------------------------------------------------------
describe("flagStalePricedListings", () => {
  let flagStalePricedListings;
  let sellerId;

  before(async () => {
    flagStalePricedListings = require("../src/services/pricingService").flagStalePricedListings;
    sellerId = await seedUser();
    // Seed a reference so suggestPrice returns a deterministic value
    await db.prepare(`DELETE FROM price_reference WHERE category = 'Microcontrollers'`).run();
    await seedPriceRef({ category: "Microcontrollers", item_key: "arduino uno", base_price: 400 });
  });

  it("creates a LOW flag when price is >40% below suggestion", async () => {
    // Suggestion ~260 (400 * 0.65 used_working); list at 60 → ~23% of suggestion → drifted
    const listingId = await seedListing({
      sellerId,
      item_name: "Arduino Uno R3",
      category:  "Microcontrollers",
      price:     60,
      condition: "used_working",
    });

    const { flagged } = await flagStalePricedListings();
    assert.ok(flagged >= 1, "should have flagged at least one listing");

    const flag = await db.prepare(
      `SELECT * FROM flags WHERE listing_id = ? AND status = 'open'`
    ).get(listingId);
    assert.ok(flag, "flag row should exist");
    assert.equal(flag.severity, "low");
    assert.ok(flag.reason.startsWith("Price drift:"), `reason should start with 'Price drift:', got: ${flag.reason}`);
  });

  it("does NOT create a duplicate flag on second run", async () => {
    // Run again — the same listing should not get a second flag
    await flagStalePricedListings();

    const flags = await db.prepare(
      `SELECT COUNT(*) as c FROM flags WHERE reported_by = 'auto-price-check' AND reason LIKE 'Price drift:%' AND status = 'open'`
    ).get();
    // Count should be same as before (no new duplicates)
    const allFlags = await db.prepare(
      `SELECT COUNT(*) as c FROM flags WHERE reason LIKE 'Price drift:%'`
    ).get();
    // Just assert that two consecutive runs don't double the count
    const afterSecondRun = parseInt(allFlags.c, 10);
    assert.ok(afterSecondRun >= 1, "at least one flag should exist");

    // Verify no duplicate open flags for the same listing
    const listingFlags = await db.prepare(
      `SELECT COUNT(*) as c FROM flags WHERE reason LIKE 'Price drift:%' AND status = 'open' AND listing_id IN (SELECT id FROM listings WHERE item_name = 'Arduino Uno R3')`
    ).get();
    assert.equal(parseInt(listingFlags.c, 10), 1, "should have exactly one open drift flag per listing, not duplicates");
  });

  it("skips free (price=0) listings", async () => {
    const freeListing = await seedListing({
      sellerId,
      item_name: "Arduino Uno R3",
      category:  "Microcontrollers",
      price:     0,
    });

    const beforeCount = parseInt(
      (await db.prepare("SELECT COUNT(*) as c FROM flags WHERE listing_id = ?").get(freeListing)).c,
      10
    );
    await flagStalePricedListings();
    const afterCount = parseInt(
      (await db.prepare("SELECT COUNT(*) as c FROM flags WHERE listing_id = ?").get(freeListing)).c,
      10
    );
    assert.equal(beforeCount, afterCount, "free listing should not be flagged");
  });

  it("does NOT flag a listing whose price is within 40% of suggestion", async () => {
    // Suggestion ~260 (400 * 0.65); price 250 is within 40% band
    const goodListing = await seedListing({
      sellerId,
      item_name: "Arduino Uno R3",
      category:  "Microcontrollers",
      price:     250,
      condition: "used_working",
    });

    const before = parseInt(
      (await db.prepare("SELECT COUNT(*) as c FROM flags WHERE listing_id = ? AND reason LIKE 'Price drift:%'").get(goodListing)).c,
      10
    );
    await flagStalePricedListings();
    const after = parseInt(
      (await db.prepare("SELECT COUNT(*) as c FROM flags WHERE listing_id = ? AND reason LIKE 'Price drift:%'").get(goodListing)).c,
      10
    );
    assert.equal(before, after, "fairly-priced listing should not be flagged");
  });
});

// ---------------------------------------------------------------------------
// runDailyPricingSweep
// ---------------------------------------------------------------------------
describe("runDailyPricingSweep", () => {
  it("returns a summary object with the correct shape", async () => {
    const { runDailyPricingSweep } = require("../src/services/pricingService");
    const summary = await runDailyPricingSweep();

    assert.ok(summary, "should return a summary");
    assert.ok(typeof summary.ran_at === "string", "ran_at should be a string");
    assert.ok(typeof summary.price_references === "object", "price_references key missing");
    assert.ok(typeof summary.stale_listings   === "object", "stale_listings key missing");

    const { price_references, stale_listings } = summary;
    assert.ok(typeof price_references.checked === "number");
    assert.ok(typeof price_references.updated === "number");
    assert.ok(typeof stale_listings.checked   === "number");
    assert.ok(typeof stale_listings.flagged   === "number");
    assert.ok(typeof stale_listings.skipped   === "number");
  });
});
