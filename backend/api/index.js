/**
 * Vercel serverless entry point.
 * Exports the Express app as a handler — Vercel calls this directly,
 * no app.listen() needed in serverless mode.
 */
// Bootstrap env before anything else
if (process.env.VERCEL) {
  // On Vercel, env vars are injected — just ensure JWT_SECRET exists
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = "vercel-fallback-needs-real-secret-in-env-settings";
  }
} else {
  require("../scripts/setup-env");
}

const { startApp } = require("../src/app");

let appPromise = null;

module.exports = async (req, res) => {
  if (!appPromise) {
    appPromise = startApp();
  }
  const app = await appPromise;
  app(req, res);
};
