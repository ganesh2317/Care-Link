import { Router } from 'express';
import db from '../db.js';
import { generateId } from '../lib/ids.js';
import {
  validateCard,
  validateBlock,
  normalizeBlocks,
} from '../../shared/validate.js';

const router = Router();
const CAREGIVER_ID = process.env.DEFAULT_CAREGIVER_ID || 'cg_demo';

// ─── POST /api/cards ────────────────────────────────────────────
// AUTH NOTE: verify authenticated caregiver + scope query to caregiver_id here before production
router.post('/', (req, res) => {
  try {
    const body = req.body;
    const cardValidation = validateCard(body);
    if (!cardValidation.valid) {
      return res.status(400).json({
        ok: false,
        error: { code: 'VALIDATION', message: 'Invalid card data', details: cardValidation.errors },
      });
    }

    // Normalize blocks to enforce the one-primary-action rule
    const normalizedBlocks = normalizeBlocks(body.blocks || []);
    if (normalizedBlocks.length === 0) {
      return res.status(400).json({
        ok: false,
        error: { code: 'VALIDATION', message: 'Card must have at least one block' },
      });
    }

    // Validate each block
    const allErrors = {};
    normalizedBlocks.forEach((block, idx) => {
      const result = validateBlock(block, idx);
      if (!result.valid) {
        Object.assign(allErrors, result.errors);
      }
    });

    if (Object.keys(allErrors).length > 0) {
      return res.status(400).json({
        ok: false,
        error: { code: 'VALIDATION', message: 'Invalid block data', details: allErrors },
      });
    }

    const cardId = generateId();

    const createTransaction = db.transaction(() => {
      db.prepare(`
        INSERT INTO cards (id, caregiver_id, title, icon_emoji, template, active)
        VALUES (?, ?, ?, ?, ?, 1)
      `).run(
        cardId,
        CAREGIVER_ID,
        body.title.trim(),
        body.icon_emoji || 'ℹ️',
        body.template || 'custom'
      );

      const insertBlock = db.prepare(`
        INSERT INTO card_blocks (id, card_id, block_type, sort_order, is_primary_action, config_json)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const block of normalizedBlocks) {
        const blockId = block.id || generateId();
        const configJson = typeof block.config === 'string' ? block.config : JSON.stringify(block.config || {});
        insertBlock.run(
          blockId,
          cardId,
          block.block_type,
          block.sort_order,
          block.is_primary_action ? 1 : 0,
          configJson
        );
      }
    });

    createTransaction();

    res.status(201).json({ ok: true, data: { id: cardId } });
  } catch (err) {
    console.error('[cards] POST error:', err.message);
    res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: 'Failed to create card' } });
  }
});

// ─── GET /api/cards ─────────────────────────────────────────────
// AUTH NOTE: verify authenticated caregiver + scope query to caregiver_id here before production
router.get('/', (req, res) => {
  try {
    const cards = db.prepare(`
      SELECT
        c.*,
        COALESCE(se.scan_count, 0) AS scan_count,
        se.last_scanned
      FROM cards c
      LEFT JOIN (
        SELECT card_id, COUNT(*) AS scan_count, MAX(scanned_at) AS last_scanned
        FROM scan_events
        GROUP BY card_id
      ) se ON se.card_id = c.id
      WHERE c.caregiver_id = ?
      ORDER BY c.created_at DESC
    `).all(CAREGIVER_ID);

    res.json({ ok: true, data: cards });
  } catch (err) {
    console.error('[cards] GET list error:', err.message);
    res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: 'Failed to list cards' } });
  }
});

// ─── GET /api/cards/:id ─────────────────────────────────────────
// AUTH NOTE: verify authenticated caregiver + scope query to caregiver_id here before production
router.get('/:id', (req, res) => {
  try {
    const card = db.prepare(`SELECT * FROM cards WHERE id = ? AND caregiver_id = ?`).get(req.params.id, CAREGIVER_ID);
    if (!card) {
      return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Card not found' } });
    }

    // Fetch blocks sorted by sort_order
    const rawBlocks = db.prepare(`
      SELECT * FROM card_blocks WHERE card_id = ? ORDER BY sort_order ASC
    `).all(card.id);

    const blocks = rawBlocks.map((b) => ({
      id: b.id,
      card_id: b.card_id,
      block_type: b.block_type,
      sort_order: b.sort_order,
      is_primary_action: b.is_primary_action,
      config: JSON.parse(b.config_json || '{}'),
      created_at: b.created_at,
    }));

    // Scan stats
    const stats = db.prepare(`SELECT COUNT(*) AS scan_count, MAX(scanned_at) AS last_scanned FROM scan_events WHERE card_id = ?`).get(card.id);

    res.json({
      ok: true,
      data: {
        ...card,
        blocks,
        scan_count: stats?.scan_count || 0,
        last_scanned: stats?.last_scanned || null,
      },
    });
  } catch (err) {
    console.error('[cards] GET detail error:', err.message);
    res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch card' } });
  }
});

// ─── PUT /api/cards/:id ─────────────────────────────────────────
// AUTH NOTE: verify authenticated caregiver + scope query to caregiver_id here before production
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const existing = db.prepare(`SELECT * FROM cards WHERE id = ? AND caregiver_id = ?`).get(id, CAREGIVER_ID);
    if (!existing) {
      return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Card not found' } });
    }

    const cardValidation = validateCard(body);
    if (!cardValidation.valid) {
      return res.status(400).json({
        ok: false,
        error: { code: 'VALIDATION', message: 'Invalid card data', details: cardValidation.errors },
      });
    }

    // Normalize blocks to enforce the one-primary-action rule
    const normalizedBlocks = normalizeBlocks(body.blocks || []);
    if (normalizedBlocks.length === 0) {
      return res.status(400).json({
        ok: false,
        error: { code: 'VALIDATION', message: 'Card must have at least one block' },
      });
    }

    // Validate each block
    const allErrors = {};
    normalizedBlocks.forEach((block, idx) => {
      const result = validateBlock(block, idx);
      if (!result.valid) {
        Object.assign(allErrors, result.errors);
      }
    });

    if (Object.keys(allErrors).length > 0) {
      return res.status(400).json({
        ok: false,
        error: { code: 'VALIDATION', message: 'Invalid block data', details: allErrors },
      });
    }

    const updateTransaction = db.transaction(() => {
      db.prepare(`
        UPDATE cards
        SET title = ?, icon_emoji = ?, template = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(
        body.title.trim(),
        body.icon_emoji || existing.icon_emoji,
        body.template || existing.template || 'custom',
        id
      );

      // Replace blocks
      db.prepare(`DELETE FROM card_blocks WHERE card_id = ?`).run(id);

      const insertBlock = db.prepare(`
        INSERT INTO card_blocks (id, card_id, block_type, sort_order, is_primary_action, config_json)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const block of normalizedBlocks) {
        const blockId = block.id || generateId();
        const configJson = typeof block.config === 'string' ? block.config : JSON.stringify(block.config || {});
        insertBlock.run(
          blockId,
          id,
          block.block_type,
          block.sort_order,
          block.is_primary_action ? 1 : 0,
          configJson
        );
      }
    });

    updateTransaction();

    res.json({ ok: true, data: { id } });
  } catch (err) {
    console.error('[cards] PUT error:', err.message);
    res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: 'Failed to update card' } });
  }
});

// ─── PATCH /api/cards/:id/toggle ────────────────────────────────
// AUTH NOTE: verify authenticated caregiver + scope query to caregiver_id here before production
router.patch('/:id/toggle', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare(`SELECT * FROM cards WHERE id = ? AND caregiver_id = ?`).get(id, CAREGIVER_ID);
    if (!existing) {
      return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Card not found' } });
    }

    const newActive = existing.active ? 0 : 1;
    db.prepare(`UPDATE cards SET active = ?, updated_at = datetime('now') WHERE id = ?`).run(newActive, id);

    res.json({ ok: true, data: { id, active: newActive } });
  } catch (err) {
    console.error('[cards] PATCH toggle error:', err.message);
    res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: 'Failed to toggle card' } });
  }
});

export default router;
