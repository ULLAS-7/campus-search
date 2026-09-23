/**
 * scripts/setup-env.js
 * ---------------------
 * Runs before anything else on server boot (required at top of server.js).
 * Creates backend/.env from .env.example if .env doesn't exist, generating
 * a real 64-hex-char random JWT_SECRET via crypto so `npm run dev` just works
 * with zero manual steps.
 *
 * If JWT_SECRET is still missing after this runs, we throw a hard error
 * instead of silently falling back to a weak default.
 */
const fs     = require("fs");
const path   = require("path");
const crypto = require("crypto");

const ROOT        = path.resolve(__dirname, "..");
const ENV_PATH    = path.join(ROOT, ".env");
const EXAMPLE_PATH = path.join(ROOT, ".env.example");

function generateSecret() {
  return crypto.randomBytes(32).toString("hex"); // 64 hex chars
}

// Only run the file-creation logic once per process (idempotent)
if (!fs.existsSync(ENV_PATH)) {
  let content = "";

  if (fs.existsSync(EXAMPLE_PATH)) {
    content = fs.readFileSync(EXAMPLE_PATH, "utf-8");
  } else {
    // Minimal fallback if .env.example is missing
    content = [
      `PORT=4000`,
      `JWT_SECRET=REPLACE_ME`,
      `CAMPUS_EMAIL_DOMAIN=college.edu`,
      `DB_PATH=./campussearch.db`,
      `NOTIFY_PROVIDER=console`,
    ].join("\n") + "\n";
  }

  // Replace the placeholder JWT_SECRET value with a real generated secret
  const secret = generateSecret();
  if (/^JWT_SECRET=/m.test(content)) {
    content = content.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`);
  } else {
    content += `\nJWT_SECRET=${secret}\n`;
  }

  fs.writeFileSync(ENV_PATH, content, "utf-8");
  console.log("[setup-env] Created .env with a generated JWT_SECRET.");
}

// Load .env into process.env now
require("dotenv").config({ path: ENV_PATH });

// Hard guard: refuse to start if JWT_SECRET is still missing or is the placeholder
const secret = process.env.JWT_SECRET;
if (!secret || secret === "REPLACE_ME" || secret.trim().length < 16) {
  throw new Error(
    "[setup-env] JWT_SECRET is missing or is a placeholder value. " +
    "Delete backend/.env and restart — a real secret will be generated automatically."
  );
}
