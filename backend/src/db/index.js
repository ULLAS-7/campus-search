const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
require('dotenv').config();

let sqlite3 = null;
function getSqlite3() {
  if (!sqlite3) {
    try { sqlite3 = require('sqlite3').verbose(); } catch (e) { sqlite3 = null; }
  }
  return sqlite3;
}

let pgPool = null;
let activeEngine = 'sqlite';

// Check if PostgreSQL is explicitly configured and not forced to sqlite
const usePg = process.env.DATABASE_URL && process.env.USE_SQLITE !== 'true';

if (usePg) {
  const { Pool } = require('pg');
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: (
      process.env.DATABASE_URL.includes('neon.tech') ||
      process.env.DATABASE_URL.includes('supabase') ||
      process.env.DATABASE_URL.includes('render') ||
      process.env.DATABASE_URL.includes('sslmode=require')
    ) ? { rejectUnauthorized: false } : false
  });
  activeEngine = 'pg';
}

let sqliteDb = null;
function getSqliteDb() {
  if (!sqliteDb) {
    const s3 = getSqlite3();
    if (!s3) throw new Error("sqlite3 native module not available in this environment. Set DATABASE_URL to use PostgreSQL.");
    const dbPath = process.env.DB_PATH ||
      (process.env.VERCEL ? '/tmp/campussearch.sqlite' : path.join(__dirname, 'campussearch.sqlite'));
    sqliteDb = new s3.Database(dbPath);
    sqliteDb.run("PRAGMA foreign_keys = ON");
  }
  return sqliteDb;
}

function normalizeSqlForSqlite(sql) {
  let s = sql;
  // Strip Postgres typecasts like ::timestamp, ::text, ::int
  s = s.replace(/::[a-zA-Z_]+/g, '');
  // Replace intervals like CURRENT_TIMESTAMP + INTERVAL '60 days' with datetime('now', '+60 days')
  s = s.replace(/CURRENT_TIMESTAMP\s*\+\s*INTERVAL\s*'(\d+)\s*(days?|hours?|minutes?)'/gi, "datetime('now', '+$1 $2')");
  // Replace ILIKE with LIKE (SQLite LIKE is case-insensitive for ASCII)
  s = s.replace(/\bILIKE\b/gi, 'LIKE');
  // Replace $1, $2 with ? if any
  s = s.replace(/\$(\d+)/g, '?');
  return s;
}

class DatabaseWrapper {
  constructor() {
    this.engine = activeEngine;
  }

  async query(sql, params = []) {
    if (this.engine === 'pg') {
      try {
        let i = 1;
        const pgSql = sql.replace(/\?/g, () => `$${i++}`);
        return await pgPool.query(pgSql, params);
      } catch (err) {
        if (err.code === '53000' || err.message?.includes('quota') || err.message?.includes('exceeded')) {
          console.warn('[DB Engine] Neon PostgreSQL quota exceeded (code 53000). Seamlessly falling back to SQLite engine.');
          this.engine = 'sqlite';
          activeEngine = 'sqlite';
          return await this.query(sql, params);
        }
        throw err;
      }
    }

    // SQLite engine
    const sdb = getSqliteDb();
    const normalizedSql = normalizeSqlForSqlite(sql);
    const trimmed = normalizedSql.trim().toUpperCase();

    if (trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA') || trimmed.startsWith('EXPLAIN')) {
      return new Promise((resolve, reject) => {
        sdb.all(normalizedSql, params, (err, rows) => {
          if (err) return reject(err);
          resolve({ rows: rows || [], rowCount: (rows || []).length });
        });
      });
    } else {
      return new Promise((resolve, reject) => {
        sdb.run(normalizedSql, params, function (err) {
          if (err) return reject(err);
          resolve({ rows: [], rowCount: this.changes, lastInsertRowid: this.lastID });
        });
      });
    }
  }

  prepare(sql) {
    const db = this;
    return {
      get: async function (...params) {
        if (params.length === 1 && Array.isArray(params[0])) params = params[0];
        const res = await db.query(sql, params);
        return res.rows[0];
      },
      all: async function (...params) {
        if (params.length === 1 && Array.isArray(params[0])) params = params[0];
        const res = await db.query(sql, params);
        return res.rows;
      },
      run: async function (...params) {
        if (params.length === 1 && Array.isArray(params[0])) params = params[0];
        const res = await db.query(sql, params);
        return { changes: res.rowCount, lastInsertRowid: res.lastInsertRowid || (res.rows[0] ? res.rows[0].id : null) };
      }
    };
  }

