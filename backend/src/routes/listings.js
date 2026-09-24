const express = require("express");
const { v4: uuid } = require("uuid");
const { db } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { validate, validateQuery, schemas } = require("../middleware/validate");
const moderationService = require("../services/moderationService");
const notificationService = require("../services/notificationService");
const { suggestPrice } = require("../services/pricingService");

const router = express.Router();
const LISTING_LIFETIME_DAYS = 60; // stale-listing sweep, see roadmap "listing decay" edge case

// Max decoded image size: 1.5 MB.  Base64 encodes 3 bytes as 4 chars, so the
// encoded string is ~4/3× the binary size.  We check string length to avoid
// decoding the full buffer just for a size check.
const MAX_IMAGE_BYTES        = 1.5 * 1024 * 1024;          // 1,572,864 bytes
const MAX_IMAGE_B64_LENGTH   = Math.ceil(MAX_IMAGE_BYTES * 4 / 3); // ~2,097,152 chars

// GET /api/listings?search=&category=&status=available&sort=newest&min_price=&max_price=&condition=&limit=&offset=
router.get("/", validateQuery(schemas.browseListings), async (req, res) => {
  const {
    search = "",
    category = "All",
    status = "available",
    sort = "newest",
    min_price,
    max_price,
    condition,
    limit  = 20,
    offset = 0,
  } = req.query;

  let baseQuery = `
    SELECT l.*, u.name as seller_name, u.department as seller_department, u.year as seller_year,
           u.verified as seller_verified, u.rating_avg as seller_rating, u.rating_count as seller_rating_count
    FROM listings l JOIN users u ON u.id = l.seller_id
    WHERE l.moderation_status != 'removed'
  `;
  const params = [];

  if (status !== "all") {
    baseQuery += " AND l.status = ?";
    params.push(status);
  }
  if (category !== "All") {
    baseQuery += " AND l.category = ?";
    params.push(category);
  }
  if (search) {
    baseQuery += " AND (l.item_name LIKE ? OR l.description LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }
  if (min_price !== undefined && min_price !== "") {
    baseQuery += " AND l.price >= ?";
    params.push(Number(min_price));
  }
  if (max_price !== undefined && max_price !== "") {
    baseQuery += " AND l.price <= ?";
    params.push(Number(max_price));
  }
  if (condition) {
    baseQuery += " AND l.condition_notes LIKE ?";
    params.push(`%${condition}%`);
  }

  // Count total matching rows for pagination metadata
  const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as sub`;
  const countRow = await db.prepare(countQuery).get(...params);
  const total = parseInt(countRow?.total || "0", 10);

  // Sorting
  switch (sort) {
    case "price_low":
      baseQuery += " ORDER BY l.price ASC";
      break;
    case "price_high":
      baseQuery += " ORDER BY l.price DESC";
      break;
    case "rating":
      baseQuery += " ORDER BY u.rating_avg DESC, l.created_at DESC";
      break;
    case "popular":
      baseQuery += " ORDER BY l.view_count DESC, l.created_at DESC";
      break;
    default:
      baseQuery += " ORDER BY l.created_at DESC";
  }

  const cap    = Math.min(Number(limit), 60);
  const off    = Math.max(Number(offset), 0);
  const pageQuery = `${baseQuery} LIMIT ? OFFSET ?`;

  const items = await db.prepare(pageQuery).all(...params, cap, off);
  res.json({ items, total, limit: cap, offset: off });
});

// GET /api/listings/suggest-price — fair-price suggestion formula (Task 12)
// Registered BEFORE /:id so it is not shadowed by the wildcard param route.
router.get("/suggest-price", async (req, res) => {
  try {
    const { category, item_name, condition = "used_working", age_months } = req.query;
    if (!category || !item_name) {
      return res.status(400).json({ error: "category and item_name are required." });
    }
    const suggested = await suggestPrice({
      category,
      item_name,
      condition,
      age_months: age_months ? Number(age_months) : 0,
    });
    res.json({ suggested_price: suggested }); // null means no reference data available
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post("/", requireAuth, validate(schemas.createListing), async (req, res) => {
  const { item_name, category, condition_notes, condition, description, price, quantity,
          listing_type, return_by, parent_kit_id, image_data, age_months } = req.body;

  // Task 5: cap image upload size — estimate decoded bytes from base64 string length
  // (avoids decoding the full buffer just to check size)
  if (image_data && image_data.length > MAX_IMAGE_B64_LENGTH) {
    return res.status(413).json({
      error: `Image exceeds the maximum allowed size of 1.5 MB. Please compress or resize the image before uploading.`,
    });
  }

  const id = uuid();
  const expiresAt = new Date(Date.now() + LISTING_LIFETIME_DAYS * 86400000).toISOString();
  const qty = parseInt(quantity, 10) > 0 ? parseInt(quantity, 10) : 1;

  await db.prepare(
    `INSERT INTO listings (id, seller_id, item_name, category, condition_notes, condition, description,
       price, quantity, listing_type, return_by, parent_kit_id, image_data, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, req.user.id, item_name, category,
    condition_notes || "", condition || null, description || "",
    price || 0, qty, listing_type || "sale", return_by || null,
    parent_kit_id || null, image_data || null, expiresAt
  );

  // Compute and persist the suggested price at creation time (Task 12)
  let suggestedPrice = null;
  try {
    suggestedPrice = await suggestPrice({
      category,
      item_name,
      condition: condition || "used_working",
      age_months: age_months || 0,
    });
    if (suggestedPrice !== null) {
      await db.prepare(
        `UPDATE listings SET suggested_price = ? WHERE id = ?`
      ).run(suggestedPrice, id);
    }
  } catch (_) {}

  const listing = await db.prepare("SELECT * FROM listings WHERE id = ?").get(id);
  const flags = await moderationService.screenListing(listing, req.user, suggestedPrice);

  // Auto-match wishlists: notify buyers looking for this type of item
  try {
    const matchingWishes = await db.prepare(
      `SELECT w.*, u.id as wish_user_id, u.name as wish_user_name
       FROM wishlists w JOIN users u ON u.id = w.user_id
       WHERE w.status = 'open'
         AND (w.category = ? OR w.category = 'Any')
         AND (w.max_budget = 0 OR w.max_budget >= ?)
         AND w.user_id != ?`
    ).all(category, price || 0, req.user.id);

    for (const wish of matchingWishes) {
      // Require same category OR a shared word that is at least 4 characters long.
      // This prevents short generic words ("the", "kit", "one") from triggering
      // false-positive wishlist notifications.
      const wishWords    = wish.item_name.toLowerCase().split(/\s+/).filter((w) => w.length >= 4);
      const listingWords = item_name.toLowerCase().split(/\s+/).filter((w) => w.length >= 4);
      const sameCategory = wish.category !== "Any" && wish.category === category;
      const sharedWord   = wishWords.some((w) => listingWords.some((l) => l === w || l.includes(w) || w.includes(l)));

      if (sameCategory || sharedWord) {
        const wisher = await db.prepare("SELECT * FROM users WHERE id = ?").get(wish.user_id);
        notificationService.notify(wisher, {
          type: "wishlist_match",
          title: "Wishlist match!",
          message: `"${item_name}" was just listed — matches your wish for "${wish.item_name}"`,
          data: { listingId: id, wishlistId: wish.id },
        });
      }
    }
  } catch (e) {
    console.error("[listings] wishlist match error:", e.message);
  }

  res.status(201).json({ listing, flagged: flags.length > 0 });
});

router.get("/:id", async (req, res) => {
  const listing = await db
    .prepare(
      `SELECT l.*, u.name as seller_name, u.department as seller_department,
              u.verified as seller_verified, u.rating_avg as seller_rating, u.rating_count as seller_rating_count
       FROM listings l JOIN users u ON u.id = l.seller_id WHERE l.id = ?`
    )
    .get(req.params.id);
  if (!listing) return res.status(404).json({ error: "Listing not found." });

  // Increment view count
  await db.prepare("UPDATE listings SET view_count = view_count + 1 WHERE id = ?").run(req.params.id);

  res.json(listing);
});

// DELETE /api/listings/:id — seller or admin can remove or permanently cascade delete listing
router.delete("/:id", requireAuth, async (req, res) => {
  const listing = await db.prepare("SELECT * FROM listings WHERE id = ?").get(req.params.id);
  if (!listing) return res.status(404).json({ error: "Listing not found." });
  if (listing.seller_id !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "Not your listing." });
  }

  const isPermanent = req.query.permanent === "true" || req.user.role === "admin";
  if (isPermanent) {
    // Cascading deletion
    const reqs = await db.prepare("SELECT id FROM requests WHERE listing_id = ?").all(req.params.id);
    for (const r of reqs) {
      await db.prepare("DELETE FROM messages WHERE request_id = ?").run(r.id);
      await db.prepare("DELETE FROM payment_intents WHERE request_id = ?").run(r.id);
      await db.prepare("DELETE FROM ratings WHERE request_id = ?").run(r.id);
      await db.prepare("DELETE FROM fee_ledger WHERE request_id = ?").run(r.id);
    }
    await db.prepare("DELETE FROM requests WHERE listing_id = ?").run(req.params.id);
    await db.prepare("DELETE FROM flags WHERE listing_id = ?").run(req.params.id);
    await db.prepare("DELETE FROM inquiry_responses WHERE listing_id = ?").run(req.params.id);
    await db.prepare("DELETE FROM listings WHERE id = ?").run(req.params.id);
    return res.json({ ok: true, deletedId: req.params.id, permanent: true, message: "Listing and dependent records permanently deleted." });
  }

  await db.prepare("UPDATE listings SET status = 'removed' WHERE id = ?").run(req.params.id);
  res.json({ ok: true, deletedId: req.params.id, permanent: false, message: "Listing archived to removed status." });
});

