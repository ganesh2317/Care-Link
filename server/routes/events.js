import { Router } from 'express';
import db from '../db.js';
import { generateId } from '../lib/ids.js';

const router = Router();

/**
 * POST /api/events
 *
 * Fire-and-forget scan tracking — one row per recipient page load.
 * Called once per page view, not per button tap.
 */
router.post('/', (req, res) => {
  try {
    const { card_id, action } = req.body;

    if (!card_id || typeof card_id !== 'string') {
      return res.status(400).json({ ok: false, error: { code: 'VALIDATION', message: 'card_id is required' } });
    }

    // Verify the card exists (don't log events for non-existent cards)
    const card = db.prepare(`SELECT id FROM cards WHERE id = ?`).get(card_id);
    if (!card) {
      // Silently accept — fire-and-forget semantics
      return res.json({ ok: true });
    }

    const id = generateId();
    db.prepare(
      `INSERT INTO scan_events (id, card_id, action) VALUES (?, ?, ?)`
    ).run(id, card_id, action || null);

    res.json({ ok: true });
  } catch (err) {
    console.error('[events] POST error:', err.message);
    // Fire-and-forget: return ok even on failure so the recipient page isn't affected
    res.json({ ok: true });
  }
});

export default router;
