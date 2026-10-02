import 'dotenv/config';
import db, { migrate } from './db.js';
import { generateId } from './lib/ids.js';

export function migrateToBlocks() {
  console.log('[migrate:blocks] Starting blocks migration...');

  // Ensure DB schema is up to date (cards table updated, card_blocks created)
  migrate();

  const cards = db.prepare('SELECT * FROM cards').all();
  console.log(`[migrate:blocks] Found ${cards.length} cards to inspect.`);

  const migrationTx = db.transaction(() => {
    let migratedCount = 0;
    let skippedCount = 0;

    for (const card of cards) {
      // Check if card already has blocks
      const existingBlocks = db
        .prepare('SELECT COUNT(*) AS cnt FROM card_blocks WHERE card_id = ?')
        .get(card.id);

      if (existingBlocks && existingBlocks.cnt > 0) {
        console.log(`[migrate:blocks] Card ${card.id} ('${card.title}') already has blocks — skipping.`);
        skippedCount++;
        continue;
      }

      // Determine template/type
      const navDetails = db.prepare('SELECT * FROM navigate_details WHERE card_id = ?').get(card.id);
      const callDetails = db.prepare('SELECT * FROM call_details WHERE card_id = ?').get(card.id);
      const infoDetails = db.prepare('SELECT * FROM info_details WHERE card_id = ?').get(card.id);

      let cardType = card.template || card.type;
      if (!cardType) {
        if (navDetails) cardType = 'navigate';
        else if (callDetails) cardType = 'call';
        else if (infoDetails) cardType = 'info';
        else cardType = 'custom';
      }

      // Update template column on card
      db.prepare("UPDATE cards SET template = ?, updated_at = datetime('now') WHERE id = ?").run(cardType, card.id);

      const insertBlock = db.prepare(`
        INSERT INTO card_blocks (id, card_id, block_type, sort_order, is_primary_action, config_json)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      if (cardType === 'navigate' || navDetails) {
        const dest = navDetails || {};
        // Block 1: map_button (marked primary)
        const mapBlockId = generateId();
        const mapConfig = {
          label: '▶ START NAVIGATION',
          destination_name: dest.destination_name || card.title,
          destination_lat: dest.destination_lat != null ? Number(dest.destination_lat) : null,
          destination_lng: dest.destination_lng != null ? Number(dest.destination_lng) : null,
          address_line: dest.address_line || null,
          map_app: card.map_app || 'google',
        };
        insertBlock.run(mapBlockId, card.id, 'map_button', 0, 1, JSON.stringify(mapConfig));

        // Block 2: text for notes if present
        if (dest.notes && dest.notes.trim()) {
          const notesBlockId = generateId();
          const notesConfig = { content: dest.notes.trim() };
          insertBlock.run(notesBlockId, card.id, 'text', 1, 0, JSON.stringify(notesConfig));
        }

        migratedCount++;
        console.log(`[migrate:blocks] Migrated navigate card ${card.id} ('${card.title}') to blocks.`);
      } else if (cardType === 'call' || callDetails) {
        const call = callDetails || {};
        const callBlockId = generateId();
        const callConfig = {
          label: `📞 CALL ${(call.contact_name || 'CONTACT').toUpperCase()}`,
          contact_name: call.contact_name || '',
          phone_number: call.phone_number || '',
        };
        insertBlock.run(callBlockId, card.id, 'call_button', 0, 1, JSON.stringify(callConfig));

        migratedCount++;
        console.log(`[migrate:blocks] Migrated call card ${card.id} ('${card.title}') to blocks.`);
      } else if (cardType === 'info' || infoDetails) {
        const info = infoDetails || {};
        let order = 0;

        // Block 1: text for message
        if (info.message && info.message.trim()) {
          const textBlockId = generateId();
          const textConfig = { content: info.message.trim() };
          insertBlock.run(textBlockId, card.id, 'text', order++, 0, JSON.stringify(textConfig));
        }

        // Block 2: secondary call_button if contact_phone present
        if (info.contact_phone && info.contact_phone.trim()) {
          const callBlockId = generateId();
          const callConfig = {
            label: '📞 Call for Help',
            contact_name: info.contact_name || 'Help Contact',
            phone_number: info.contact_phone.trim(),
          };
          insertBlock.run(callBlockId, card.id, 'call_button', order++, 0, JSON.stringify(callConfig));
        }

        migratedCount++;
        console.log(`[migrate:blocks] Migrated info card ${card.id} ('${card.title}') to blocks.`);
      } else {
        console.log(`[migrate:blocks] Card ${card.id} had no legacy detail records.`);
      }
    }

    console.log(`[migrate:blocks] Migration finished: ${migratedCount} migrated, ${skippedCount} skipped.`);
  });

  migrationTx();
}

migrateToBlocks();
