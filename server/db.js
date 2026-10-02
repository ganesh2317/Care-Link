import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbPath = process.env.DATABASE_PATH || './server/carelink.db';
const resolvedPath = path.resolve(dbPath);

// Ensure the directory exists
fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

const db = new Database(resolvedPath);

/**
 * Apply schema.sql on boot — CREATE IF NOT EXISTS makes it idempotent.
 */
export function migrate() {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Check if cards table exists and needs column migration (dropping old type constraint and adding template)
  const cardsTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cards'").get();
  if (cardsTableExists) {
    const tableInfo = db.prepare("PRAGMA table_info(cards)").all();
    const hasTypeCol = tableInfo.some((col) => col.name === 'type');
    const hasTemplateCol = tableInfo.some((col) => col.name === 'template');

    if (hasTypeCol && !hasTemplateCol) {
      console.log('[db] Migrating cards table to new schema...');
      db.pragma('foreign_keys = OFF');
      db.exec(`
        CREATE TABLE IF NOT EXISTS cards_new (
          id TEXT PRIMARY KEY,
          caregiver_id TEXT NOT NULL REFERENCES caregivers(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          icon_emoji TEXT NOT NULL DEFAULT 'ℹ️',
          template TEXT,
          active INTEGER NOT NULL DEFAULT 1,
          expires_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO cards_new (id, caregiver_id, title, icon_emoji, template, active, expires_at, created_at, updated_at)
        SELECT id, caregiver_id, title, icon_emoji, type, active, expires_at, created_at, updated_at FROM cards;
        DROP TABLE cards;
        ALTER TABLE cards_new RENAME TO cards;
      `);
      db.pragma('foreign_keys = ON');
      console.log('[db] Cards table migrated successfully');
    }
  }

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);
  console.log('[db] Schema applied successfully');
}

export default db;
