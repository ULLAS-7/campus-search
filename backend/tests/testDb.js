/**
 * testDb.js
 * ----------
 * Creates a throwaway SQLite database in a temp file so tests never
 * touch the real campussearch.sqlite. Call setupTestDb() at the top of
 * each test file; call teardownTestDb() in after().
 */
const fs   = require("fs");
const path = require("path");
const os   = require("os");

const tmpFiles = [];

/**
 * Points process.env.DB_PATH at a fresh temp file, clears the module
 * cache, boots the schema, and returns the initialized DatabaseWrapper.
 */
async function setupTestDb() {
  const tmpPath = path.join(
    os.tmpdir(),
    `cs_test_${Date.now()}_${Math.random().toString(36).slice(2)}.sqlite`
  );
  tmpFiles.push(tmpPath);

  process.env.DB_PATH     = tmpPath;
  process.env.USE_SQLITE  = "true";   // force SQLite even if DATABASE_URL is set
  process.env.JWT_SECRET  = "test-secret-64-chars-aaaabbbbccccddddeeeeffffgggghhhhiiiijjjjkkkk";
  delete process.env.DATABASE_URL;

  // Clear module cache so each call gets a fresh db + schema instance
  for (const k of Object.keys(require.cache)) {
    if (k.includes(`${path.sep}Campus-Search${path.sep}`) ||
        k.includes(`${path.sep}backend${path.sep}`)) {
      delete require.cache[k];
    }
  }

  const { initSchema } = require("../src/db");
  await initSchema();
  const { db } = require("../src/db");
  return db;
}

/**
 * Remove all temp files created during this test run.
 */
function teardownTestDb() {
  for (const p of tmpFiles) {
    if (fs.existsSync(p)) {
      try { fs.unlinkSync(p); } catch (_) {}
    }
  }
}

module.exports = { setupTestDb, teardownTestDb };
