import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BLOCK_TYPES,
  ACTION_BLOCK_TYPES,
  isActionBlock,
  validateCard,
  validateBlock,
  normalizeBlocks,
} from '@shared/validate.js';
import QRPanel from '../components/QRPanel.jsx';
import BigButton from '../components/BigButton.jsx';
import { buildMapsUrl } from '@shared/maps.js';

// ─── Preset Library ───────────────────────────────────────────

const STARTER_PRESETS = [
  {
    template: 'navigate',
    label: '🧭 Quick Navigate',
    desc: 'Map navigation + notes block',
    emoji: '🧭',
    title: 'Railway Station',
    blocks: [
      {
        id: 'init-map',
        block_type: 'map_button',
        sort_order: 0,
        is_primary_action: 1,
        config: {
          label: '▶ START NAVIGATION',
          destination_name: 'Central Station',
          destination_lat: null,
          destination_lng: null,
          address_line: '',
          map_app: 'google',
        },
      },
      {
        id: 'init-notes',
        block_type: 'text',
        sort_order: 1,
        is_primary_action: 0,
        config: {
          content: 'Ask at Platform 1 information desk if you need help.',
        },
      },
    ],
  },
  {
    template: 'call',
    label: '📞 Quick Call',
    desc: 'One-tap call button',
    emoji: '📞',
    title: 'Call Ganesh',
    blocks: [
      {
        id: 'init-call',
        block_type: 'call_button',
        sort_order: 0,
        is_primary_action: 1,
        config: {
          label: '📞 CALL GANESH',
          contact_name: 'Ganesh',
          phone_number: '+91 98765 43210',
        },
      },
    ],
  },
  {
    template: 'info',
    label: 'ℹ️ Quick Info',
    desc: 'Text instructions + call for help',
    emoji: 'ℹ️',
    title: 'Hospital Appointment',
    blocks: [
      {
        id: 'init-text',
        block_type: 'text',
        sort_order: 0,
        is_primary_action: 0,
        config: {
          content: 'Appointment is at 10:30 AM on the 2nd floor.\nPlease bring your health card.',
        },
      },
      {
        id: 'init-help-call',
        block_type: 'call_button',
        sort_order: 1,
        is_primary_action: 0,
        config: {
          label: '📞 Call for Help',
          contact_name: 'Reception',
          phone_number: '+91 98765 00000',
        },
      },
    ],
  },
];

const BLOCK_DEFINITIONS = [
  {
    type: 'text',
    name: 'Text Message',
    icon: '📝',
    isAction: false,
    desc: 'Readable instructions, address details, or notes',
    defaultConfig: { content: '' },
  },
  {
    type: 'map_button',
    name: 'Map Navigation',
    icon: '🧭',
    isAction: true,
    desc: 'Driving/transit directions via Google or Apple Maps',
    defaultConfig: {
      label: '▶ START NAVIGATION',
      destination_name: '',
      destination_lat: null,
      destination_lng: null,
      address_line: '',
      map_app: 'google',
    },
  },
  {
    type: 'call_button',
    name: 'Phone Call',
    icon: '📞',
    isAction: true,
    desc: 'Direct telephone call to a specific contact',
    defaultConfig: {
      label: '📞 CALL CONTACT',
      contact_name: '',
      phone_number: '',
    },
  },
  {
    type: 'link_button',
    name: 'Web Link',
    icon: '🌐',
    isAction: true,
    desc: 'External link to a website, video, or portal',
    defaultConfig: {
      label: '🌐 OPEN LINK',
      url: '',
    },
  },
  {
    type: 'checklist',
    name: 'Checklist',
    icon: '✅',
    isAction: false,
    desc: 'Sequential read-only list (e.g. pills, documents)',
    defaultConfig: {
      title: 'Things to Remember',
      items: [''],
    },
  },
  {
    type: 'image',
    name: 'Photo / Image',
    icon: '🖼️',
    isAction: false,
    desc: 'Building photo, prescription, or landmark',
    defaultConfig: {
      url: '',
      alt: '',
    },
  },
  {
    type: 'audio_note',
    name: 'Voice Note',
    icon: '🎙️',
    isAction: false,
    desc: 'Recorded voice message played through native player',
    defaultConfig: {
      audio_base64: '',
      caption: '',
    },
  },
  {
    type: 'wifi_button',
    name: 'Wi-Fi Connect',
    icon: '📶',
    isAction: true,
    desc: 'One-tap Wi-Fi join intent with password display fallback',
    defaultConfig: {
      label: '📶 CONNECT TO WI-FI',
      ssid: '',
      password: '',
      security: 'WPA',
    },
  },
];