// Helper for CSV parsing
function parseListingsCsv(csvText) {
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

// POST /api/listings/upload — Batch ingest component listings (CSV or JSON)
router.post("/upload", requireAuth, async (req, res) => {
  try {
    let items = [];
    if (Array.isArray(req.body)) {
      items = req.body;
    } else if (typeof req.body === "string") {
      items = parseListingsCsv(req.body);
    } else if (req.body && req.body.csv) {
      items = parseListingsCsv(req.body.csv);
    } else if (req.body && Array.isArray(req.body.data)) {
      items = req.body.data;
    } else if (req.body && typeof req.body.data === "string") {
      items = parseListingsCsv(req.body.data);
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "No records found. Provide CSV string or JSON array." });
    }

    const inserted = [];
    const expiresAt = new Date(Date.now() + LISTING_LIFETIME_DAYS * 86400000).toISOString();

    for (const item of items) {
      const id = item.id || uuid();
      const name = item.item_name || item.name || item.title;
      if (!name) continue;

      const category = item.category || "Passive Components";
      const condition = item.condition_notes || item.condition || "Working";
      const description = item.description || "";
      const price = parseInt(item.price || "0", 10) || 0;
      const quantity = parseInt(item.quantity || "1", 10) || 1;
      const listing_type = item.listing_type || item.type || "sale";
      const return_by = item.return_by || null;
      const image_data = item.image_data || item.image || null;

      await db.prepare(
        `INSERT INTO listings (id, seller_id, item_name, category, condition_notes, description, price, quantity, listing_type, return_by, image_data, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           item_name = EXCLUDED.item_name,
           category = EXCLUDED.category,
           condition_notes = EXCLUDED.condition_notes,
           description = EXCLUDED.description,
           price = EXCLUDED.price,
           quantity = EXCLUDED.quantity,
           listing_type = EXCLUDED.listing_type,
           return_by = EXCLUDED.return_by,
           image_data = EXCLUDED.image_data`
      ).run(id, req.user.id, name, category, condition, description, price, quantity, listing_type, return_by, image_data, expiresAt);

      inserted.push({ id, item_name: name, category, price, quantity });
    }

    res.status(201).json({
      ok: true,
      count: inserted.length,
      message: `Successfully ingested ${inserted.length} component listings.`,
      records: inserted
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/listings/:id — edit listing details
router.patch("/:id", requireAuth, async (req, res) => {
  const { item_name, description, price, quantity, condition_notes, listing_type, return_by } = req.body;
  const listing = await db.prepare("SELECT * FROM listings WHERE id = ?").get(req.params.id);
  if (!listing) return res.status(404).json({ error: "Listing not found." });
  if (listing.seller_id !== req.user.id) return res.status(403).json({ error: "Not your listing." });

  await db.prepare(`
    UPDATE listings 
    SET item_name = ?, description = ?, price = ?, quantity = ?, condition_notes = ?, listing_type = ?, return_by = ?
    WHERE id = ?
  `).run(
    item_name || listing.item_name,
    description || listing.description,
    price !== undefined ? price : listing.price,
    quantity !== undefined ? quantity : listing.quantity,
    condition_notes || listing.condition_notes,
    listing_type || listing.listing_type,
    return_by || listing.return_by,
    req.params.id
  );
  res.json({ ok: true });
});

// Sweep stale listings — call from a scheduled job (see server.js)
async function sweepExpiredListings() {
  await db.prepare(`UPDATE listings SET status = 'expired' WHERE status = 'available' AND expires_at < CURRENT_TIMESTAMP`).run();
}

module.exports = router;
module.exports.sweepExpiredListings = sweepExpiredListings;

