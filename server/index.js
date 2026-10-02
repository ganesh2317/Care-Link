import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db, { migrate } from './db.js';
import cardsRouter from './routes/cards.js';
import publicCardsRouter from './routes/publicCards.js';
import eventsRouter from './routes/events.js';
import { publicCardLimiter } from './middleware/rateLimit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// ─── Bootstrap ──────────────────────────────────────────────────
migrate();

// Auto-seed on first boot if the DB is empty
const caregiverCount = db.prepare('SELECT COUNT(*) AS cnt FROM caregivers').get();
if (caregiverCount.cnt === 0) {
  console.log('[server] Empty database detected — running seed…');
  const { seed } = await import('./seed.js');
  seed();
}

// ─── Express App ────────────────────────────────────────────────
const app = express();

app.use(express.json({ limit: '100kb' }));
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || true, // In production, restrict to your domain
  })
);

// ─── API Routes ─────────────────────────────────────────────────
app.use('/api/cards', cardsRouter);
app.use('/api/public/cards', publicCardLimiter, publicCardsRouter);
app.use('/api/events', eventsRouter);

// ─── Production Static Serving ──────────────────────────────────
const distPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(distPath));

// SPA fallback — serve index.html for any non-API route
app.get('*', (req, res, next) => {
  // Don't catch API routes
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      // In dev mode, the client dist doesn't exist — that's fine
      res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Not found' } });
    }
  });
});

// ─── Global Error Handler ───────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[server] Unhandled error:', err.message);
  res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
});

app.listen(PORT, () => {
  console.log(`\n  🔗 CareLink server running on http://localhost:${PORT}`);
  console.log(`     API ready at http://localhost:${PORT}/api\n`);
});
