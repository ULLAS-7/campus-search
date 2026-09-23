-- CampusSearch v2.0 database schema
-- SQLite (swap-compatible with Postgres for production)

-- ============================
-- USERS
-- ============================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  department TEXT,
  year TEXT,
  usn TEXT,                             -- v2.0: University/Roll number for identity
  id_photo_data TEXT,                   -- v2.0: base64 college ID photo for admin verification
  upi_vpa TEXT DEFAULT '',              -- v2.0: custom seller UPI VPA ID (e.g. name@upi)
  qr_image_data TEXT DEFAULT '',        -- v2.0: custom seller UPI QR image upload
  role TEXT NOT NULL DEFAULT 'student', -- student | moderator | admin
  password_hash TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,  -- 1 = admin-approved identity
  admin_verified INTEGER NOT NULL DEFAULT 0, -- explicit admin approval flag
  rating_avg REAL NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  bio TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  suspended INTEGER NOT NULL DEFAULT 0,
  suspension_reason TEXT DEFAULT ''
);

-- ============================
-- LISTINGS
-- ============================
CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES users(id),
  item_name TEXT NOT NULL,
  category TEXT NOT NULL,
  condition_notes TEXT,
  description TEXT,
  price INTEGER NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,  -- v2.0: stock inventory count
  listing_type TEXT NOT NULL DEFAULT 'sale', -- sale | rent
  return_by TEXT,
  parent_kit_id TEXT REFERENCES listings(id),
  status TEXT NOT NULL DEFAULT 'available', -- available | pending | claimed | expired | removed
  moderation_status TEXT NOT NULL DEFAULT 'clear', -- clear | flagged | removed
  image_data TEXT,                      -- base64 image or Unsplash URL
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT
);


-- ============================
-- REQUESTS (direct matching)
-- ============================
CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  buyer_id TEXT NOT NULL REFERENCES users(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'notified', -- notified | accepted | declined | expired | delivered | cancelled | no_show
  delivery_day TEXT,
  accepted_at TEXT,
  delivered_confirmed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  responded_at TEXT
);

-- ============================
-- INQUIRIES (v2.0: broadcast availability flow)
-- Buyer asks "who has X available by Y date?" 
-- ALL matching sellers get notified simultaneously
-- ============================
CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY,
  buyer_id TEXT NOT NULL REFERENCES users(id),
  item_query TEXT NOT NULL,             -- what the buyer is looking for
  category TEXT NOT NULL DEFAULT 'Any',
  needed_by_date TEXT,                  -- desired availability date
  max_budget INTEGER DEFAULT 0,         -- 0 = any price
  notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',  -- open | matched | expired | cancelled
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL DEFAULT (datetime('now', '+2 hours')),
  matched_response_id TEXT             -- the winning response (REFERENCES inquiry_responses.id)
);

-- ============================
-- INQUIRY RESPONSES (sellers respond to broadcast inquiries)
-- ============================
CREATE TABLE IF NOT EXISTS inquiry_responses (
  id TEXT PRIMARY KEY,
  inquiry_id TEXT NOT NULL REFERENCES inquiries(id),
  seller_id TEXT NOT NULL REFERENCES users(id),
  listing_id TEXT REFERENCES listings(id), -- optional: link to existing listing
  available_from TEXT,                  -- when seller can make it available
  price_offer INTEGER DEFAULT 0,
  message TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | declined
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================
-- PAYMENT INTENTS (v2.0: UPI QR per transaction)
-- ============================
CREATE TABLE IF NOT EXISTS payment_intents (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES requests(id),
  seller_id TEXT NOT NULL REFERENCES users(id),
  buyer_id TEXT NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  upi_vpa TEXT,                         -- seller's UPI VPA (e.g., name@upi)
  qr_data TEXT,                         -- UPI deep link string for QR
  status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | disputed
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================
-- RATINGS
-- ============================
CREATE TABLE IF NOT EXISTS ratings (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES requests(id),
  rater_id TEXT NOT NULL REFERENCES users(id),
  ratee_id TEXT NOT NULL REFERENCES users(id),
  score INTEGER NOT NULL,               -- 1 (thumbs down) or 5 (thumbs up)
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================
-- FLAGS / MODERATION
-- ============================
CREATE TABLE IF NOT EXISTS flags (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  reason TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium', -- low | medium | high
  reported_by TEXT,
  status TEXT NOT NULL DEFAULT 'open',  -- open | cleared | removed
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  resolved_by TEXT REFERENCES users(id)
);

-- ============================
-- FEE LEDGER
-- ============================
CREATE TABLE IF NOT EXISTS fee_ledger (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES requests(id),
  seller_id TEXT NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  settled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  settled_at TEXT
);

-- ============================
-- NOTIFICATIONS (in-app, persisted)
-- ============================
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL, -- new_request | request_accepted | request_declined | wishlist_match | inquiry_broadcast | inquiry_matched | payment_due | delivery_confirmed | account_verified | system
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data_json TEXT,                       -- JSON payload for frontend action routing
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================
-- MESSAGES (in-app buyer-seller chat)
-- ============================
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES requests(id),
  sender_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================
-- WISHLISTS (wanted board)
-- ============================
CREATE TABLE IF NOT EXISTS wishlists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  item_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Any',
  max_budget INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',  -- open | matched | closed
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================
-- COMPONENT RELATIONS (Hardware Topology Mesh)
-- ============================
CREATE TABLE IF NOT EXISTS component_relations (
  id TEXT PRIMARY KEY,
  source_component TEXT NOT NULL,
  target_device TEXT NOT NULL,
  interface_bus TEXT NOT NULL,
  voltage_domain TEXT NOT NULL,
  lab_station TEXT NOT NULL,
  current_draw_ma INTEGER NOT NULL DEFAULT 150,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================
-- INDEXES
-- ============================
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category);
CREATE INDEX IF NOT EXISTS idx_requests_listing ON requests(listing_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_messages_request ON messages(request_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_status ON wishlists(status);
CREATE INDEX IF NOT EXISTS idx_wishlists_category ON wishlists(category);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_buyer ON inquiries(buyer_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_responses_inquiry ON inquiry_responses(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_users_usn ON users(usn);
CREATE INDEX IF NOT EXISTS idx_users_verified ON users(admin_verified);
CREATE INDEX IF NOT EXISTS idx_component_relations_source ON component_relations(source_component);
CREATE INDEX IF NOT EXISTS idx_component_relations_bus ON component_relations(interface_bus);
CREATE INDEX IF NOT EXISTS idx_component_relations_status ON component_relations(status);

-- ============================
-- PRICE REFERENCE (Task 12)
-- Seed table of base prices for common items, used when there is no
-- recent sale history to derive a median from.
-- ============================
CREATE TABLE IF NOT EXISTS price_reference (
  id         TEXT PRIMARY KEY,
  category   TEXT NOT NULL,
  item_key   TEXT NOT NULL,            -- normalised keyword key, e.g. "arduino uno"
  base_price INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(category, item_key)
);

CREATE INDEX IF NOT EXISTS idx_price_reference_category ON price_reference(category);
CREATE INDEX IF NOT EXISTS idx_price_reference_item_key ON price_reference(item_key);
