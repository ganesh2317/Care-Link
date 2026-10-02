import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { buildMapsUrl } from '@shared/maps.js';
import BigButton from '../components/BigButton.jsx';
import LoadingState from '../components/LoadingState.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { useReadAloud } from '../hooks/useReadAloud.js';

// ─── Phone number normalizer ─────────────────────────────────

function normalizeTel(phone) {
  return (phone || '').replace(/[\s\-\(\)\.]/g, '');
}

// ─── Read-aloud text builder ─────────────────────────────────

function getReadText(card) {
  const parts = [card.title];

  if (card.blocks && Array.isArray(card.blocks)) {
    for (const b of card.blocks) {
      const cfg = b.config || {};
      if (b.block_type === 'text' && cfg.content) {
        parts.push(cfg.content);
      } else if (b.block_type === 'checklist') {
        if (cfg.title) parts.push(cfg.title);
        if (Array.isArray(cfg.items)) {
          cfg.items.forEach((item, idx) => {
            if (item && item.trim()) {
              parts.push(`${idx + 1}. ${item.trim()}`);
            }
          });
        }
      } else if (b.block_type === 'audio_note') {
        if (cfg.caption) parts.push(cfg.caption);
      } else if (b.block_type === 'image') {
        if (cfg.alt) parts.push(cfg.alt);
      } else if (cfg.label) {
        parts.push(cfg.label);
      }
    }
  }

  return parts.join('. ');
}

// ─── Recipient Page ──────────────────────────────────────────

