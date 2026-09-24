// On Vercel (read-only filesystem) skip the file-writing setup script.
// JWT_SECRET is set as an environment variable in the Vercel project settings.
// Locally, setup-env.js creates .env automatically.
if (process.env.VERCEL) {
  require("dotenv").config();
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = "vercel-fallback-secret-change-in-env-settings-64chars";
  }
} else {
  require("../scripts/setup-env");
}
const { startApp } = require("./app");
const matchingService = require("./services/matchingService");
const { sweepExpiredListings } = require("./routes/listings");
const { runDailyPricingSweep } = require("./services/pricingService");

const PORT = process.env.PORT || 4000;

(async () => {
  await startApp();

  const app = require("./app");
  app.listen(PORT, () => {
    console.log(`CampusSearch API v1.1 running on http://localhost:${PORT}`);
  });

  // Scheduled sweeps — handle the "no response" and "no-show" timeout edge cases
  const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes
  const sweepInterval = setInterval(() => {
    try {
      matchingService.sweepExpiredRequests();
      sweepExpiredListings();
    } catch (e) {
      console.error("Sweep job failed:", e);
    }
  }, SWEEP_INTERVAL_MS);
  sweepInterval.unref();

  // Daily pricing sweep — run once at boot then every 24 hours (Task 13)
  const DAILY_MS = 24 * 60 * 60 * 1000;
  const runPricingSweep = async () => {
    try {
      const summary = await runDailyPricingSweep();
      console.log("[pricing sweep]", JSON.stringify(summary));
    } catch (e) {
      console.error("[pricing sweep] failed:", e.message);
    }
  };
  // Boot run (fire-and-forget, don't block server startup)
  runPricingSweep();
  const pricingInterval = setInterval(runPricingSweep, DAILY_MS);
  pricingInterval.unref();
})();
