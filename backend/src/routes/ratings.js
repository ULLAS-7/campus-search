const express = require("express");
const { v4: uuid } = require("uuid");
const { db } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { validate, schemas } = require("../middleware/validate");

const router = express.Router();

router.post("/", requireAuth, validate(schemas.createRating), async (req, res) => {
  const { request_id, ratee_id, score, comment } = req.body;

  const request = await db.prepare("SELECT * FROM requests WHERE id = ?").get(request_id);
  if (!request || request.status !== "delivered") {
    return res.status(400).json({ error: "Ratings can only be left after a delivery is confirmed." });
  }

  await db.prepare(`INSERT INTO ratings (id, request_id, rater_id, ratee_id, score, comment) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuid(),
    request_id,
    req.user.id,
    ratee_id,
    score,
    comment || ""
  );

  const agg = await db.prepare("SELECT AVG(score) as avg, COUNT(*) as count FROM ratings WHERE ratee_id = ?").get(ratee_id);
  await db.prepare("UPDATE users SET rating_avg = ?, rating_count = ? WHERE id = ?").run(agg.avg, agg.count, ratee_id);

  res.status(201).json({ ok: true });
});

module.exports = router;
