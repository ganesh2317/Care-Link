import { useEffect, useState, useCallback } from 'react';
import QRCode from 'qrcode';
import PrintCard from './PrintCard.jsx';

/**
 * QR Code modal for the dashboard.
 * Shows QR image ≥300×300, download PNG, copy link, print card,
 * preview as recipient, and full-screen "test on phone" view.
 */
export default function QRPanel({ card, onClose }) {
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [copied, setCopied] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);

  const BASE_URL =
    import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin;
  const cardUrl = `${BASE_URL}/c/${card.id}`;

  useEffect(() => {
    QRCode.toDataURL(cardUrl, {
      width: 400,
      margin: 2,
      color: { dark: '#0F172A', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    }).then(setQrDataUrl);
  }, [cardUrl]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(cardUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select a temporary input
      const input = document.createElement('input');
      input.value = cardUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [cardUrl]);

  const handleDownload = useCallback(() => {
    if (!qrDataUrl) return;
    const sanitized = card.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `carelink-${sanitized}.png`;
    a.click();
  }, [qrDataUrl, card.title]);

  const handlePreview = useCallback(() => {
    window.open(`/c/${card.id}`, '_blank');
  }, [card.id]);

  // ─── Full-screen test mode ─────────────────────────────────
  if (fullScreen) {
    return (
      <div
        className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-8 cursor-pointer"
        onClick={() => setFullScreen(false)}
        role="button"
        tabIndex={0}
        aria-label="Exit full screen"
        onKeyDown={(e) => e.key === 'Escape' && setFullScreen(false)}
      >
        {qrDataUrl && (
          <img
            src={qrDataUrl}
            alt="QR Code"
            className="w-[80vmin] h-[80vmin] max-w-[500px] max-h-[500px]"
          />
        )}
        <p className="mt-6 text-xl text-slate-500 font-medium">
          Scan with your phone · tap anywhere to close
        </p>
      </div>
    );
  }

  // ─── Modal ─────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-slide-up">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200
                     flex items-center justify-center text-slate-500 transition-colors"
          aria-label="Close"
        >
          ✕
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <span className="text-4xl block mb-2">{card.icon_emoji}</span>
          <h2 className="text-xl font-bold text-slate-900">{card.title}</h2>
          <p className="text-sm text-slate-500 mt-1">
            Scan this with the phone camera
          </p>
        </div>

        {/* QR Code */}
        <div className="flex justify-center mb-6">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR code for ${card.title}`}
              className="w-[300px] h-[300px] rounded-xl border border-slate-100"
            />
          ) : (
            <div className="w-[300px] h-[300px] rounded-xl bg-slate-50 flex items-center justify-center">
              <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* URL display */}
        <div className="bg-slate-50 rounded-lg px-3 py-2 mb-6 text-center">
          <code className="text-xs text-slate-500 break-all">{cardUrl}</code>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleDownload}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                       bg-blue-600 text-white font-medium text-sm
                       hover:bg-blue-700 transition-colors"
          >
            ⬇️ Download PNG
          </button>

          <button
            onClick={handleCopyLink}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                       bg-slate-100 text-slate-700 font-medium text-sm
                       hover:bg-slate-200 transition-colors"
          >
            {copied ? '✓ Link copied!' : '🔗 Copy Link'}
          </button>

          <PrintCard card={card} qrDataUrl={qrDataUrl} />

          <button
            onClick={handlePreview}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                       bg-slate-100 text-slate-700 font-medium text-sm
                       hover:bg-slate-200 transition-colors"
          >
            👁️ Preview
          </button>
        </div>

        {/* Test on phone — full-screen QR */}
        <button
          onClick={() => setFullScreen(true)}
          className="w-full mt-4 py-2.5 rounded-xl border-2 border-dashed border-slate-200
                     text-slate-500 font-medium text-sm
                     hover:border-blue-300 hover:text-blue-600 transition-colors"
        >
          📱 Test on phone (full-screen QR)
        </button>
      </div>
    </div>
  );
}
