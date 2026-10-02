import 'dotenv/config';
import db, { migrate } from './db.js';
import { generateId } from './lib/ids.js';

const CAREGIVER_ID = process.env.DEFAULT_CAREGIVER_ID || 'cg_demo';

// Consistent IDs for the 3 core demo cards
export const DEMO_CARD_IDS = {
  navigate: '1MBA43J453',
  call: 'YQDSCX5376',
  info: '8XKQHV6QMK',
};

/**
 * Idempotent seed — creates demo data directly in the block format.
 * Skips old detail tables completely.
 */
export function seed() {
  migrate();

  const existing = db.prepare('SELECT COUNT(*) AS cnt FROM caregivers').get();
  if (existing.cnt > 0) {
    console.log('[seed] Database already has data — skipping.');
    return;
  }

  console.log('[seed] Seeding demo data in block format…');

  const seedTransaction = db.transaction(() => {
    // ── Caregiver ─────────────────────────────────────────────
    db.prepare(
      `INSERT INTO caregivers (id, display_name, phone) VALUES (?, ?, ?)`
    ).run(CAREGIVER_ID, 'Demo Caregiver', '+91 98765 43210');

    const insertCard = db.prepare(`
      INSERT INTO cards (id, caregiver_id, title, icon_emoji, template, active)
      VALUES (?, ?, ?, ?, ?, 1)
    `);

    const insertBlock = db.prepare(`
      INSERT INTO card_blocks (id, card_id, block_type, sort_order, is_primary_action, config_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // ── Card 1: Navigate — Railway Station ────────────────────
    const navId = DEMO_CARD_IDS.navigate;
    insertCard.run(navId, CAREGIVER_ID, 'Railway Station', '🚆', 'navigate');

    insertBlock.run(
      generateId(),
      navId,
      'map_button',
      0,
      1,
      JSON.stringify({
        label: '▶ START NAVIGATION',
        destination_name: 'Chikkamagaluru Railway Station',
        destination_lat: 13.3161,
        destination_lng: 75.7720,
        address_line: 'Chikkamagaluru, Karnataka, India',
        map_app: 'google',
      })
    );

    insertBlock.run(
      generateId(),
      navId,
      'text',
      1,
      0,
      JSON.stringify({
        content: 'Platform 4. Ask at the information counter if needed.',
      })
    );

    // ── Card 2: Call — Call Ganesh ─────────────────────────────
    const callId = DEMO_CARD_IDS.call;
    insertCard.run(callId, CAREGIVER_ID, 'Call Ganesh', '📞', 'call');

    insertBlock.run(
      generateId(),
      callId,
      'call_button',
      0,
      1,
      JSON.stringify({
        label: '📞 CALL GANESH',
        contact_name: 'Ganesh',
        phone_number: '+91 98765 43210',
      })
    );

    // ── Card 3: Info — Hospital Appointment ───────────────────
    const infoId = DEMO_CARD_IDS.info;
    insertCard.run(infoId, CAREGIVER_ID, 'Hospital Appointment', '🏥', 'info');

    insertBlock.run(
      generateId(),
      infoId,
      'text',
      0,
      0,
      JSON.stringify({
        content:
          'Your appointment is at 10:30 AM.\nGo to the second floor and ask at reception.\n\nRemember to bring your health card and previous reports.',
      })
    );

    insertBlock.run(
      generateId(),
      infoId,
      'call_button',
      1,
      0,
      JSON.stringify({
        label: '📞 Call for Help',
        contact_name: 'Hospital Reception',
        phone_number: '+91 98765 00000',
      })
    );

    console.log(`[seed] Created 3 demo cards in block format: ${navId}, ${callId}, ${infoId}`);
  });

  seedTransaction();
  console.log('[seed] Done ✓');
}

// Allow running directly: node server/seed.js
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('seed.js') ||
    import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/')));

if (isDirectRun) {
  seed();
}
