import { Router } from 'express';
import db from '../db.js';

const router = Router();

/**
 * GET /api/public/cards/:id
 *
 * Recipient-facing endpoint — returns ONLY the fields needed to render
 * the recipient page. Never exposes caregiver_id or internal metadata.
 *
 * Returns 200 with { inactive: true } for deactivated/expired cards
 * and 200 with { notFound: true } for unknown IDs — so the recipient
 * page always renders a friendly message, never a browser error page.
 */
router.get('/:id', (req, res) => {
  try {
    const card = db.prepare(`SELECT * FROM cards WHERE id = ?`).get(req.params.id);

    // Card ID does not exist at all
    if (!card) {
      return res.json({ ok: true, data: { notFound: true } });
    }

    // Card is inactive or expired
    const now = new Date().toISOString();
    if (!card.active || (card.expires_at && card.expires_at < now)) {
      return res.json({ ok: true, data: { inactive: true } });
    }

    // Fetch blocks sorted by sort_order
    const rawBlocks = db.prepare(`
      SELECT id, block_type, sort_order, is_primary_action, config_json
      FROM card_blocks
      WHERE card_id = ?
      ORDER BY sort_order ASC
    `).all(card.id);

    const blocks = rawBlocks.map((b) => ({
      id: b.id,
      block_type: b.block_type,
      sort_order: b.sort_order,
      is_primary_action: b.is_primary_action,
      config: JSON.parse(b.config_json || '{}'),
    }));

    // Find the designated primary action block (if any)
    const primaryBlock = blocks.find((b) => b.is_primary_action === 1);
    const primaryActionBlockId = primaryBlock ? primaryBlock.id : null;

    // Stripped response — no caregiver_id, no created_at, no internal fields
    res.json({
      ok: true,
      data: {
        id: card.id,
        title: card.title,
        icon_emoji: card.icon_emoji,
        template: card.template,
        blocks,
        primaryActionBlockId,
      },
    });
  } catch (err) {
    console.error('[publicCards] GET error:', err.message);
    res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: 'Something went wrong' } });
  }
});

export default router;