export default function Recipient() {
  const { cardId } = useParams();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [wifiDetails, setWifiDetails] = useState(null);
  const [copiedWifi, setCopiedWifi] = useState(false);
  const eventFired = useRef(false);
  const { isReading, isSupported, readAloud, stop } = useReadAloud();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/public/cards/${cardId}`);
        const data = await res.json();

        if (cancelled) return;

        if (data.ok) {
          setCard(data.data);

          // Fire scan event exactly once — not on every render
          if (
            !eventFired.current &&
            !data.data.inactive &&
            !data.data.notFound
          ) {
            eventFired.current = true;
            fetch('/api/events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ card_id: cardId }),
            }).catch(() => {});
          }
        } else {
          setError(true);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [cardId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleWifiConnect = useCallback((config) => {
    const sec = config.security || 'WPA';
    const wifiUri = `WIFI:T:${sec};S:${config.ssid};P:${config.password || ''};;`;
    try {
      window.location.href = wifiUri;
    } catch {}
    setWifiDetails(config);
  }, []);

  const handleCopyPassword = useCallback((password) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(password);
      setCopiedWifi(true);
      setTimeout(() => setCopiedWifi(false), 2000);
    }
  }, []);

  // ── Loading ─────────────────────────────────────────────
  if (loading) return <LoadingState />;

  // ── Network error ───────────────────────────────────────
  if (error) {
    return (
      <ErrorState
        emoji="⚠️"
        title="Something went wrong"
        message="Please try again or contact your caregiver."
      />
    );
  }

  // ── Not found ───────────────────────────────────────────
  if (card.notFound) {
    return (
      <ErrorState
        emoji="🔍"
        title="Link Not Found"
        message="This assistance link could not be found. Please contact your caregiver."
      />
    );
  }

  // ── Inactive / Expired ──────────────────────────────────
  if (card.inactive) {
    return (
      <ErrorState
        emoji="🔒"
        title="No Longer Active"
        message="This assistance link is no longer active. Please contact your caregiver."
      />
    );
  }

  const blocks = card.blocks || [];
  const primaryId = card.primaryActionBlockId;

  // ── Read Aloud button ───────────────────────────────────
  const readAloudBtn = isSupported && (
    <button
      type="button"
      onClick={() => (isReading ? stop() : readAloud(getReadText(card)))}
      className="mt-6 px-6 py-3 text-[20px] rounded-2xl
                 bg-slate-100 text-slate-700 hover:bg-slate-200
                 transition-colors font-medium
                 focus:outline-none focus:ring-4 focus:ring-slate-300"
    >
      {isReading ? '⏹ Stop Reading' : '🔊 Read Aloud'}
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-5 py-10 animate-fade-in">
      <span className="text-7xl mb-4 select-none" role="img" aria-hidden="true">
        {card.icon_emoji || 'ℹ️'}
      </span>

      <h1 className="text-[34px] sm:text-[40px] font-extrabold text-slate-900 text-center leading-tight mb-6 max-w-lg">
        {card.title}
      </h1>

      {/* ── Block Container (rendered strictly in sort_order) ── */}
      <div className="w-full max-w-md space-y-5">
        {blocks.map((block) => {
          const cfg = block.config || {};
          const isPrimary = block.id === primaryId || block.is_primary_action === 1;

          switch (block.block_type) {
            // ── Text Block ──
            case 'text':
              return (
                <div
                  key={block.id}
                  className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-5 shadow-sm text-left"
                >
                  <p className="text-[24px] text-slate-800 leading-relaxed whitespace-pre-line font-medium">
                    {cfg.content}
                  </p>
                </div>
              );

            // ── Image Block ──
            case 'image':
              return (
                <div
                  key={block.id}
                  className="overflow-hidden rounded-2xl shadow-sm border-2 border-slate-200 bg-slate-50"
                >
                  <img
                    src={cfg.url}
                    alt={cfg.alt || card.title}
                    className="w-full max-h-[360px] object-cover"
                  />
                  {cfg.alt && (
                    <p className="text-center text-slate-600 text-base py-2.5 px-4 font-medium border-t border-slate-200">
                      {cfg.alt}
                    </p>
                  )}
                </div>
              );

            // ── Audio Note Block ──
            case 'audio_note':
              return (
                <div
                  key={block.id}
                  className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-5 shadow-sm text-left"
                >
                  {cfg.caption && (
                    <p className="text-[20px] font-bold text-slate-900 mb-3">
                      🎙️ {cfg.caption}
                    </p>
                  )}
                  <audio
                    controls
                    src={cfg.audio_base64}
                    className="w-full h-14 rounded-xl"
                  />
                </div>
              );

            // ── Checklist Block ──
            case 'checklist':
              return (
                <div
                  key={block.id}
                  className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-5 shadow-sm text-left"
                >
                  {cfg.title && (
                    <h2 className="text-[24px] font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">
                      {cfg.title}
                    </h2>
                  )}
                  <ol className="space-y-3">
                    {(cfg.items || []).map((item, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-3.5 text-[22px] leading-relaxed text-slate-800 font-medium"
                      >
                        <span className="shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-base mt-0.5">
                          {idx + 1}
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              );

            // ── Map Button ──
            case 'map_button':
              if (isPrimary) {
                const mapsUrl = buildMapsUrl(cfg, cfg.map_app || 'google');
                return (
                  <div key={block.id} className="w-full">
                    {cfg.destination_name && (
                      <p className="text-[22px] text-slate-600 text-center mb-3 font-semibold">
                        {cfg.destination_name}
                      </p>
                    )}
                    <BigButton
                      variant="primary"
                      onClick={() => {
                        window.location.href = mapsUrl;
                      }}
                    >
                      {cfg.label || '▶ START NAVIGATION'}
                    </BigButton>
                  </div>
                );
              }
              // Secondary map button
              return (
                <button
                  key={block.id}
                  type="button"
                  onClick={() => {
                    window.location.href = buildMapsUrl(cfg, cfg.map_app || 'google');
                  }}
                  className="w-full min-h-[56px] px-5 py-3 text-[20px] font-bold rounded-2xl
                             border-2 border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200
                             transition-colors flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]"
                >
                  🗺️ {cfg.label || 'Open Map'}
                </button>
              );

            // ── Call Button ──
            case 'call_button': {
              const tel = normalizeTel(cfg.phone_number || '');
              if (isPrimary) {
                return (
                  <div key={block.id} className="w-full">
                    {cfg.contact_name && (
                      <p className="text-[24px] font-bold text-slate-800 text-center mb-3">
                        {cfg.contact_name}
                      </p>
                    )}
                    <BigButton variant="call" href={`tel:${tel}`}>
                      {cfg.label || `📞 CALL ${(cfg.contact_name || 'CONTACT').toUpperCase()}`}
                    </BigButton>
                  </div>
                );
              }
              // Secondary call button
              return (
                <a
                  key={block.id}
                  href={`tel:${tel}`}
                  className="w-full min-h-[56px] px-5 py-3 text-[20px] font-bold rounded-2xl
                             border-2 border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200
                             transition-colors flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] no-underline"
                >
                  📞 {cfg.label || `Call ${cfg.contact_name || 'Contact'}`}
                </a>
              );
            }

            // ── Link Button ──
            case 'link_button':
              if (isPrimary) {
                return (
                  <div key={block.id} className="w-full">
                    <BigButton
                      variant="primary"
                      href={cfg.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {cfg.label || '🌐 OPEN LINK'}
                    </BigButton>
                  </div>
                );
              }
              // Secondary link button
              return (
                <a
                  key={block.id}
                  href={cfg.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full min-h-[56px] px-5 py-3 text-[20px] font-bold rounded-2xl
                             border-2 border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200
                             transition-colors flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] no-underline"
                >
                  🌐 {cfg.label || 'Open Link'}
                </a>
              );

            // ── Wi-Fi Button ──
            case 'wifi_button':
              if (isPrimary) {
                return (
                  <div key={block.id} className="w-full space-y-3">
                    <BigButton
                      variant="primary"
                      onClick={() => handleWifiConnect(cfg)}
                    >
                      {cfg.label || '📶 CONNECT TO WI-FI'}
                    </BigButton>
                    {/* Fallback plain text Wi-Fi credentials */}
                    <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 text-center">
                      <p className="text-base text-slate-500 font-medium">Network (SSID):</p>
                      <p className="text-[22px] font-bold text-slate-900 mb-2">{cfg.ssid}</p>
                      {cfg.password && (
                        <>
                          <p className="text-base text-slate-500 font-medium">Password:</p>
                          <p className="text-[22px] font-mono font-bold text-slate-900 mb-3 select-all">
                            {cfg.password}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleCopyPassword(cfg.password)}
                            className="px-4 py-2 text-base font-semibold rounded-xl bg-slate-200 text-slate-800 hover:bg-slate-300 transition-colors"
                          >
                            {copiedWifi ? '✓ Copied!' : '📋 Copy Password'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              }
              // Secondary wifi button
              return (
                <div key={block.id} className="w-full space-y-2">
                  <button
                    type="button"
                    onClick={() => handleWifiConnect(cfg)}
                    className="w-full min-h-[56px] px-5 py-3 text-[20px] font-bold rounded-2xl
                               border-2 border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200
                               transition-colors flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]"
                  >
                    📶 {cfg.label || 'Connect to Wi-Fi'}
                  </button>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center text-sm text-slate-600">
                    <span className="font-semibold">Network:</span> {cfg.ssid}
                    {cfg.password && <span className="ml-3 font-semibold">Password: <span className="font-mono">{cfg.password}</span></span>}
                  </div>
                </div>
              );

            default:
              return null;
          }
        })}
      </div>

      {readAloudBtn}

      {/* Wi-Fi popup dialog fallback */}
      {wifiDetails && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl animate-fade-in border border-slate-200">
            <span className="text-5xl block mb-2">📶</span>
            <h3 className="text-2xl font-bold text-slate-900 mb-1">Wi-Fi Details</h3>
            <p className="text-sm text-slate-500 mb-4">
              Connect to this Wi-Fi network:
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left mb-5 space-y-2">
              <div>
                <span className="text-xs uppercase font-bold text-slate-400">Network Name (SSID)</span>
                <p className="text-xl font-bold text-slate-900">{wifiDetails.ssid}</p>
              </div>
              {wifiDetails.password && (
                <div>
                  <span className="text-xs uppercase font-bold text-slate-400">Password</span>
                  <p className="text-xl font-mono font-bold text-slate-900 select-all">{wifiDetails.password}</p>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {wifiDetails.password && (
                <button
                  type="button"
                  onClick={() => handleCopyPassword(wifiDetails.password)}
                  className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-base hover:bg-blue-700 transition-colors"
                >
                  {copiedWifi ? '✓ Copied Password!' : '📋 Copy Password'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setWifiDetails(null)}
                className="w-full py-2.5 rounded-xl text-slate-600 font-semibold hover:bg-slate-100 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
