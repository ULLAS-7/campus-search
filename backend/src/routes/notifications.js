/**
 * Notification routes
 * --------------------
 * Manages in-app notifications and the SSE stream endpoint.
 */
const express = require("express");
const { requireAuth, requireAuthViaQuery } = require("../middleware/auth");
const notificationService = require("../services/notificationService");
const sseService = require("../services/sseService");

const router = express.Router();

// GET /api/notifications — list notifications for current user
router.get("/", requireAuth, async (req, res) => {
  const unreadOnly = req.query.unread === "true";
  const notifications = notificationService.getNotifications(req.user.id, { unreadOnly });
  res.json(notifications);
});

// GET /api/notifications/unread-count
router.get("/unread-count", requireAuth, async (req, res) => {
  const count = notificationService.getUnreadCount(req.user.id);
  const breakdown = notificationService.getUnreadBreakdown(req.user.id);
  res.json({ count, breakdown });
});

// PATCH /api/notifications/:id/read — mark as read (or "all")
router.patch("/:id/read", requireAuth, async (req, res) => {
  notificationService.markRead(req.user.id, req.params.id);
  res.json({ ok: true });
});

// GET /api/notifications/stream — real SSE endpoint.
// Uses ?token= query param because browser EventSource cannot send custom
// Authorization headers. requireAuthViaQuery is used ONLY on this one route.
// Every other route continues to require the Authorization header.
router.get("/stream", requireAuthViaQuery, async (req, res) => {
  sseService.addClient(req.user.id, res);
});

module.exports = router;
