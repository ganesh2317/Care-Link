PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS caregivers (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  phone TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL REFERENCES caregivers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  icon_emoji TEXT NOT NULL DEFAULT 'ℹ️',
  template TEXT,                          -- nullable: 'navigate' | 'call' | 'info' | 'custom'
  active INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS card_blocks (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  block_type TEXT NOT NULL CHECK (block_type IN (
    'text', 'image', 'map_button', 'call_button', 'link_button',
    'audio_note', 'wifi_button', 'checklist'
  )),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary_action INTEGER NOT NULL DEFAULT 0,
  config_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scan_events (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  scanned_at TEXT NOT NULL DEFAULT (datetime('now')),
  action TEXT
);

-- Old detail tables kept as a backup / rollback reference
CREATE TABLE IF NOT EXISTS navigate_details (
  card_id TEXT PRIMARY KEY REFERENCES cards(id) ON DELETE CASCADE,
  destination_name TEXT NOT NULL,
  destination_lat REAL,
  destination_lng REAL,
  address_line TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS call_details (
  card_id TEXT PRIMARY KEY REFERENCES cards(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  phone_number TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS info_details (
  card_id TEXT PRIMARY KEY REFERENCES cards(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  contact_name TEXT,
  contact_phone TEXT
);
