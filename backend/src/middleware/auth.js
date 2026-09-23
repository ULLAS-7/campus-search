const { verifyToken } = require("../services/authService");
const { db } = require("../db");

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing auth token." });

  try {
    const payload = verifyToken(token);
    const user = await db.prepare("SELECT * FROM users WHERE id = ?").get(payload.sub);
    if (!user) return res.status(401).json({ error: "User no longer exists." });
    if (user.suspended) return res.status(403).json({ error: "Account suspended." });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

/**
 * requireAuthViaQuery
 * --------------------
 * Variant of requireAuth that reads the JWT from ?token= query param.
 * Used ONLY on the SSE stream endpoint because browser EventSource cannot
 * send custom Authorization headers. Every other route keeps using the
 * header-based requireAuth above — this does NOT weaken auth elsewhere.
 */
async function requireAuthViaQuery(req, res, next) {
  const token = req.query.token || null;
  if (!token) return res.status(401).json({ error: "Missing auth token." });

  try {
    const payload = verifyToken(token);
    const user = await db.prepare("SELECT * FROM users WHERE id = ?").get(payload.sub);
    if (!user) return res.status(401).json({ error: "User no longer exists." });
    if (user.suspended) return res.status(403).json({ error: "Account suspended." });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You don't have permission to do this." });
    }
    next();
  };
}

module.exports = { requireAuth, requireAuthViaQuery, requireRole };
