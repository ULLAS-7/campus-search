/**
 * migrations.js
 * --------------
 * Safe schema migration runner.
 *
 * schema.sql uses CREATE TABLE IF NOT EXISTS, which does nothing for columns
 * added after a table already exists on someone's real database. This runner
 * uses PRAGMA table_info() to check whether each new column is present and
 * issues ALTER TABLE ... ADD COLUMN only when it is missing.
 *
 * Add new columns here instead of modifying schema.sql.
 * Run order is deterministic — add new entries at the end.
 *
 * Called from db/index.js immediately after initSchema() runs schema.sql.
 */
const { db } = require("./index");

// ---------------------------------------------------------------------------
// Column definitions: { table, column, definition }
// definition is the SQL fragment after the column name in ALTER TABLE.
// ---------------------------------------------------------------------------
const MIGRATIONS = [
  // Task 7: buyer reliability tracking flag
  {
    table:      "users",
    column:     "reliability_flag",
    definition: "INTEGER NOT NULL DEFAULT 0",
  },

  // Task 12: condition enum on listings (separate from free-text condition_notes)
  {
    table:      "listings",
    column:     "condition",
    definition: "TEXT",   // one of: new | like_new | used_working | heavily_used
  },

  // Task 12: suggested price stored on listing at creation time
  {
    table:      "listings",
    column:     "suggested_price",
    definition: "INTEGER",
  },

  // Task 13: updated_at on price_reference (the table itself is created in schema.sql
  // via migrations; the column is here for existing installs that have the table
  // without this column)
  {
    table:      "price_reference",
    column:     "updated_at",
    definition: "TEXT NOT NULL DEFAULT (datetime('now'))",
  },
];

/**
 * Get the list of column names that currently exist in a table.
 * Uses PRAGMA table_info which is safe and cheap (no full table scan).
 */
async function getExistingColumns(tableName) {
  try {
    const rows = await db.prepare(`PRAGMA table_info(${tableName})`).all();
    return new Set(rows.map((r) => r.name));
  } catch (_) {
    // Table doesn't exist yet — return empty set; CREATE TABLE will handle it
    return new Set();
  }
}

/**
 * Run all pending column migrations.
 * Safe to call on every boot — skips columns that already exist.
 */
async function runMigrations() {
  for (const m of MIGRATIONS) {
    const existing = await getExistingColumns(m.table);
    if (existing.size === 0) continue; // table doesn't exist yet; schema.sql will create it
    if (existing.has(m.column)) continue; // already present

    try {
      await db.query(
        `ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.definition}`
      );
      console.log(`[migrations] Added column ${m.table}.${m.column}`);
    } catch (err) {
      // SQLite: "duplicate column name" means another process already added it — safe to ignore
      if (!err.message?.includes("duplicate column")) {
        console.error(`[migrations] Failed to add ${m.table}.${m.column}:`, err.message);
      }
    }
  }
}

module.exports = { runMigrations };
