/**
 * authService v2.0
 * -----------------
 * Identity model: any email allowed, verified via USN + College ID photo.
 * Admin reviews pending accounts in the Admin Panel and approves/rejects.
 * On approval, user gets an in-app notification → verified badge appears.
 */
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuid } = require("uuid");
const { db } = require("../db");

// JWT_SECRET is loaded by scripts/setup-env.js before the server starts.
// We resolve it lazily inside issueToken/verifyToken so tests that set
// process.env.JWT_SECRET after require() still work correctly.
function getJwtSecret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.trim().length < 16) {
    throw new Error(
      "JWT_SECRET is not set. Run the server via `npm run dev` so setup-env.js initialises it."
    );
  }
  return s;
}

async function register({ name, email, phone, department, year, usn, id_photo_data, password }) {
  if (!email || !email.includes("@")) {
    throw httpError(400, "A valid email address is required.");
  }
  if (!usn || usn.trim().length < 3) {
    throw httpError(400, "USN / Roll number is required for identity verification.");
  }
  if (!password || password.length < 8) {
    throw httpError(400, "Password must be at least 8 characters.");
  }


  const existing = await db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase());
  if (existing) throw httpError(409, "An account with this email already exists.");

  const existingUsn = await db.prepare("SELECT id FROM users WHERE usn = ?").get(usn.trim().toUpperCase());
  if (existingUsn) throw httpError(409, "This USN/Roll number is already registered.");

  const password_hash = await bcrypt.hash(password, 10);
  const id = uuid();

  await db.prepare(
    `INSERT INTO users (id, name, email, phone, department, year, usn, id_photo_data, password_hash, verified, admin_verified)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`
  ).run(
    id,
    name.trim(),
    email.toLowerCase().trim(),
    phone || "",
    department || "",
    year || "",
    usn.trim().toUpperCase(),
    id_photo_data,
    password_hash
  );

  // Notify admins about new pending verification
  const admins = await db.prepare("SELECT * FROM users WHERE role = 'admin'").all();
  const notificationService = require("./notificationService");
  for (const admin of admins) {
    notificationService.notify(admin, {
      type: "system",
      title: "New ID Verification Pending",
      message: `${name} (${usn.trim().toUpperCase()}) has registered and is awaiting identity verification.`,
      data: { userId: id, action: "verify_user" },
    });
  }

  // Return token immediately — user can browse but limited until verified
  return { token: issueToken(id), requiresVerification: true };
}

async function login(email, password) {
  const user = await db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase().trim());
  if (!user) throw httpError(401, "Invalid email or password.");
  if (user.suspended) throw httpError(403, "This account has been suspended. Contact admin.");

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw httpError(401, "Invalid email or password.");

  return { token: issueToken(user.id), requiresVerification: !user.admin_verified };
}

async function changePassword(userId, currentPassword, newPassword) {
  const user = await db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!user) throw httpError(404, "User not found.");

  const ok = await bcrypt.compare(currentPassword, user.password_hash);
  if (!ok) throw httpError(401, "Current password is incorrect.");
  if (newPassword.length < 8) throw httpError(400, "New password must be at least 8 characters.");

  const password_hash = await bcrypt.hash(newPassword, 10);
  await db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(password_hash, userId);
  return { ok: true };
}

async function resetPassword(email, phone, newPassword) {
  if (!email || !phone) throw httpError(400, "Email and registered phone number are required.");
  const user = await db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase().trim());
  if (!user) throw httpError(404, "Account not found with this email.");
  
  if (user.phone !== phone.trim()) {
    throw httpError(401, "The phone number does not match our records for this account.");
  }
  
  if (!newPassword || newPassword.length < 8) {
    throw httpError(400, "New password must be at least 8 characters.");
  }

  const password_hash = await bcrypt.hash(newPassword, 10);
  await db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(password_hash, user.id);
  
  // Return a new token so they are logged in immediately after resetting
  return { token: issueToken(user.id), requiresVerification: !user.admin_verified };
}

function issueToken(userId) {
  return jwt.sign({ sub: userId }, getJwtSecret(), { expiresIn: "30d" });
}

function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

module.exports = { register, login, changePassword, resetPassword, verifyToken, getJwtSecret };
