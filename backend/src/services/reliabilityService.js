/**
 * reliabilityService.js
 * ----------------------
 * Tracks buyer no-show behaviour. After every no_show event this service
 * counts the buyer's total no-shows and sets `reliability_flag = 1` once
 * they cross NO_SHOW_THRESHOLD.
 *
 * This is a FLAG ONLY — the buyer is NOT auto-suspended. A human admin
 * reviews flagged users via GET /api/admin/flagged-users.
 *
 * The `reliability_flag` column is added to the users table via the safe
 * migration runner in db/migrations.js (Task 11).
 */
const { db } = require("../db");

const NO_SHOW_THRESHOLD = 3; // flag after this many no-shows

/**
 * Called after a request transitions to 'no_show'.
 * Counts total no-shows for the buyer; flags the user if threshold crossed.
 *
 * @param {string} buyerId
 * @returns {{ noShowCount: number, flagged: boolean }}
 */
async function recordNoShow(buyerId) {
  const row = await db.prepare(
    `SELECT COUNT(*) as c FROM requests WHERE buyer_id = ? AND status = 'no_show'`
  ).get(buyerId);

  const noShowCount = parseInt(row?.c || "0", 10);

  if (noShowCount >= NO_SHOW_THRESHOLD) {
    await db.prepare(
      `UPDATE users SET reliability_flag = 1 WHERE id = ?`
    ).run(buyerId);
    return { noShowCount, flagged: true };
  }

  return { noShowCount, flagged: false };
}

/**
 * Returns all users who have reliability_flag = 1.
 * Used by the admin-only endpoint (GET /api/admin/flagged-users).
 */
async function getFlaggedUsers() {
  return await db.prepare(
    `SELECT id, name, email, department, year, usn, rating_avg, rating_count,
            reliability_flag, created_at,
            (SELECT COUNT(*) FROM requests WHERE buyer_id = users.id AND status = 'no_show') as no_show_count
     FROM users
     WHERE reliability_flag = 1
     ORDER BY no_show_count DESC, created_at ASC`
  ).all();
}

module.exports = { recordNoShow, getFlaggedUsers, NO_SHOW_THRESHOLD };
