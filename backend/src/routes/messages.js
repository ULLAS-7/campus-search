/**
 * Message routes — in-app buyer↔seller chat
 * -------------------------------------------
 * Messages are scoped to a request (only the buyer and seller
 * of that request can read/write). Pushed via SSE for instant delivery.
 */
const express = require("express");
const { v4: uuid } = require("uuid");
const { db } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { validate, schemas } = require("../middleware/validate");
const sseService = require("../services/sseService");

const router = express.Router();

// GET /api/messages/:requestId — get conversation
router.get("/:requestId", requireAuth, async (req, res) => {
  const access = await checkAccess(req.params.requestId, req.user.id);
  if (!access.ok) return res.status(access.status).json({ error: access.error });

  const messages = await db.prepare(
    `SELECT m.*, u.name as sender_name
     FROM messages m JOIN users u ON u.id = m.sender_id
     WHERE m.request_id = ? ORDER BY m.created_at ASC`
  ).all(req.params.requestId);

  res.json({ messages, otherUser: access.otherUser });
});

// POST /api/messages/:requestId — send a message
router.post("/:requestId", requireAuth, validate(schemas.sendMessage), async (req, res) => {
  const access = await checkAccess(req.params.requestId, req.user.id);
  if (!access.ok) return res.status(access.status).json({ error: access.error });

  const { body } = req.body;

  const id = uuid();
  await db.prepare(
    `INSERT INTO messages (id, request_id, sender_id, body) VALUES (?, ?, ?, ?)`
  ).run(id, req.params.requestId, req.user.id, body.trim());

  const message = await db.prepare(
    `SELECT m.*, u.name as sender_name FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?`
  ).get(id);

  // Push via SSE to the other party
  sseService.send(access.otherUser.id, {
    type: "message",
    message,
  });

  res.status(201).json(message);
});

async function checkAccess(requestId, userId) {
  const request = await db.prepare("SELECT * FROM requests WHERE id = ?").get(requestId);
  if (!request) return { ok: false, status: 404, error: "Request not found." };

  const listing = await db.prepare("SELECT * FROM listings WHERE id = ?").get(request.listing_id);

  const isBuyer = request.buyer_id === userId;
  const isSeller = listing.seller_id === userId;

  if (!isBuyer && !isSeller) {
    return { ok: false, status: 403, error: "You're not part of this transaction." };
  }

  // Only allow messaging after the request is accepted
  if (request.status !== "accepted" && request.status !== "delivered") {
    return { ok: false, status: 403, error: "Chat is available after the seller accepts the request." };
  }

  const otherUserId = isBuyer ? listing.seller_id : request.buyer_id;
  const otherUser = await db.prepare("SELECT id, name, department FROM users WHERE id = ?").get(otherUserId);

  return { ok: true, otherUser };
}

module.exports = router;
