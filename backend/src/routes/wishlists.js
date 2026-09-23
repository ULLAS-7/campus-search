/**
 * Wishlist routes — "I'm looking for…" board
 * ---------------------------------------------
 * Buyers post what they need. When a seller lists a matching item,
 * matching buyers get notified automatically (handled in listings route).
 */
const express = require("express");
const { v4: uuid } = require("uuid");
const { db } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { validate, schemas } = require("../middleware/validate");

const router = express.Router();

// GET /api/wishlists — browse all open wants
router.get("/", async (req, res) => {
  const { category = "All" } = req.query;
  let q = `SELECT w.*, u.name as user_name, u.department as user_department
            FROM wishlists w JOIN users u ON u.id = w.user_id
            WHERE w.status = 'open'`;
  const params = [];

  if (category !== "All") {
    q += ` AND w.category = ?`;
    params.push(category);
  }
  q += ` ORDER BY w.created_at DESC`;

  res.json(await db.prepare(q).all(...params));
});

// POST /api/wishlists — post a want
router.post("/", requireAuth, validate(schemas.createWishlist), async (req, res) => {
  const { item_name, category, max_budget, notes } = req.body;

  const id = uuid();
  await db.prepare(
    `INSERT INTO wishlists (id, user_id, item_name, category, max_budget, notes)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, req.user.id, item_name, category || "Any", max_budget || 0, notes || "");

  const wish = await db.prepare("SELECT * FROM wishlists WHERE id = ?").get(id);
  res.status(201).json(wish);
});

// DELETE /api/wishlists/:id — remove your own want or admin delete
router.delete("/:id", requireAuth, async (req, res) => {
  const wish = await db.prepare("SELECT * FROM wishlists WHERE id = ?").get(req.params.id);
  if (!wish) return res.status(404).json({ error: "Not found." });
  if (wish.user_id !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "Not your wishlist item." });
  }

  await db.prepare("DELETE FROM wishlists WHERE id = ?").run(req.params.id);
  res.json({ ok: true, deletedId: req.params.id, message: "Wishlist item removed." });
});

// Helper for CSV parsing
function parseWishlistCsv(csvText) {
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

// POST /api/wishlists/upload — batch ingest wanted component requisitions
router.post("/upload", requireAuth, async (req, res) => {
  try {
    let items = [];
    if (Array.isArray(req.body)) {
      items = req.body;
    } else if (typeof req.body === "string") {
      items = parseWishlistCsv(req.body);
    } else if (req.body && req.body.csv) {
      items = parseWishlistCsv(req.body.csv);
    } else if (req.body && Array.isArray(req.body.data)) {
      items = req.body.data;
    } else if (req.body && typeof req.body.data === "string") {
      items = parseWishlistCsv(req.body.data);
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "No records found in upload payload." });
    }

    const inserted = [];
    for (const item of items) {
      const id = item.id || uuid();
      const name = item.item_name || item.name || item.title;
      if (!name) continue;

      const category = item.category || "Any";
      const max_budget = parseInt(item.max_budget || item.budget || "0", 10) || 0;
      const notes = item.notes || item.description || "";

      await db.prepare(
        `INSERT INTO wishlists (id, user_id, item_name, category, max_budget, notes)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           item_name = EXCLUDED.item_name,
           category = EXCLUDED.category,
           max_budget = EXCLUDED.max_budget,
           notes = EXCLUDED.notes`
      ).run(id, req.user.id, name, category, max_budget, notes);

      inserted.push({ id, item_name: name, category, max_budget });
    }

    res.status(201).json({
      ok: true,
      count: inserted.length,
      message: `Successfully ingested ${inserted.length} wishlist requisitions.`,
      records: inserted
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/wishlists/mine — my wish items
router.get("/mine", requireAuth, async (req, res) => {
  const items = await db.prepare(
    `SELECT * FROM wishlists WHERE user_id = ? ORDER BY created_at DESC`
  ).all(req.user.id);
  res.json(items);
});

module.exports = router;
