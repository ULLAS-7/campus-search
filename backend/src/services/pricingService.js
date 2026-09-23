/**
 * pricingService.js
 * ------------------
 * Fair-price suggestion formula (Task 12) and daily sweep helpers (Task 13).
 *
 * Formula:
 *   suggested_price = round(base_price × condition_factor × age_decay × demand_factor)
 *
 * Sources (in priority order):
 *   1. Median of the last 10 DELIVERED sales for a similar item in the same category
 *      (matched by normalised shared keywords)
 *   2. price_reference seed table — common campus components with known market prices
 *   3. null — never invent a number when neither source has a match
 */
const { db } = require("../db");
const { v4: uuid } = require("uuid");

// ---------------------------------------------------------------------------
// Condition factors
// ---------------------------------------------------------------------------
const CONDITION_FACTORS = {
  new:           1.00,
  like_new:      0.85,
  used_working:  0.65,
  heavily_used:  0.45,
};

// ---------------------------------------------------------------------------
// Price reference seed data
// Each entry: { category, item_key, base_price }
// item_key is the normalised keyword used to match incoming listings.
// ---------------------------------------------------------------------------
const PRICE_REFERENCE_SEED = [
  // Microcontrollers
  { category: "Microcontrollers", item_key: "arduino uno",       base_price: 400  },
  { category: "Microcontrollers", item_key: "arduino mega",      base_price: 600  },
  { category: "Microcontrollers", item_key: "arduino nano",      base_price: 250  },
  { category: "Microcontrollers", item_key: "esp32",             base_price: 320  },
  { category: "Microcontrollers", item_key: "esp8266",           base_price: 180  },
  { category: "Microcontrollers", item_key: "nodemcu",           base_price: 180  },
  { category: "Microcontrollers", item_key: "raspberry pi",      base_price: 3000 },
  { category: "Microcontrollers", item_key: "stm32",             base_price: 800  },
  // Sensors
  { category: "Sensors",          item_key: "ultrasonic",        base_price: 70   },
  { category: "Sensors",          item_key: "hc-sr04",           base_price: 70   },
  { category: "Sensors",          item_key: "dht11",             base_price: 50   },
  { category: "Sensors",          item_key: "dht22",             base_price: 120  },
  { category: "Sensors",          item_key: "ir sensor",         base_price: 40   },
  { category: "Sensors",          item_key: "pir sensor",        base_price: 80   },
  { category: "Sensors",          item_key: "mpu6050",           base_price: 150  },
  { category: "Sensors",          item_key: "ldr",               base_price: 15   },
  { category: "Sensors",          item_key: "soil moisture",     base_price: 50   },
  // Motors & Actuators
  { category: "Motors & Actuators", item_key: "servo",           base_price: 70   },
  { category: "Motors & Actuators", item_key: "sg90",            base_price: 70   },
  { category: "Motors & Actuators", item_key: "stepper motor",   base_price: 200  },
  { category: "Motors & Actuators", item_key: "dc motor",        base_price: 80   },
  { category: "Motors & Actuators", item_key: "geared motor",    base_price: 120  },
  // Power & Wiring
  { category: "Power & Wiring",   item_key: "l298n",             base_price: 120  },
  { category: "Power & Wiring",   item_key: "motor driver",      base_price: 120  },
  { category: "Power & Wiring",   item_key: "relay",             base_price: 40   },
  { category: "Power & Wiring",   item_key: "lipo battery",      base_price: 350  },
  // Tools
  { category: "Tools",            item_key: "multimeter",        base_price: 300  },
  { category: "Tools",            item_key: "soldering",         base_price: 400  },
  { category: "Tools",            item_key: "oscilloscope",      base_price: 2500 },
  { category: "Tools",            item_key: "power supply",      base_price: 800  },
  // Full Kits
  { category: "Full Kits",        item_key: "starter kit",       base_price: 800  },
  { category: "Full Kits",        item_key: "robotics kit",      base_price: 1200 },
  { category: "Full Kits",        item_key: "line follower",     base_price: 700  },
  // Passive Components
  { category: "Passive Components", item_key: "resistor",        base_price: 30   },
  { category: "Passive Components", item_key: "capacitor",       base_price: 30   },
  { category: "Passive Components", item_key: "breadboard",      base_price: 80   },
  { category: "Passive Components", item_key: "jumper wire",     base_price: 60   },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalise a string to lowercase words, removing punctuation. */
function normalise(str) {
  return (str || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/** Extract words ≥3 chars from a normalised string. */
function keywords(str) {
  return normalise(str).split(" ").filter((w) => w.length >= 3);
}

/**
 * Check whether two item strings share at least one normalised keyword ≥3 chars.
 * Used to identify "similar" items for base price lookups.
 */
function shareKeyword(a, b) {
  const ka = new Set(keywords(a));
  const kb = keywords(b);
  return kb.some((w) => ka.has(w));
}

/**
 * Seed the price_reference table if it's empty.
 * Called once from seedPriceReferences() below.
 */
async function seedPriceReferencesIfEmpty() {
  try {
    const row = await db.prepare("SELECT COUNT(*) as c FROM price_reference").get();
    if (parseInt(row?.c || "0", 10) > 0) return;
    for (const entry of PRICE_REFERENCE_SEED) {
      await db.prepare(
        `INSERT OR IGNORE INTO price_reference (id, category, item_key, base_price)
         VALUES (?, ?, ?, ?)`
      ).run(uuid(), entry.category, entry.item_key, entry.base_price);
    }
    console.log("[pricingService] Seeded price_reference with", PRICE_REFERENCE_SEED.length, "entries.");
  } catch (err) {
    console.error("[pricingService] seed error:", err.message);
  }
}

/**
 * Compute the median of an array of numbers.
 * Returns null for an empty array.
 */
function median(values) {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

// ---------------------------------------------------------------------------
// Core formula
// ---------------------------------------------------------------------------

/**
 * Suggest a fair price for a listing.
 *
 * @param {{ category: string, item_name: string, condition: string, age_months?: number }} opts
 * @returns {Promise<number|null>} Suggested price (integer ₹) or null if no reference data.
 */
async function suggestPrice({ category, item_name, condition = "used_working", age_months = 0 }) {
  // ── 1. base_price: median of last 10 delivered sales for similar items ────
  let base = null;

  try {
    const delivered = await db.prepare(
      `SELECT l.price
       FROM listings l
       JOIN requests r ON r.listing_id = l.id
       WHERE r.status = 'delivered'
         AND l.category = ?
         AND l.price > 0
       ORDER BY r.delivered_confirmed_at DESC
       LIMIT 50`
    ).all(category);

    // Filter to "similar" items by keyword overlap
    const similar = delivered.filter((row, _idx, arr) => {
      // We need item_name from the listing — re-fetch is expensive;
      // instead use the joined item_name stored on the listing row
      return true; // all in the same category are candidates; narrowed below
    });

    // Re-query with item_name available
    const deliveredFull = await db.prepare(
      `SELECT l.item_name, l.price
       FROM listings l
       JOIN requests r ON r.listing_id = l.id
       WHERE r.status = 'delivered'
         AND l.category = ?
         AND l.price > 0
       ORDER BY r.delivered_confirmed_at DESC
       LIMIT 50`
    ).all(category);

    const matchedPrices = deliveredFull
      .filter((row) => shareKeyword(row.item_name, item_name))
      .slice(0, 10)
      .map((row) => row.price);

    base = median(matchedPrices);
  } catch (_) {}

  // ── 2. Fall back to price_reference seed table ───────────────────────────
  if (base === null) {
    try {
      const refs = await db.prepare(
        `SELECT item_key, base_price FROM price_reference WHERE category = ?`
      ).all(category);

      // Find the best-matching reference entry
      const matched = refs.filter((r) => shareKeyword(r.item_key, item_name));
      if (matched.length > 0) {
        base = median(matched.map((r) => r.base_price));
      }
    } catch (_) {}
  }

  // ── 3. No match — return null, never invent a number ─────────────────────
  if (base === null || base <= 0) return null;

  // ── condition_factor ──────────────────────────────────────────────────────
  const conditionFactor = CONDITION_FACTORS[condition] ?? CONDITION_FACTORS["used_working"];

  // ── age_decay ─────────────────────────────────────────────────────────────
  // Mild exponential decay: ~2% per month, capped at 40% total reduction.
  // Default age_months = 0 → factor = 1.0 (most sellers won't fill this in).
  const months  = Math.max(0, Number(age_months) || 0);
  const ageFactor = months > 0 ? Math.max(0.60, Math.exp(-0.02 * months)) : 1.0;

  // ── demand_factor ─────────────────────────────────────────────────────────
  // ±15% nudge based on open wishlists vs. available listings for this category
  let demandFactor = 1.0;
  try {
    const wishRow = await db.prepare(
      `SELECT COUNT(*) as c FROM wishlists WHERE category = ? AND status = 'open'`
    ).get(category);
    const listRow = await db.prepare(
      `SELECT COUNT(*) as c FROM listings WHERE category = ? AND status = 'available'`
    ).get(category);
    const wishes   = parseInt(wishRow?.c  || "0", 10);
    const listings = parseInt(listRow?.c  || "0", 10) || 1; // avoid divide-by-zero
    const ratio    = wishes / listings;
    // ratio > 1 → more demand than supply → nudge up (max +15%)
    // ratio < 1 → more supply than demand → nudge down (max -15%)
    demandFactor = 1.0 + Math.max(-0.15, Math.min(0.15, (ratio - 1) * 0.15));
  } catch (_) {}

  const suggested = Math.round(base * conditionFactor * ageFactor * demandFactor);
  return Math.max(1, suggested);
}

/**
 * Returns true if a listing price looks suspiciously low vs. the fair suggestion.
 * Free items (price === 0) are excluded — those are legitimate giveaways.
 *
 * @param {number} price        Actual listing price
 * @param {number|null} suggestion  suggestPrice() result
 * @returns {boolean}
 */
function isSuspiciouslyLowPrice(price, suggestion) {
  if (price === 0) return false;       // free is fine
  if (!suggestion || suggestion <= 0) return false; // no reference → can't judge
  return price < suggestion * 0.30;
}

module.exports = {
  suggestPrice,
  isSuspiciouslyLowPrice,
  seedPriceReferencesIfEmpty,
  refreshPriceReferences,
  flagStalePricedListings,
  runDailyPricingSweep,
  CONDITION_FACTORS,
  PRICE_REFERENCE_SEED,
};

// =============================================================================
// TASK 13 — Daily pricing sweep
// =============================================================================

/**
 * refreshPriceReferences()
 * -------------------------
 * For each row in price_reference, recompute base_price as the median of
 * delivered sales in the last 30 days for that item — but ONLY if there are
 * at least 3 recent sales (don't let one outlier sale skew a reference).
 *
 * @returns {{ checked: number, updated: number }}
 */
async function refreshPriceReferences() {
  const refs = await db.prepare("SELECT * FROM price_reference").all();
  let checked = 0;
  let updated  = 0;

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  for (const ref of refs) {
    checked++;
    try {
      const rows = await db.prepare(
        `SELECT l.price
         FROM listings l
         JOIN requests r ON r.listing_id = l.id
         WHERE r.status = 'delivered'
           AND l.category = ?
           AND l.price > 0
           AND r.delivered_confirmed_at >= ?
         ORDER BY r.delivered_confirmed_at DESC`
      ).all(ref.category, cutoff);

      // Only update if we have ≥3 recent sales that keyword-match the reference key
      const matchedPrices = rows
        .filter((row) => shareKeyword(row.item_name || ref.item_key, ref.item_key))
        .map((row) => row.price);

      // Re-query with item_name
      const rowsFull = await db.prepare(
        `SELECT l.item_name, l.price
         FROM listings l
         JOIN requests r ON r.listing_id = l.id
         WHERE r.status = 'delivered'
           AND l.category = ?
           AND l.price > 0
           AND r.delivered_confirmed_at >= ?`
      ).all(ref.category, cutoff);

      const filteredPrices = rowsFull
        .filter((row) => shareKeyword(row.item_name, ref.item_key))
        .map((row) => row.price);

      if (filteredPrices.length < 3) continue; // not enough data — leave untouched

      const newBase = median(filteredPrices);
      if (newBase && newBase !== ref.base_price) {
        await db.prepare(
          `UPDATE price_reference SET base_price = ?, updated_at = datetime('now') WHERE id = ?`
        ).run(newBase, ref.id);
        updated++;
      }
    } catch (_) {}
  }

  return { checked, updated };
}

/**
 * flagStalePricedListings()
 * --------------------------
 * For every 'available' listing with price > 0, recompute suggestPrice().
 * If the actual price differs from the fresh suggestion by >40% either
 * direction, create a LOW-severity flag with a "price drifted" reason.
 *
 * - Skips listings that already have an open flag with the same reason
 *   so re-running never creates duplicates.
 * - Skips free (price = 0) listings.
 * - Uses wording distinct from the scam-bait flag in Task 12 so admins
 *   can tell the two apart at a glance.
 *
 * @returns {{ checked: number, flagged: number, skipped: number }}
 */
const STALE_PRICE_REASON_PREFIX = "Price drift:";

async function flagStalePricedListings() {
  const listings = await db.prepare(
    `SELECT * FROM listings WHERE status = 'available' AND price > 0`
  ).all();

  let checked = 0;
  let flagged  = 0;
  let skipped  = 0;

  for (const listing of listings) {
    checked++;
    try {
      const suggestion = await suggestPrice({
        category:  listing.category,
        item_name: listing.item_name,
        condition: listing.condition || "used_working",
        age_months: 0,
      });

      if (!suggestion || suggestion <= 0) { skipped++; continue; }

      const ratio = listing.price / suggestion;
      // Flag if price is <60% or >140% of suggestion (>40% drift either way)
      if (ratio >= 0.60 && ratio <= 1.40) { skipped++; continue; }

      // Build the reason string — distinct from "possible scam bait" wording
      const direction = ratio < 0.60 ? "below" : "above";
      const pct       = Math.round(Math.abs(ratio - 1) * 100);
      const reason    = `${STALE_PRICE_REASON_PREFIX} listed at ₹${listing.price} is ${pct}% ${direction} the current fair estimate of ₹${suggestion}`;

      // Skip if an open flag with this exact reason prefix already exists
      const existing = await db.prepare(
        `SELECT id FROM flags WHERE listing_id = ? AND status = 'open' AND reason LIKE ?`
      ).get(listing.id, `${STALE_PRICE_REASON_PREFIX}%`);

      if (existing) { skipped++; continue; }

      await db.prepare(
        `INSERT INTO flags (id, listing_id, reason, severity, reported_by, status)
         VALUES (?, ?, ?, 'low', 'auto-price-check', 'open')`
      ).run(uuid(), listing.id, reason);

      flagged++;
    } catch (_) {}
  }

  return { checked, flagged, skipped };
}

/**
 * runDailyPricingSweep()
 * -----------------------
 * Runs both jobs and returns a summary object.
 * Used by server.js (setInterval + unref) and POST /api/admin/pricing/run-sweep.
 */
async function runDailyPricingSweep() {
  const refResult  = await refreshPriceReferences();
  const flagResult = await flagStalePricedListings();
  return {
    price_references: refResult,
    stale_listings:   flagResult,
    ran_at: new Date().toISOString(),
  };
}

// The single module.exports is defined above.