  async exec(sql) {
    if (this.engine === 'pg') {
      try {
        await pgPool.query(sql);
        return;
      } catch (err) {
        if (err.code === '53000' || err.message?.includes('quota') || err.message?.includes('exceeded')) {
          console.warn('[DB Engine] Neon PostgreSQL quota exceeded on exec. Falling back to SQLite.');
          this.engine = 'sqlite';
          activeEngine = 'sqlite';
          return await this.exec(sql);
        }
        throw err;
      }
    }

    const sdb = getSqliteDb();
    const normalizedSql = normalizeSqlForSqlite(sql);
    return new Promise((resolve, reject) => {
      sdb.exec(normalizedSql, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }
}

const database = new DatabaseWrapper();

// Mock / delegated pool object for any routes accessing pool directly
const poolProxy = {
  query: async (sql, params) => database.query(sql, params)
};

let initPromise = null;

async function seedDefaultDataIfEmpty() {
  try {
    const usersCount = await database.prepare("SELECT COUNT(*) as count FROM users").get();
    if (parseInt(usersCount?.count || "0", 10) === 0) {
      console.log("[DB] Seeding essential demo users and catalog...");
      const hash = await bcrypt.hash("demo1234", 10);
      const demoUsers = [
        { name: "Aravind K", email: "aravind.k@college.edu", phone: "9876543210", department: "ECE", year: "2nd yr", usn: "1SK22EC014", bio: "ECE student, robotics enthusiast. Built 3 projects with Arduino." },
        { name: "Divya S", email: "divya.s@college.edu", phone: "9876500011", department: "Mechatronics", year: "1st yr", usn: "1SK23MT008", bio: "First-year mechatronics. Looking for affordable sensors for my first project!" },
        { name: "Rohit M", email: "rohit.m@college.edu", phone: "9876500022", department: "Robotics Club", year: "3rd yr", usn: "1SK21EC045", bio: "Robotics Club president. Happy to donate old parts to new members." },
        { name: "Sneha R", email: "sneha.r@college.edu", phone: "9876500033", department: "EEE", year: "2nd yr", usn: "1SK22EE029", bio: "Power electronics nerd. Always has spare capacitors." },
        { name: "Karthik V", email: "karthik.v@college.edu", phone: "9876500044", department: "CSE", year: "3rd yr", usn: "1SK21CS088", bio: "CS + IoT projects. Built smart irrigation and attendance systems." },
        { name: "Priya M", email: "priya.m@college.edu", phone: "9876500055", department: "IT", year: "1st yr", usn: "1SK23IT041", bio: "New to hardware, eager to learn!" },
        { name: "Sanjay D", email: "sanjay.d@college.edu", phone: "9876500066", department: "Mechanical", year: "4th yr", usn: "1SK20ME012", bio: "Final year, clearing out all my project components before graduation." },
        { name: "Pending Student", email: "newstudent@gmail.com", phone: "9998887770", department: "AIML", year: "1st yr", usn: "1SK23AI099", admin_verified: 0, bio: "Pending ID card review demo." },
        { name: "Admin User", email: "admin@college.edu", phone: "9000000000", department: "Admin", year: "4th yr", usn: "1SK00AD001", role: "admin", bio: "Platform administrator." }
      ];

      const userIds = {};
      for (const u of demoUsers) {
        const id = uuid();
        userIds[u.name] = id;
        const isVerified = u.admin_verified !== undefined ? u.admin_verified : 1;
        await database.prepare(
          `INSERT OR IGNORE INTO users (id, name, email, phone, department, year, usn, role, password_hash, verified, admin_verified, bio)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(id, u.name, u.email, u.phone, u.department, u.year, u.usn, u.role || "student", hash, isVerified, isVerified, u.bio || "");
      }

      const listings = [
        { seller: "Aravind K", item_name: "Arduino Uno R3 (original)", category: "Microcontrollers", condition_notes: "Working, minor scratches", description: "Genuine Arduino Uno R3. All pins working, USB cable included.", price: 350 },
        { seller: "Aravind K", item_name: "ESP32 DevKit V1 (WROOM-32)", category: "Microcontrollers", condition_notes: "Like new", description: "ESP32 with WiFi+BT, used for IoT workshop.", price: 280 },
        { seller: "Divya S", item_name: "HC-SR04 Ultrasonic Sensor ×3", category: "Sensors", condition_notes: "New, unused", description: "Pack of 3 ultrasonic distance sensors.", price: 150 },
        { seller: "Divya S", item_name: "DHT11 Temperature & Humidity Sensor", category: "Sensors", condition_notes: "Working", description: "Digital temp/humidity sensor with breakout board.", price: 45 },
        { seller: "Rohit M", item_name: "12V DC Geared Motor (pair)", category: "Motors & Actuators", condition_notes: "Used, works fine", description: "Pair of 12V 100RPM geared motors.", price: 220 },
        { seller: "Rohit M", item_name: "SG90 Micro Servo Motor ×4", category: "Motors & Actuators", condition_notes: "Working, slight cable wear", description: "4 micro servos used in robotic arm project.", price: 180 },
        { seller: "Sneha R", item_name: "Full Robotics Elective Kit (line follower)", category: "Full Kits", condition_notes: "Complete, tested", description: "Complete line-follower kit: Arduino, motor driver, IR sensors, chassis, wheels, batteries.", price: 900 },
        { seller: "Sneha R", item_name: "L298N Motor Driver Module", category: "Power & Wiring", condition_notes: "Working", description: "Dual H-bridge motor driver.", price: 120 },
        { seller: "Karthik V", item_name: "Raspberry Pi 3 Model B+", category: "Microcontrollers", condition_notes: "Working, no case", description: "RPi 3B+ with 32GB SD card, power adapter.", price: 1200 },
        { seller: "Karthik V", item_name: "NodeMCU ESP8266 ×2", category: "Microcontrollers", condition_notes: "Working", description: "Pair of NodeMCU boards for WiFi IoT.", price: 200 },
        { seller: "Sanjay D", item_name: "Complete IoT Starter Kit", category: "Full Kits", condition_notes: "Complete with box", description: "Arduino Mega + breadboard + 200 jumpers + resistor kit + LED kit + 10 sensors.", price: 1500 },
        { seller: "Sanjay D", item_name: "Digital Multimeter (DT-830B)", category: "Tools", condition_notes: "Working, battery included", description: "Basic multimeter, perfect for lab.", price: 0 },
        { seller: "Sanjay D", item_name: "Soldering Station (adjustable temp)", category: "Tools", condition_notes: "Good condition", description: "Adjustable temp soldering station with extra tips.", price: 450 },
        { seller: "Rohit M", item_name: "Breadboard 830-point ×3", category: "Passive Components", condition_notes: "New", description: "Three full-size breadboards, unused.", price: 0 }
      ];

      for (const l of listings) {
        await database.prepare(
          `INSERT INTO listings (id, seller_id, item_name, category, condition_notes, description, price, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '+60 days'))`
        ).run(uuid(), userIds[l.seller] || Object.values(userIds)[0], l.item_name, l.category, l.condition_notes, l.description || "", l.price);
      }

      const wishlists = [
        { user: "Priya M", item_name: "Arduino Uno or Mega", category: "Microcontrollers", max_budget: 500, notes: "Need for embedded systems lab next week!" },
        { user: "Divya S", item_name: "Motor Driver L298N", category: "Power & Wiring", max_budget: 200, notes: "For robot project, urgent" },
        { user: "Karthik V", item_name: "Oscilloscope (any)", category: "Tools", max_budget: 3000, notes: "Would rent too" }
      ];
      for (const w of wishlists) {
        await database.prepare(
          `INSERT INTO wishlists (id, user_id, item_name, category, max_budget, notes)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(uuid(), userIds[w.user] || Object.values(userIds)[0], w.item_name, w.category, w.max_budget, w.notes);
      }

      await database.prepare(
        `INSERT INTO inquiries (id, buyer_id, item_query, category, needed_by_date, max_budget, notes, status, expires_at)
         VALUES (?, ?, 'STM32 Nucleo Board', 'Microcontrollers', 'Tomorrow 2 PM', 600, 'Urgent for Lab Exam', 'open', datetime('now', '+2 days'))`
      ).run(uuid(), userIds["Priya M"] || Object.values(userIds)[0]);

      await database.prepare(
        `INSERT INTO notifications (id, user_id, type, title, message, data_json)
         VALUES (?, ?, 'system', 'Welcome to CampusSearch v2.0!', 'Browse listings, broadcast availability inquiries, and pay via UPI QR.', '{}')`
      ).run(uuid(), userIds["Aravind K"] || Object.values(userIds)[0]);
    }
  } catch (err) {
    console.error("[DB Seeding Error]", err);
  }

  // Pre-seed default component relations if table is empty
  try {
    const existing = await database.prepare("SELECT COUNT(*) as count FROM component_relations").get();
    if (parseInt(existing?.count || "0", 10) === 0) {
      const defaultRelations = [
        ["cr_seed_01", "ESP32 DevKit V1", "MPU-6050 6-DoF IMU", "I2C (0x68)", "3.3V Logic", "IoT & Embedded Bench B3", 80, "active", "Telemetry drone IMU bus corridor"],
        ["cr_seed_02", "Arduino Uno R3", "4-Channel Opto Relay", "GPIO / PWM", "5.0V Logic", "Robotics Lab Locker #14", 240, "active", "Automation bench load control relay corridor"],
        ["cr_seed_03", "Raspberry Pi 4", "OLED SSD1306 128x64", "I2C (0x3C)", "3.3V Logic", "VLSI Research Station #07", 45, "verified", "Station telemetry display bus"],
        ["cr_seed_04", "STM32 Nucleo-F401", "LoRa SX1278 433MHz", "SPI (Bus 1)", "3.3V Logic", "RF Telemetry Station #02", 120, "active", "Campus long-range sensor mesh corridor"],
        ["cr_seed_05", "Arduino Mega 2560", "L298N Dual H-Bridge", "PWM / Direction", "12V Power Rail", "Power Electronics Bay 2", 450, "active", "Heavy robotics rover locomotion rail"]
      ];
      for (const rel of defaultRelations) {
        await database.prepare(
          `INSERT INTO component_relations (id, source_component, target_device, interface_bus, voltage_domain, lab_station, current_draw_ma, status, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO NOTHING`
        ).run(...rel);
      }
    }
  } catch (err) {
    console.error("[DB Relations Seeding Error]", err);
  }
}

async function initSchema() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');

      if (database.engine === 'pg') {
        try {
          let pgSchema = schema
            .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY')
            .replace(/datetime\('now'\)/g, 'CURRENT_TIMESTAMP')
            .replace(/datetime\('now',\s*'\+2 hours'\)/g, "CURRENT_TIMESTAMP + INTERVAL '2 hours'")
            .replace(/REAL/g, 'FLOAT');
          
          await pgPool.query(pgSchema);
        } catch (err) {
          if (err.code === '53000' || err.message?.includes('quota') || err.message?.includes('exceeded')) {
            console.warn('[DB Engine] Neon PostgreSQL quota exceeded during schema init. Falling back to SQLite.');
            database.engine = 'sqlite';
            activeEngine = 'sqlite';
            const sdb = getSqliteDb();
            await new Promise((resolve, reject) => {
              sdb.exec(schema, (e) => (e ? reject(e) : resolve()));
            });
          } else if (err.code !== '23505') {
            throw err;
          }
        }
      } else {
        const sdb = getSqliteDb();
        await new Promise((resolve, reject) => {
          sdb.exec(schema, (e) => (e ? reject(e) : resolve()));
        });
      }

      await seedDefaultDataIfEmpty();

      // Run safe column migrations — adds new columns to existing tables without
      // losing data. Must run after schema.sql so base tables exist first.
      const { runMigrations } = require('./migrations');
      await runMigrations();

      // Seed price_reference table with known campus component prices (idempotent)
      const { seedPriceReferencesIfEmpty } = require('../services/pricingService');
      await seedPriceReferencesIfEmpty();

      return database;
    } catch (e) {
      initPromise = null;
      throw e;
    }
  })();

  return initPromise;
}

module.exports = { db: database, initSchema, pool: poolProxy };
