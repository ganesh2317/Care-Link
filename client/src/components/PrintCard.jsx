import { useCallback } from 'react';

/**
 * Generates a printable card in a new window:
 * QR code + emoji + title in large bold text + destination/phone as backup text.
 * Uses DOM manipulation (not innerHTML) for safety.
 */

function getDetailText(card) {
  if (card.blocks && Array.isArray(card.blocks) && card.blocks.length > 0) {
    const lines = [];
    for (const b of card.blocks) {
      const cfg = b.config || {};
      if (b.block_type === 'map_button') {
        lines.push(cfg.destination_name || cfg.label || 'Navigation');
      } else if (b.block_type === 'call_button') {
        lines.push(`${cfg.contact_name || 'Contact'} — ${cfg.phone_number || ''}`);
      } else if (b.block_type === 'text') {
        lines.push(cfg.content);
      } else if (b.block_type === 'wifi_button') {
        lines.push(`Wi-Fi: ${cfg.ssid || ''}`);
      } else if (b.block_type === 'checklist' && cfg.title) {
        lines.push(cfg.title);
      }
    }
    return lines.join('\n').slice(0, 160);
  }

  switch (card.type || card.template) {
    case 'navigate':
      return card.destination_name || card.address_line || 'Navigation';
    case 'call':
      return `${card.contact_name || 'Contact'} — ${card.phone_number || ''}`;
    case 'info':
      return card.message ? card.message.slice(0, 120) : 'Information';
    default:
      return '';
  }
}

export default function PrintCard({ card, qrDataUrl }) {
  const handlePrint = useCallback(() => {
    if (!qrDataUrl) return;

    const win = window.open('', '_blank', 'width=500,height=700');
    if (!win) return;

    const doc = win.document;
    doc.open();
    doc.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>CareLink Card</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 32px; background: #fff;
    }
    .card {
      text-align: center; max-width: 380px; width: 100%;
      border: 2px solid #E2E8F0; border-radius: 24px; padding: 40px 32px;
    }
    .emoji { font-size: 56px; margin-bottom: 12px; }
    .title { font-size: 26px; font-weight: 700; color: #0F172A; margin-bottom: 8px; line-height: 1.3; }
    .detail { font-size: 16px; color: #475569; margin-bottom: 28px; line-height: 1.5; white-space: pre-line; }
    .qr { width: 220px; height: 220px; margin: 0 auto 20px; display: block; }
    .tagline { font-size: 12px; color: #94A3B8; margin-top: 16px; }
    .instruction { font-size: 14px; color: #64748B; margin-bottom: 16px; font-weight: 500; }
    @media print {
      body { padding: 0; }
      .card { border: none; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="emoji"></div>
    <div class="title"></div>
    <div class="detail"></div>
    <div class="instruction">Scan with phone camera</div>
    <img class="qr" alt="QR Code">
    <div class="tagline">CareLink — Simple help, one scan away.</div>
  </div>
</body>
</html>`);
    doc.close();

    // Populate using DOM for safety (no XSS from user input)
    const emojiEl = doc.querySelector('.emoji');
    const titleEl = doc.querySelector('.title');
    const detailEl = doc.querySelector('.detail');
    const qrEl = doc.querySelector('.qr');

    emojiEl.textContent = card.icon_emoji || 'ℹ️';
    titleEl.textContent = card.title || '';
    detailEl.textContent = getDetailText(card);
    qrEl.src = qrDataUrl;

    // Wait for image to load, then print
    qrEl.onload = () => {
      win.focus();
      win.print();
    };
  }, [card, qrDataUrl]);

  return (
    <button
      onClick={handlePrint}
      disabled={!qrDataUrl}
      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                 bg-slate-100 text-slate-700 font-medium text-sm
                 hover:bg-slate-200 transition-colors
                 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      🖨️ Print Card
    </button>
  );
}
