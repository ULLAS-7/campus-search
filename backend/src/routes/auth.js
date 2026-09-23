/**
 * auth.js (v2.0)
 * --------------
 * Registration with USN + College ID photo, login, password change.
 */
const express = require("express");
const authService = require("../services/authService");
const { requireAuth } = require("../middleware/auth");
const { validate, schemas } = require("../middleware/validate");
const router = express.Router();

router.post("/register", validate(schemas.register), async (req, res) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post("/login", validate(schemas.login), async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post("/change-password", requireAuth, validate(schemas.changePassword), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await authService.changePassword(req.user.id, currentPassword, newPassword);
    res.json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post("/reset-password", validate(schemas.resetPassword), async (req, res) => {
  try {
    const { email, phone, newPassword } = req.body;
    const result = await authService.resetPassword(email, phone, newPassword);
    res.json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

module.exports = router;
