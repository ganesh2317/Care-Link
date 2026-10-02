# CareLink — Simple help, one scan away.

> The caregiver does 100% of the setup. The recipient performs exactly ONE action: scan a QR code, then tap ONE large button.

---

## Architecture

```
┌─────────────────┐     HTTP/JSON      ┌─────────────────┐     SQLite      ┌────────────┐
│   React 18 +    │ ◄──────────────►   │   Express.js    │ ◄────────────►  │  SQLite DB │
│   Vite Client   │     /api/*         │   REST API      │  better-sqlite3 │  (WAL)     │
│   + Tailwind    │                    │                 │                 │            │
└─────────────────┘                    └─────────────────┘                 └────────────┘
      │                                        │
      │  QR Code encodes                       │  Serves client/dist
      │  ${BASE_URL}/c/${cardId}               │  in production
      │  (never raw data)                      │
      ▼                                        │
┌─────────────────┐                            │
│  Phone scans QR │ ───────────────────────────┘
│  → loads /c/:id │
│  → ONE button   │
└─────────────────┘
```

## Folder Structure

```
carelink/
├── package.json              Root: concurrently, all scripts
├── .env.example              Environment template
├── .env                      Your local config (git-ignored)
├── server/
│   ├── index.js              Express app entry; auto-migrates + seeds
│   ├── db.js                 better-sqlite3 connection + migrate()
│   ├── schema.sql            DDL — applied idempotently on boot
│   ├── seed.js               Demo data — only seeds if DB is empty
│   ├── lib/ids.js            Crockford Base32 ID generator
│   ├── middleware/rateLimit.js
│   └── routes/
│       ├── cards.js           Caregiver CRUD (dashboard-facing)
│       ├── publicCards.js     GET /c/:id data (recipient-facing)
│       └── events.js          Scan event tracking
├── shared/
│   ├── maps.js               buildMapsUrl() — used by both sides
│   └── validate.js           Input validation schemas
└── client/
    ├── vite.config.js         host: true + /api proxy
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── index.css
        ├── App.jsx            Routes: /dashboard, /c/:cardId
        ├── pages/
        │   ├── Dashboard.jsx
        │   ├── CardWizard.jsx  3-step create/edit flow
        │   └── Recipient.jsx   THE most important screen
        ├── components/
        │   ├── BigButton.jsx
        │   ├── QRPanel.jsx
        │   ├── PrintCard.jsx
        │   ├── LoadingState.jsx
        │   ├── ErrorState.jsx
        │   └── EmptyState.jsx
        └── hooks/
            └── useReadAloud.js
```

## Quick Start

```bash
# 1. Clone / cd into the carelink directory
cd carelink

# 2. Copy environment file
cp .env.example .env

# 3. Install all dependencies
npm install

# 4. Start development (server + client concurrently)
npm run dev
```

The server starts on **http://localhost:3000** (API only in dev).
The client starts on **http://localhost:5173** (Vite dev server).

Open **http://localhost:5173/dashboard** to access the caregiver dashboard.

## Testing on Your Phone (LAN)

This is the **#1 reason** QR prototypes fail — `localhost` on your phone means the phone itself, not your laptop.

### Step 1: Find your LAN IP

| OS      | Command                             |
|---------|-------------------------------------|
| Windows | `ipconfig` → look for **IPv4 Address** under your Wi-Fi adapter |
| macOS   | `ipconfig getifaddr en0`            |
| Linux   | `hostname -I`                       |

### Step 2: Open the dashboard using your LAN IP

Instead of `localhost:5173`, open:
```
http://<YOUR_LAN_IP>:5173/dashboard
```

This ensures QR codes automatically encode the correct LAN URL.

### Step 3: Scan the QR

- Click **View QR** on any card
- Use the **📱 Test on phone (full-screen QR)** button to maximize the QR
- Scan with your phone camera
- Both devices must be on the **same Wi-Fi network**

### Alternative: Cloudflare Tunnel

For testing when off the home network:
```bash
npx -y cloudflared tunnel --url http://localhost:5173
```

## API Endpoints

All responses use the envelope: `{ ok: true, data }` or `{ ok: false, error: { code, message } }`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/cards` | Create card + type-specific detail (transaction) |
| `GET` | `/api/cards` | List all cards for cg_demo with scan stats |
| `GET` | `/api/cards/:id` | Full card detail (dashboard/edit) |
| `PUT` | `/api/cards/:id` | Update card + details (transaction) |
| `PATCH` | `/api/cards/:id/toggle` | Flip active ↔ inactive |
| `GET` | `/api/public/cards/:id` | **Recipient-facing** — stripped fields, 200 for inactive/not-found |
| `POST` | `/api/events` | Fire-and-forget scan tracking |

## What's Fully Working (V1)

- ✅ QR code generation (client-side, never encodes raw data)
- ✅ Dynamic editable cards — edit destination after printing, same QR
- ✅ Navigate → Google Maps / Apple Maps deep links
- ✅ Call → native `tel:` dialer link
- ✅ Info → large readable message with optional help contact
- ✅ Read Aloud (browser SpeechSynthesis, 0.85× rate)
- ✅ Print Card (styled print window)
- ✅ Download PNG / Copy Link
- ✅ Inactive/expired card handling (friendly message)
- ✅ Scan event tracking (count + last scanned)
- ✅ WCAG AAA target (36-40px titles, 72px buttons, 7:1 contrast)
- ✅ Reduced motion support
- ✅ LAN phone testing (host: true)
- ✅ Rate limiting on public endpoint
- ✅ Parameterized SQL queries (no injection)
- ✅ Shared validation between client and server

## Explicitly Stubbed for V2

- ❌ **Authentication** — hardcoded `cg_demo` caregiver. Every write route has a greppable `// AUTH NOTE:` comment.
- ❌ **Places Autocomplete** — no Google Places API; enter coordinates manually or use "Use my location".
- ❌ **Push Notifications** — no real-time scan alerts to the caregiver.
- ❌ **Multilingual UI** — English only; V2 would add i18n.
- ❌ **Cloud Deployment** — runs locally only; add Dockerfile + managed DB for production.
- ❌ **Card Expiry UI** — `expires_at` column exists but no UI to set it yet.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start server + client concurrently |
| `npm run seed` | Manually re-seed demo data |
| `npm run build` | Production build of the client |
| `npm run start` | Production server (serves built client) |

## License

MIT
