import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import QRPanel from '../components/QRPanel.jsx';

// ─── Helpers ──────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return 'never';
  const diff = Date.now() - new Date(dateStr + 'Z').getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const TEMPLATE_CONFIG = {
  navigate: { label: 'Navigate', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  call: { label: 'Call', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  info: { label: 'Info', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  custom: { label: 'Custom', color: 'bg-blue-50 text-blue-700 border-blue-200' },
};

// ─── Dashboard ────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qrCard, setQrCard] = useState(null);

  const fetchCards = useCallback(async () => {
    try {
      const res = await fetch('/api/cards');
      const data = await res.json();
      if (data.ok) setCards(data.data);
    } catch (err) {
      console.error('Failed to fetch cards:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const handleToggle = useCallback(
    async (card) => {
      if (card.active) {
        const confirmed = window.confirm(
          'People scanning this QR will no longer see the stored assistance.\n\nDeactivate this card?'
        );
        if (!confirmed) return;
      }
      await fetch(`/api/cards/${card.id}/toggle`, { method: 'PATCH' });
      fetchCards();
    },
    [fetchCards]
  );

  // ─── Stats ────────────────────────────────────────────────
  const total = cards.length;
  const active = cards.filter((c) => c.active).length;
  const inactive = total - active;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="text-blue-600">🔗</span> CareLink
              <span className="text-slate-300 font-normal text-lg ml-1 hidden sm:inline">
                — QR Assistance Dashboard
              </span>
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Set it up once. Let your family handle the rest.
            </p>
          </div>
          <button
            onClick={() => navigate('/dashboard/new')}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm
                       hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20
                       active:scale-[0.98] flex items-center gap-2 whitespace-nowrap self-start sm:self-center"
          >
            <span className="text-lg">+</span> Create Assistance
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* ── Stats Row ──────────────────────────────────────── */}
        {!loading && cards.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-8 animate-fade-in">
            {[
              { label: 'Total Cards', value: total, icon: '📊', bg: 'bg-blue-50', text: 'text-blue-700' },
              { label: 'Active', value: active, icon: '✅', bg: 'bg-emerald-50', text: 'text-emerald-700' },
              { label: 'Inactive', value: inactive, icon: '⏸️', bg: 'bg-slate-100', text: 'text-slate-600' },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex items-center gap-3 sm:gap-4"
              >
                <div className={`w-10 h-10 sm:w-12 sm:h-12 ${s.bg} rounded-xl flex items-center justify-center text-xl sm:text-2xl shrink-0`}>
                  {s.icon}
                </div>
                <div className="min-w-0">
                  <p className={`text-xl sm:text-2xl font-bold ${s.text}`}>{s.value}</p>
                  <p className="text-xs sm:text-sm text-slate-500 truncate">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Loading ────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
          </div>
        )}

        {/* ── Empty ──────────────────────────────────────────── */}
        {!loading && cards.length === 0 && (
          <EmptyState onCreateClick={() => navigate('/dashboard/new')} />
        )}

        {/* ── Card Grid ──────────────────────────────────────── */}
        {!loading && cards.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-fade-in">
            {cards.map((card) => {
              const cfg =
                TEMPLATE_CONFIG[card.template] ||
                TEMPLATE_CONFIG[card.type] ||
                TEMPLATE_CONFIG.custom;
              return (
                <div
                  key={card.id}
                  className={`bg-white rounded-xl border border-slate-200 p-5
                              hover:shadow-md hover:border-slate-300 transition-all duration-200
                              ${!card.active ? 'opacity-60' : ''}`}
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-3xl shrink-0">{card.icon_emoji}</span>
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 truncate">{card.title}</h3>
                        {card.subtitle && (
                          <p className="text-sm text-slate-500 truncate">{card.subtitle}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                        card.active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-red-50 text-red-600 border-red-200'
                      }`}
                    >
                      {card.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Scan stats */}
                  <p className="text-xs text-slate-400 mb-4">
                    scanned {card.scan_count}× · last {timeAgo(card.last_scanned)}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setQrCard(card)}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg
                                 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                    >
                      📱 View QR
                    </button>
                    <button
                      onClick={() => navigate(`/dashboard/edit/${card.id}`)}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg
                                 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleToggle(card)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                        card.active
                          ? 'bg-red-50 text-red-600 hover:bg-red-100'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      {card.active ? '⏸️ Deactivate' : '▶️ Activate'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── QR Modal ─────────────────────────────────────────── */}
      {qrCard && <QRPanel card={qrCard} onClose={() => setQrCard(null)} />}
    </div>
  );
}