const COMMON_EMOJIS = ['🧭', '📞', 'ℹ️', '🏥', '🚆', '🏠', '💊', '🛒', '🚗', '🔑', ' Doctor'];

function generateBlockId() {
  return 'b_' + Math.random().toString(36).substring(2, 9);
}

// ─── Component ────────────────────────────────────────────────

export default function CardWizard() {
  const navigate = useNavigate();
  const { cardId } = useParams();
  const isEditing = Boolean(cardId);

  const [title, setTitle] = useState('');
  const [iconEmoji, setIconEmoji] = useState('ℹ️');
  const [template, setTemplate] = useState('custom');
  const [blocks, setBlocks] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [createdCard, setCreatedCard] = useState(null);
  const [loadingEdit, setLoadingEdit] = useState(isEditing);
  const [showPicker, setShowPicker] = useState(false);

  // ── Load existing card for editing ────────────────────────
  useEffect(() => {
    if (!isEditing) {
      // Default to Quick Navigate preset for a fresh card
      applyPreset(STARTER_PRESETS[0]);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/cards/${cardId}`);
        const data = await res.json();
        if (!data.ok) {
          navigate('/dashboard');
          return;
        }
        const c = data.data;
        setTitle(c.title || '');
        setIconEmoji(c.icon_emoji || 'ℹ️');
        setTemplate(c.template || 'custom');
        setBlocks(c.blocks || []);
      } catch {
        navigate('/dashboard');
      } finally {
        setLoadingEdit(false);
      }
    })();
  }, [isEditing, cardId, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Presets ───────────────────────────────────────────────
  const applyPreset = useCallback((preset) => {
    setTitle((prev) => (prev ? prev : preset.title));
    setIconEmoji(preset.emoji);
    setTemplate(preset.template);
    setBlocks(
      preset.blocks.map((b, idx) => ({
        ...b,
        id: generateBlockId(),
        sort_order: idx,
        config: { ...b.config },
      }))
    );
    setErrors({});
  }, []);

  // ── Block Mutations ───────────────────────────────────────

  const handleAddBlock = useCallback((blockType) => {
    const def = BLOCK_DEFINITIONS.find((d) => d.type === blockType);
    if (!def) return;

    setBlocks((prev) => {
      const isFirstAction =
        def.isAction && !prev.some((b) => isActionBlock(b.block_type) && b.is_primary_action === 1);

      const newBlock = {
        id: generateBlockId(),
        block_type: blockType,
        sort_order: prev.length,
        is_primary_action: isFirstAction ? 1 : 0,
        config: JSON.parse(JSON.stringify(def.defaultConfig)),
      };
      return [...prev, newBlock];
    });

    setShowPicker(false);
    setTemplate('custom');
  }, []);

  const handleRemoveBlock = useCallback((index) => {
    setBlocks((prev) => {
      const target = prev[index];
      const updated = prev.filter((_, i) => i !== index);

      // If we removed the primary action, auto-promote the first remaining action block
      if (target && target.is_primary_action === 1) {
        const nextAction = updated.find((b) => isActionBlock(b.block_type));
        if (nextAction) {
          nextAction.is_primary_action = 1;
        }
      }

      return updated.map((b, i) => ({ ...b, sort_order: i }));
    });
  }, []);

  const handleMoveBlock = useCallback((index, direction) => {
    setBlocks((prev) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;

      const newBlocks = [...prev];
      const temp = newBlocks[index];
      newBlocks[index] = newBlocks[targetIndex];
      newBlocks[targetIndex] = temp;

      return newBlocks.map((b, i) => ({ ...b, sort_order: i }));
    });
  }, []);

  // ── Set as primary action ─────────────────────────────────
  // Automatically clears primary flag from all other blocks
  const handleSetPrimary = useCallback((blockId) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (!isActionBlock(b.block_type)) {
          return { ...b, is_primary_action: 0 };
        }
        return {
          ...b,
          is_primary_action: b.id === blockId ? 1 : 0,
        };
      })
    );
  }, []);

  // ── Update individual block config ────────────────────────
  const updateBlockConfig = useCallback((blockId, key, value) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        return {
          ...b,
          config: {
            ...b.config,
            [key]: value,
          },
        };
      })
    );
  }, []);

  // ── Validation ────────────────────────────────────────────
  const validateCurrentState = useCallback(() => {
    const cardResult = validateCard({ title });
    const allErrors = { ...cardResult.errors };

    if (blocks.length === 0) {
      allErrors._canvas = 'Please add at least one block to the card.';
    }

    blocks.forEach((b, idx) => {
      const blockResult = validateBlock(b, idx);
      if (!blockResult.valid) {
        Object.assign(allErrors, blockResult.errors);
      }
    });

    setErrors(allErrors);
    return Object.keys(allErrors).length === 0;
  }, [title, blocks]);

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!validateCurrentState()) return;

    setSubmitting(true);
    try {
      const normalized = normalizeBlocks(blocks);

      const payload = {
        title: title.trim(),
        icon_emoji: iconEmoji || 'ℹ️',
        template,
        blocks: normalized,
      };

      const url = isEditing ? `/api/cards/${cardId}` : '/api/cards';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!data.ok) {
        if (data.error?.details) setErrors(data.error.details);
        else setErrors({ _server: data.error?.message || 'Failed to save card' });
        return;
      }

      if (isEditing) {
        navigate('/dashboard');
      } else {
        setCreatedCard({
          id: data.data.id,
          title,
          icon_emoji: iconEmoji || 'ℹ️',
          template,
          blocks: normalized,
        });
      }
    } catch {
      setErrors({ _server: 'Network error. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }, [validateCurrentState, blocks, title, iconEmoji, template, isEditing, cardId, navigate]);

  // ── QR modal for freshly created card ─────────────────────
  if (createdCard) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <QRPanel card={createdCard} onClose={() => navigate('/dashboard')} />
      </div>
    );
  }

  // ── Loading state for edit mode ───────────────────────────
  if (loadingEdit) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  // Check which block is designated primary
  const primaryBlock = blocks.find((b) => isActionBlock(b.block_type) && b.is_primary_action === 1);

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* ── Top Header ────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="text-slate-500 hover:text-slate-800 p-2 rounded-xl hover:bg-slate-100 transition-colors"
              title="Back to Dashboard"
            >
              ← Back
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">
                {isEditing ? 'Edit Assistance Card' : 'Block Card Builder'}
              </h1>
              <p className="text-xs text-slate-500">
                Compose blocks for the caregiver · Exactly ONE primary button for recipient
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm
                         hover:bg-blue-700 transition-all shadow-md shadow-blue-600/20
                         disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? 'Saving…' : isEditing ? 'Save Changes' : '✨ Generate QR Card'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        {/* Server or Global Errors */}
        {errors._server && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 mb-6 text-sm font-medium">
            ⚠️ {errors._server}
          </div>
        )}
        {errors._canvas && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-4 mb-6 text-sm font-medium">
            ⚠️ {errors._canvas}
          </div>
        )}

        {/* ── Top Bar: Starter Presets ────────────────────────── */}
        {!isEditing && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                ⚡ Starter Presets (One-click jumpstart)
              </span>
              <span className="text-xs text-slate-500">
                Pick a template or customize with any blocks
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {STARTER_PRESETS.map((preset) => (
                <button
                  key={preset.template}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`text-left p-3.5 rounded-xl border-2 transition-all flex items-center gap-3
                    hover:border-blue-400 hover:bg-blue-50/50 ${
                      template === preset.template
                        ? 'border-blue-600 bg-blue-50/60 shadow-xs'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                >
                  <span className="text-2xl shrink-0">{preset.emoji}</span>
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-slate-900 truncate">{preset.label}</p>
                    <p className="text-xs text-slate-500 truncate">{preset.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Two Column Builder Layout ───────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ════ LEFT COLUMN: Card Header & Block Canvas (col-span-7) ════ */}
          <div className="lg:col-span-7 space-y-6">
            {/* Card Metadata Box: Title + Emoji Picker */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                Card Header
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-start">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Icon Emoji
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={4}
                      value={iconEmoji}
                      onChange={(e) => setIconEmoji(e.target.value)}
                      className="w-16 h-12 text-center text-2xl border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {COMMON_EMOJIS.map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => setIconEmoji(em)}
                        className="text-base p-1 hover:bg-slate-100 rounded-md"
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Card Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (errors.title) setErrors((errs) => ({ ...errs, title: undefined }));
                    }}
                    placeholder="e.g. Doctor Visit, Railway Station, Call Mom"
                    className={`w-full px-4 py-3 text-base font-semibold border-2 rounded-xl focus:outline-none focus:border-blue-500 ${
                      errors.title ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'
                    }`}
                  />
                  {errors.title && (
                    <p className="text-xs text-red-600 mt-1 font-medium">{errors.title}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-1.5">
                    Shown in giant bold font at the top of the recipient's screen.
                  </p>
                </div>
              </div>
            </div>

            {/* Block Canvas Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Blocks Canvas</h2>
                  <p className="text-xs text-slate-500">
                    Add content & action blocks in any order · Exactly one primary action
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200
                             px-4 py-2 rounded-xl font-bold text-sm transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <span className="text-lg leading-none">+</span> Add Block
                </button>
              </div>

              {/* Block List */}
              {blocks.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center">
                  <span className="text-4xl block mb-2">🧱</span>
                  <p className="font-bold text-slate-700 text-base mb-1">No blocks added yet</p>
                  <p className="text-xs text-slate-500 mb-4 max-w-sm mx-auto">
                    Click the "Add Block" button below to add your first block, or choose a starter template above.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowPicker(true)}
                    className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-blue-700"
                  >
                    + Add First Block
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {blocks.map((block, index) => {
                    const isAction = isActionBlock(block.block_type);
                    const isPrimary = isAction && block.is_primary_action === 1;

                    return (
                      <div
                        key={block.id}
                        className={`bg-white rounded-2xl border-2 transition-all shadow-xs ${
                          isPrimary
                            ? 'border-blue-500 ring-2 ring-blue-500/10'
                            : 'border-slate-200'
                        }`}
                      >
                        {/* Block Header */}
                        <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 rounded-t-2xl flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xl">
                              {BLOCK_DEFINITIONS.find((d) => d.type === block.block_type)?.icon ||
                                '📦'}
                            </span>
                            <span className="font-bold text-sm text-slate-800">
                              {BLOCK_DEFINITIONS.find((d) => d.type === block.block_type)?.name ||
                                block.block_type}
                            </span>

                            {/* Primary Action Badge / Control */}
                            {isAction && (
                              <button
                                type="button"
                                onClick={() => handleSetPrimary(block.id)}
                                title={
                                  isPrimary
                                    ? 'Designated as the single primary button'
                                    : 'Click to make this the single giant primary button'
                                }
                                className={`text-xs px-2.5 py-1 rounded-full font-bold transition-all flex items-center gap-1 ${
                                  isPrimary
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'bg-slate-200 text-slate-600 hover:bg-blue-100 hover:text-blue-700'
                                }`}
                              >
                                {isPrimary ? '★ Primary Action' : '☆ Make Primary'}
                              </button>
                            )}
                          </div>

                          {/* Reorder and Delete Controls */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleMoveBlock(index, 'up')}
                              disabled={index === 0}
                              title="Move Up"
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveBlock(index, 'down')}
                              disabled={index === blocks.length - 1}
                              title="Move Down"
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveBlock(index)}
                              title="Delete Block"
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors ml-1"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>

                        {/* Block Form Content */}
                        <div className="p-5">
                          <BlockFormEditor
                            block={block}
                            index={index}
                            errors={errors}
                            onChange={(key, val) => updateBlockConfig(block.id, key, val)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add Block Button Bar */}
              {blocks.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  className="w-full py-3.5 border-2 border-dashed border-slate-300 rounded-2xl
                             text-slate-600 hover:border-blue-400 hover:bg-blue-50/40 hover:text-blue-700
                             font-bold text-sm transition-all flex items-center justify-center gap-2"
                >
                  <span className="text-xl">+</span> Add Another Block
                </button>
              )}
            </div>
          </div>

          {/* ════ RIGHT COLUMN: Live Preview Panel (col-span-5) ════ */}
          <div className="lg:col-span-5 sticky top-24">
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="font-bold text-sm text-slate-900">Live Recipient Preview</h3>
                </div>
                <span className="text-xs text-slate-400 font-mono">1 Action Rule</span>
              </div>

              {/* Phone Frame Simulator */}
              <div className="bg-slate-900 rounded-[2.5rem] p-3 shadow-2xl max-w-[340px] mx-auto border-4 border-slate-800">
                {/* Notch */}
                <div className="w-28 h-4 bg-slate-800 rounded-full mx-auto mb-3" />

                {/* Recipient View Screen */}
                <div className="bg-white rounded-[2rem] p-5 min-h-[460px] max-h-[580px] overflow-y-auto flex flex-col items-center text-center">
                  <span className="text-5xl mb-2 select-none">{iconEmoji || 'ℹ️'}</span>
                  <h2 className="text-2xl font-extrabold text-slate-900 leading-tight mb-4">
                    {title || 'Untitled Card'}
                  </h2>

                  <div className="w-full space-y-3">
                    {blocks.map((b) => {
                      const isAction = isActionBlock(b.block_type);
                      const isPrimary = isAction && b.is_primary_action === 1;
                      const cfg = b.config || {};

                      switch (b.block_type) {
                        case 'text':
                          return (
                            <div
                              key={b.id}
                              className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left text-sm text-slate-800 font-medium whitespace-pre-line leading-relaxed"
                            >
                              {cfg.content || 'Add text content...'}
                            </div>
                          );

                        case 'image':
                          return (
                            <div
                              key={b.id}
                              className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                            >
                              {cfg.url ? (
                                <img
                                  src={cfg.url}
                                  alt={cfg.alt || 'Preview'}
                                  className="w-full h-32 object-cover"
                                />
                              ) : (
                                <div className="py-6 text-slate-400 text-xs font-semibold">
                                  🖼️ Image preview
                                </div>
                              )}
                              {cfg.alt && (
                                <p className="text-[11px] text-slate-500 py-1 bg-slate-50 px-2 truncate">
                                  {cfg.alt}
                                </p>
                              )}
                            </div>
                          );

                        case 'checklist':
                          return (
                            <div
                              key={b.id}
                              className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left"
                            >
                              {cfg.title && (
                                <p className="font-bold text-xs text-slate-900 mb-2 border-b border-slate-200 pb-1">
                                  {cfg.title}
                                </p>
                              )}
                              <ol className="space-y-1 text-xs text-slate-800 font-medium">
                                {(cfg.items || []).map((it, idx) => (
                                  <li key={idx} className="flex items-center gap-2">
                                    <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px]">
                                      {idx + 1}
                                    </span>
                                    <span>{it || 'Item'}</span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          );

                        case 'audio_note':
                          return (
                            <div
                              key={b.id}
                              className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left"
                            >
                              {cfg.caption && (
                                <p className="text-xs font-bold text-slate-800 mb-1">
                                  🎙️ {cfg.caption}
                                </p>
                              )}
                              <audio
                                controls
                                src={cfg.audio_base64}
                                className="w-full h-9 rounded-lg"
                              />
                            </div>
                          );

                        case 'map_button':
                          if (isPrimary) {
                            return (
                              <div key={b.id} className="w-full">
                                {cfg.destination_name && (
                                  <p className="text-xs text-slate-500 mb-1 font-semibold truncate">
                                    {cfg.destination_name}
                                  </p>
                                )}
                                <div className="w-full py-4 px-3 bg-blue-600 text-white rounded-2xl font-bold text-base shadow-md text-center">
                                  {cfg.label || '▶ START NAVIGATION'}
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div
                              key={b.id}
                              className="w-full py-2.5 px-3 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs text-center"
                            >
                              🗺️ {cfg.label || 'Open Map'}
                            </div>
                          );

                        case 'call_button':
                          if (isPrimary) {
                            return (
                              <div key={b.id} className="w-full">
                                {cfg.contact_name && (
                                  <p className="text-xs text-slate-500 mb-1 font-semibold truncate">
                                    {cfg.contact_name}
                                  </p>
                                )}
                                <div className="w-full py-4 px-3 bg-green-600 text-white rounded-2xl font-bold text-base shadow-md text-center">
                                  {cfg.label || `📞 CALL ${(cfg.contact_name || 'CONTACT').toUpperCase()}`}
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div
                              key={b.id}
                              className="w-full py-2.5 px-3 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs text-center"
                            >
                              📞 {cfg.label || `Call ${cfg.contact_name || 'Contact'}`}
                            </div>
                          );

                        case 'link_button':
                          if (isPrimary) {
                            return (
                              <div
                                key={b.id}
                                className="w-full py-4 px-3 bg-blue-600 text-white rounded-2xl font-bold text-base shadow-md text-center"
                              >
                                {cfg.label || '🌐 OPEN LINK'}
                              </div>
                            );
                          }
                          return (
                            <div
                              key={b.id}
                              className="w-full py-2.5 px-3 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs text-center"
                            >
                              🌐 {cfg.label || 'Open Link'}
                            </div>
                          );

                        case 'wifi_button':
                          if (isPrimary) {
                            return (
                              <div key={b.id} className="w-full space-y-1.5">
                                <div className="w-full py-4 px-3 bg-blue-600 text-white rounded-2xl font-bold text-base shadow-md text-center">
                                  {cfg.label || '📶 CONNECT TO WI-FI'}
                                </div>
                                <div className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-600">
                                  Network: <strong>{cfg.ssid || 'SSID'}</strong>
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div
                              key={b.id}
                              className="w-full py-2.5 px-3 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs text-center"
                            >
                              📶 {cfg.label || 'Connect to Wi-Fi'}
                            </div>
                          );

                        default:
                          return null;
                      }
                    })}
                  </div>

                  <div className="mt-4 px-3 py-1.5 bg-slate-100 rounded-xl text-xs text-slate-600 font-medium">
                    🔊 Read Aloud
                  </div>
                </div>
              </div>

              <div className="mt-4 text-center">
                <p className="text-xs text-slate-400">
                  {primaryBlock
                    ? `Primary: ${BLOCK_DEFINITIONS.find((d) => d.type === primaryBlock.block_type)?.name}`
                    : 'No action blocks marked as primary'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Block Picker Modal ─────────────────────────────────── */}
      {showPicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-fade-in border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Choose a Block Type</h3>
                <p className="text-xs text-slate-500">
                  Pick from the 8 Lego blocks to compose your card
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPicker(false)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-2.5">
              {BLOCK_DEFINITIONS.map((def) => (
                <button
                  key={def.type}
                  type="button"
                  onClick={() => handleAddBlock(def.type)}
                  className="w-full text-left p-3.5 rounded-2xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all flex items-center gap-3.5 group"
                >
                  <span className="text-3xl p-2 rounded-xl bg-slate-50 group-hover:bg-blue-100/60 transition-colors">
                    {def.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-sm text-slate-900">{def.name}</span>
                      {def.isAction ? (
                        <span className="text-[10px] uppercase font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                          Action
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          Content
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{def.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-Component: Block Form Editors ────────────────────────

function BlockFormEditor({ block, index, errors, onChange }) {
  const prefix = `blocks[${index}]`;
  const cfg = block.config || {};

  switch (block.block_type) {
    // ── Text Block ──
    case 'text':
      return (
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Text / Instructions <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={4}
            value={cfg.content || ''}
            onChange={(e) => onChange('content', e.target.value)}
            placeholder="e.g. Go to the 2nd floor and ask for Dr. Sharma at room 204. Bring your previous reports."
            className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors[`${prefix}.content`] ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'
            }`}
          />
          {errors[`${prefix}.content`] && (
            <p className="text-xs text-red-600 mt-1">{errors[`${prefix}.content`]}</p>
          )}
        </div>
      );

    // ── Map Button ──
    case 'map_button':
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Button Label <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={cfg.label || ''}
              onChange={(e) => onChange('label', e.target.value)}
              placeholder="e.g. ▶ START NAVIGATION"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Destination Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={cfg.destination_name || ''}
              onChange={(e) => onChange('destination_name', e.target.value)}
              placeholder="e.g. Chikkamagaluru Railway Station"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Address Line (optional)
            </label>
            <input
              type="text"
              value={cfg.address_line || ''}
              onChange={(e) => onChange('address_line', e.target.value)}
              placeholder="e.g. Station Road, Chikkamagaluru, Karnataka"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Latitude (optional)</label>
              <input
                type="text"
                value={cfg.destination_lat ?? ''}
                onChange={(e) => onChange('destination_lat', e.target.value)}
                placeholder="e.g. 13.3161"
                className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Longitude (optional)</label>
              <input
                type="text"
                value={cfg.destination_lng ?? ''}
                onChange={(e) => onChange('destination_lng', e.target.value)}
                placeholder="e.g. 75.7720"
                className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      onChange('destination_lat', pos.coords.latitude.toFixed(6));
                      onChange('destination_lng', pos.coords.longitude.toFixed(6));
                    },
                    (err) => console.warn(err)
                  );
                }
              }}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1.5"
            >
              📍 Use My Current Location
            </button>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Maps App:</span>
              <button
                type="button"
                onClick={() => onChange('map_app', 'google')}
                className={`text-xs px-2.5 py-1 rounded-lg font-bold border transition-colors ${
                  (cfg.map_app || 'google') === 'google'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                Google
              </button>
              <button
                type="button"
                onClick={() => onChange('map_app', 'apple')}
                className={`text-xs px-2.5 py-1 rounded-lg font-bold border transition-colors ${
                  cfg.map_app === 'apple'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                Apple
              </button>
            </div>
          </div>
        </div>
      );

    // ── Call Button ──
    case 'call_button':
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Button Label <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={cfg.label || ''}
              onChange={(e) => onChange('label', e.target.value)}
              placeholder="e.g. 📞 CALL GANESH"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Contact Name
              </label>
              <input
                type="text"
                value={cfg.contact_name || ''}
                onChange={(e) => onChange('contact_name', e.target.value)}
                placeholder="e.g. Ganesh, Reception"
                className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={cfg.phone_number || ''}
                onChange={(e) => onChange('phone_number', e.target.value)}
                placeholder="e.g. +91 98765 43210"
                className={`w-full px-4 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors[`${prefix}.phone_number`] ? 'border-red-300 bg-red-50' : 'border-slate-200'
                }`}
              />
              {errors[`${prefix}.phone_number`] && (
                <p className="text-xs text-red-600 mt-1">{errors[`${prefix}.phone_number`]}</p>
              )}
            </div>
          </div>
        </div>
      );

    // ── Link Button ──
    case 'link_button':
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Button Label <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={cfg.label || ''}
              onChange={(e) => onChange('label', e.target.value)}
              placeholder="e.g. 🌐 OPEN APPOINTMENT PORTAL"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Target URL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={cfg.url || ''}
              onChange={(e) => onChange('url', e.target.value)}
              placeholder="https://example.com"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      );

    // ── Checklist ──
    case 'checklist':
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Checklist Title
            </label>
            <input
              type="text"
              value={cfg.title || ''}
              onChange={(e) => onChange('title', e.target.value)}
              placeholder="e.g. Things to Bring, Medication Steps"
              className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              List Items (Read-only sequential steps for recipient)
            </label>
            <div className="space-y-2">
              {(cfg.items || []).map((item, itemIdx) => (
                <div key={itemIdx} className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-xs shrink-0">
                    {itemIdx + 1}
                  </span>
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => {
                      const newItems = [...(cfg.items || [])];
                      newItems[itemIdx] = e.target.value;
                      onChange('items', newItems);
                    }}
                    placeholder={`e.g. Step ${itemIdx + 1}`}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newItems = (cfg.items || []).filter((_, i) => i !== itemIdx);
                      onChange('items', newItems.length > 0 ? newItems : ['']);
                    }}
                    className="text-slate-400 hover:text-red-500 p-1"
                    title="Remove item"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                const newItems = [...(cfg.items || []), ''];
                onChange('items', newItems);
              }}
              className="mt-3 text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              + Add Another Item
            </button>
          </div>
        </div>
      );

    // ── Image Block ──
    case 'image':
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Upload Image (Converts to Data URL) <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  onChange('url', reader.result);
                };
                reader.readAsDataURL(file);
              }}
              className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
          </div>

          {cfg.url && (
            <div className="relative rounded-xl overflow-hidden border border-slate-200 max-h-48 bg-slate-100">
              <img src={cfg.url} alt="Uploaded" className="w-full h-48 object-cover" />
              <button
                type="button"
                onClick={() => onChange('url', '')}
                className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1.5 shadow-md text-xs hover:bg-red-700"
                title="Remove image"
              >
                ✕
              </button>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Caption / Alt Description
            </label>
            <input
              type="text"
              value={cfg.alt || ''}
              onChange={(e) => onChange('alt', e.target.value)}
              placeholder="e.g. This is what the hospital main building entrance looks like"
              className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      );

    // ── Audio Note Block ──
    case 'audio_note':
      return (
        <AudioNoteEditor
          cfg={cfg}
          prefix={prefix}
          errors={errors}
          onChange={onChange}
        />
      );

    // ── Wi-Fi Button ──
    case 'wifi_button':
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Button Label <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={cfg.label || ''}
              onChange={(e) => onChange('label', e.target.value)}
              placeholder="e.g. 📶 CONNECT TO HOME WI-FI"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Wi-Fi Network Name (SSID) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={cfg.ssid || ''}
                onChange={(e) => onChange('ssid', e.target.value)}
                placeholder="e.g. Home_5G"
                className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Password
              </label>
              <input
                type="text"
                value={cfg.password || ''}
                onChange={(e) => onChange('password', e.target.value)}
                placeholder="e.g. secretpassword123"
                className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Security Type</label>
            <div className="flex gap-2">
              {['WPA', 'nopass'].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => onChange('security', sec)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold border transition-colors ${
                    (cfg.security || 'WPA') === sec
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  {sec === 'WPA' ? 'WPA / WPA2 / WPA3' : 'No Password'}
                </button>
              ))}
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
}

// ─── Sub-Component: Audio Note Recorder ───────────────────────

function AudioNoteEditor({ cfg, prefix, errors, onChange }) {
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          onChange('audio_base64', reader.result);
        };
        reader.readAsDataURL(audioBlob);

        // Stop all audio tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setRecording(true);
      setRecSeconds(0);
      timerRef.current = setInterval(() => {
        setRecSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      alert('Microphone access is required to record voice notes: ' + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      clearInterval(timerRef.current);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1.5">
          Voice Note Caption
        </label>
        <input
          type="text"
          value={cfg.caption || ''}
          onChange={(e) => onChange('caption', e.target.value)}
          placeholder="e.g. Listen to Ganesh's instructions"
          className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
        />
      </div>

      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-700">Record Caregiver Audio</span>
          {recording && (
            <span className="text-xs font-mono font-bold text-red-600 flex items-center gap-1.5 animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" />
              Recording: {recSeconds}s
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!recording ? (
            <button
              type="button"
              onClick={startRecording}
              className="px-4 py-2.5 rounded-xl bg-red-600 text-white font-bold text-xs hover:bg-red-700 transition-colors flex items-center gap-2 shadow-xs"
            >
              🎙️ {cfg.audio_base64 ? 'Record New Voice Note' : 'Start Recording'}
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-black transition-colors flex items-center gap-2 shadow-md animate-bounce"
            >
              ⏹️ Stop Recording
            </button>
          )}

          {/* Or File Upload Fallback */}
          <label className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer underline">
            Or upload audio file
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onloadend = () => {
                  onChange('audio_base64', reader.result);
                };
                reader.readAsDataURL(file);
              }}
            />
          </label>
        </div>

        {cfg.audio_base64 && (
          <div className="mt-4 pt-4 border-t border-slate-200 flex items-center gap-3">
            <audio controls src={cfg.audio_base64} className="flex-1 h-10" />
            <button
              type="button"
              onClick={() => onChange('audio_base64', '')}
              className="text-xs text-red-600 hover:text-red-800 font-bold p-1"
              title="Delete Audio"
            >
              Delete
            </button>
          </div>
        )}

        {errors[`${prefix}.audio_base64`] && (
          <p className="text-xs text-red-600 mt-2 font-medium">
            {errors[`${prefix}.audio_base64`]}
          </p>
        )}
      </div>
    </div>
  );
}
