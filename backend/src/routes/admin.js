/**
 * admin.js (v2.0)
 * ---------------
 * Admin panel endpoints: stats, moderation flags, user suspension,
 * and USN + College ID photo verification queue.
 */
const express = require("express");
const { db } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const moderationService = require("../services/moderationService");
const notificationService = require("../services/notificationService");
const { getFlaggedUsers } = require("../services/reliabilityService");
const { runDailyPricingSweep } = require("../services/pricingService");

const router = express.Router();
router.use(requireAuth, requireRole("admin", "moderator"));

// GET /api/admin/flags — Open moderation flags
router.get("/flags", async (req, res) => {
  try {
    const flags = await db
      .prepare(
        `SELECT f.*, l.item_name FROM flags f JOIN listings l ON l.id = f.listing_id WHERE f.status = 'open' ORDER BY f.created_at DESC`
      )
      .all();
    res.json(flags || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/flags/:id — Resolve a flag (remove/clear)
router.patch("/flags/:id", async (req, res) => {
  const { action } = req.body; // 'remove' | 'clear'
  const result = moderationService.resolveFlag(req.params.id, req.user.id, action);
  if (!result) return res.status(404).json({ error: "Flag not found." });
  res.json({ ok: true });
});

// GET /api/admin/pending-verifications — Users awaiting USN + ID card verification
router.get("/pending-verifications", async (req, res) => {
  try {
    const pending = await db
      .prepare(
        `SELECT id, name, email, usn, department, year, created_at, id_photo_data
         FROM users 
         WHERE admin_verified = 0 AND suspended = 0
         ORDER BY created_at ASC`
      )
      .all();
    res.json(pending || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/verify-user/:id — Admin approves user's ID
router.post("/verify-user/:id", async (req, res) => {
  const user = await db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found." });

  await db.prepare("UPDATE users SET verified = 1, admin_verified = 1 WHERE id = ?").run(req.params.id);

  // Notify user via in-app notification
  notificationService.notify(user, {
    type: "account_verified",
    title: "🎉 Identity Verified!",
    message: `Your USN (${user.usn}) and College ID have been approved! You now have a Verified Student badge.`,
    data: { action: "go_to_profile" },
  });

  res.json({ ok: true, verified: true });
});

// POST /api/admin/reject-user/:id — Admin rejects verification
router.post("/reject-user/:id", async (req, res) => {
  const { reason } = req.body;
  const user = await db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found." });

  // Reset ID photo data so user can re-upload if desired
  await db.prepare("UPDATE users SET verified = 0, admin_verified = 0, id_photo_data = NULL WHERE id = ?").run(req.params.id);

  notificationService.notify(user, {
    type: "system",
    title: "⚠️ Identity Verification Update",
    message: `Your ID verification could not be approved${reason ? `: ${reason}` : "."} Please update your profile with a clear College ID photo.`,
    data: { action: "go_to_profile" },
  });

  res.json({ ok: true, rejected: true });
});

// GET /api/admin/stats — Dashboard summary statistics
router.get("/stats", async (req, res) => {
  try {
    const activeRow = await db.prepare("SELECT COUNT(*) c FROM listings WHERE status = 'available'").get();
    const pendingRow = await db.prepare("SELECT COUNT(*) c FROM listings WHERE status = 'pending'").get();
    const openFlagsRow = await db.prepare("SELECT COUNT(*) c FROM flags WHERE status = 'open'").get();
    const totalUsersRow = await db.prepare("SELECT COUNT(*) c FROM users").get();
    const verifiedUsersRow = await db.prepare("SELECT COUNT(*) c FROM users WHERE admin_verified = 1").get();
    const pendingVerifRow = await db.prepare("SELECT COUNT(*) c FROM users WHERE admin_verified = 0 AND suspended = 0").get();
    const feesRow = await db.prepare("SELECT COALESCE(SUM(amount),0) s FROM fee_ledger WHERE settled = 0").get();

    const active = parseInt(activeRow?.c || "0", 10);
    const pending = parseInt(pendingRow?.c || "0", 10);
    const openFlags = parseInt(openFlagsRow?.c || "0", 10);
    const totalUsers = parseInt(totalUsersRow?.c || "0", 10);
    const verifiedUsers = parseInt(verifiedUsersRow?.c || "0", 10);
    const pendingVerifications = parseInt(pendingVerifRow?.c || "0", 10);
    const feesPending = parseFloat(feesRow?.s || "0");

    res.json({
      active,
      pending,
      openFlags,
      pendingVerifications,
      verifiedPct: totalUsers ? Math.round((verifiedUsers / totalUsers) * 100) : 0,
      feesPendingSettlement: feesPending,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/users — List all registered users
router.get("/users", async (req, res) => {
  const users = await db.prepare(
    `SELECT id, name, email, phone, department, year, usn, role, verified, admin_verified, rating_avg, suspended, created_at
     FROM users ORDER BY created_at DESC`
  ).all();
  res.json(users);
});

// DELETE /api/admin/users/:id — Universal cascading deletion of user account
router.delete("/users/:id", async (req, res) => {
  try {
    const user = await db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found." });

    const userId = req.params.id;

    // 1. Delete notifications
    await db.prepare("DELETE FROM notifications WHERE user_id = ?").run(userId);

    // 2. Delete messages sent by user
    await db.prepare("DELETE FROM messages WHERE sender_id = ?").run(userId);

    // 3. Delete wishlists
    await db.prepare("DELETE FROM wishlists WHERE user_id = ?").run(userId);

    // 4. Delete inquiry responses by user
    await db.prepare("DELETE FROM inquiry_responses WHERE seller_id = ?").run(userId);

    // 5. Delete inquiries by user (and their responses)
    const inqs = await db.prepare("SELECT id FROM inquiries WHERE buyer_id = ?").all(userId);
    for (const inq of inqs) {
      await db.prepare("DELETE FROM inquiry_responses WHERE inquiry_id = ?").run(inq.id);
    }
    await db.prepare("DELETE FROM inquiries WHERE buyer_id = ?").run(userId);

    // 6. Delete requests where user is buyer
    const buyerReqs = await db.prepare("SELECT id FROM requests WHERE buyer_id = ?").all(userId);
    for (const r of buyerReqs) {
      await db.prepare("DELETE FROM messages WHERE request_id = ?").run(r.id);
      await db.prepare("DELETE FROM payment_intents WHERE request_id = ?").run(r.id);
      await db.prepare("DELETE FROM ratings WHERE request_id = ?").run(r.id);
      await db.prepare("DELETE FROM fee_ledger WHERE request_id = ?").run(r.id);
    }
    await db.prepare("DELETE FROM requests WHERE buyer_id = ?").run(userId);

    // 7. Delete listings by user (and their requests/flags)
    const userListings = await db.prepare("SELECT id FROM listings WHERE seller_id = ?").all(userId);
    for (const l of userListings) {
      const lReqs = await db.prepare("SELECT id FROM requests WHERE listing_id = ?").all(l.id);
      for (const r of lReqs) {
        await db.prepare("DELETE FROM messages WHERE request_id = ?").run(r.id);
        await db.prepare("DELETE FROM payment_intents WHERE request_id = ?").run(r.id);
        await db.prepare("DELETE FROM ratings WHERE request_id = ?").run(r.id);
        await db.prepare("DELETE FROM fee_ledger WHERE request_id = ?").run(r.id);
      }
      await db.prepare("DELETE FROM requests WHERE listing_id = ?").run(l.id);
      await db.prepare("DELETE FROM flags WHERE listing_id = ?").run(l.id);
      await db.prepare("DELETE FROM inquiry_responses WHERE listing_id = ?").run(l.id);
    }
    await db.prepare("DELETE FROM listings WHERE seller_id = ?").run(userId);

    // 8. Delete ratings where user is rater or ratee
    await db.prepare("DELETE FROM ratings WHERE rater_id = ? OR ratee_id = ?").run(userId, userId);

    // 9. Delete fee ledger where user is seller
    await db.prepare("DELETE FROM fee_ledger WHERE seller_id = ?").run(userId);

    // 10. Delete user record
    await db.prepare("DELETE FROM users WHERE id = ?").run(userId);

    res.json({ ok: true, deletedId: userId, message: "User account and all associated relational records permanently deleted." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper for CSV parsing
function parseUsersCsv(csvText) {
  const lines = csvText.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^["']|["']$/g, ""));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    const values = [];
    let current = "";
    let inQuotes = false;
    for (let c = 0; c < rawLine.length; c++) {
      const char = rawLine[c];
      if (char === '"' || char === "'") inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/^["']|["']$/g, ""));
        current = "";
      } else current += char;
    }
    values.push(current.trim().replace(/^["']|["']$/g, ""));
    const rowObj = {};
    headers.forEach((h, idx) => { rowObj[h] = values[idx] !== undefined ? values[idx] : ""; });
    rows.push(rowObj);
  }
  return rows;
}

// POST /api/admin/users/upload — Batch ingest student / faculty roster
router.post("/users/upload", async (req, res) => {
  try {
    const bcrypt = require("bcryptjs");
    const { v4: uuid } = require("uuid");

    let items = [];
    if (Array.isArray(req.body)) items = req.body;
    else if (typeof req.body === "string") items = parseUsersCsv(req.body);
    else if (req.body && req.body.csv) items = parseUsersCsv(req.body.csv);
    else if (req.body && Array.isArray(req.body.data)) items = req.body.data;
    else if (req.body && typeof req.body.data === "string") items = parseUsersCsv(req.body.data);

    if (!items || items.length === 0) return res.status(400).json({ error: "No records found in payload." });

    const defaultPassHash = await bcrypt.hash("campus1234", 10);
    const inserted = [];

    for (const item of items) {
      const name = item.name || item.fullName;
      const email = item.email;
      if (!name || !email) continue;

      const id = item.id || uuid();
      const phone = item.phone || "";
      const department = item.department || "ECE";
      const year = item.year || "1st yr";
      const usn = item.usn || `1SK24${department.substring(0, 2).toUpperCase()}${Math.floor(100 + Math.random() * 899)}`;
      const role = item.role || "student";
      const passHash = item.password ? await bcrypt.hash(item.password, 10) : defaultPassHash;

      await db.prepare(
        `INSERT INTO users (id, name, email, phone, department, year, usn, role, password_hash, verified, admin_verified)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
         ON CONFLICT (email) DO UPDATE SET
           name = EXCLUDED.name,
           department = EXCLUDED.department,
           year = EXCLUDED.year,
           usn = EXCLUDED.usn,
           role = EXCLUDED.role`
      ).run(id, name, email, phone, department, year, usn, role, passHash);

      inserted.push({ id, name, email, usn, department, role });
    }

    res.status(201).json({
      ok: true,
      count: inserted.length,
      message: `Successfully ingested ${inserted.length} users into campus registry.`,
      records: inserted
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/users/:id/suspend — Suspend a user
router.patch("/users/:id/suspend", async (req, res) => {
  const { reason } = req.body;
  await db.prepare("UPDATE users SET suspended = 1, suspension_reason = ? WHERE id = ?").run(reason || "Policy violation", req.params.id);
  res.json({ ok: true });
});

// GET /api/admin/flagged-users — Users with reliability_flag = 1 (repeated no-shows)
// Read-only list for human admin review. Does NOT auto-suspend anyone.
router.get("/flagged-users", async (req, res) => {
  try {
    const users = await getFlaggedUsers();
    res.json(users || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/pricing/run-sweep — Manually trigger the daily pricing sweep.
// Returns a summary JSON for testing and verification.
router.post("/pricing/run-sweep", async (req, res) => {
  try {
    const summary = await runDailyPricingSweep();
    res.json({ ok: true, summary });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
