/**
 * Shared validation and normalization for cards and blocks.
 * Used by server routes and client forms.
 */

export const BLOCK_TYPES = [
  'text',
  'image',
  'map_button',
  'call_button',
  'link_button',
  'audio_note',
  'wifi_button',
  'checklist',
];

export const ACTION_BLOCK_TYPES = [
  'map_button',
  'call_button',
  'link_button',
  'wifi_button',
];

export function isActionBlock(blockType) {
  return ACTION_BLOCK_TYPES.includes(blockType);
}

const MAX_TITLE = 200;
const MAX_TEXT = 3000;
const MAX_PHONE = 30;

export function validateCard(data) {
  const errors = {};

  if (!data.title || data.title.trim().length === 0) {
    errors.title = 'Title is required';
  } else if (data.title.length > MAX_TITLE) {
    errors.title = `Title must be ${MAX_TITLE} characters or less`;
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateBlock(block, index = 0) {
  const errors = {};
  const prefix = `blocks[${index}]`;

  if (!block || !block.block_type) {
    errors[`${prefix}.block_type`] = 'Block type is required';
    return { valid: false, errors };
  }

  if (!BLOCK_TYPES.includes(block.block_type)) {
    errors[`${prefix}.block_type`] = `Invalid block type: ${block.block_type}`;
    return { valid: false, errors };
  }

  const cfg = block.config || block.config_json || {};
  const config = typeof cfg === 'string' ? JSON.parse(cfg || '{}') : cfg;

  switch (block.block_type) {
    case 'text':
      if (!config.content || config.content.trim().length === 0) {
        errors[`${prefix}.content`] = 'Text content is required';
      } else if (config.content.length > MAX_TEXT) {
        errors[`${prefix}.content`] = `Text must be ${MAX_TEXT} characters or less`;
      }
      break;

    case 'image':
      if (!config.url || config.url.trim().length === 0) {
        errors[`${prefix}.url`] = 'Image is required';
      }
      break;

    case 'map_button':
      if (!config.label || config.label.trim().length === 0) {
        errors[`${prefix}.label`] = 'Button label is required';
      }
      if (
        (!config.destination_name || config.destination_name.trim().length === 0) &&
        (!config.address_line || config.address_line.trim().length === 0) &&
        (config.destination_lat == null || config.destination_lng == null)
      ) {
        errors[`${prefix}.destination`] = 'Destination name, address, or coordinates required';
      }
      if (config.destination_lat != null && config.destination_lat !== '') {
        const lat = Number(config.destination_lat);
        if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
          errors[`${prefix}.destination_lat`] = 'Latitude must be between -90 and 90';
        }
      }
      if (config.destination_lng != null && config.destination_lng !== '') {
        const lng = Number(config.destination_lng);
        if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
          errors[`${prefix}.destination_lng`] = 'Longitude must be between -180 and 180';
        }
      }
      break;

    case 'call_button':
      if (!config.label || config.label.trim().length === 0) {
        errors[`${prefix}.label`] = 'Button label is required';
      }
      if (!config.phone_number || config.phone_number.trim().length === 0) {
        errors[`${prefix}.phone_number`] = 'Phone number is required';
      } else if (config.phone_number.length > MAX_PHONE) {
        errors[`${prefix}.phone_number`] = `Phone number must be ${MAX_PHONE} characters or less`;
      }
      break;

    case 'link_button':
      if (!config.label || config.label.trim().length === 0) {
        errors[`${prefix}.label`] = 'Button label is required';
      }
      if (!config.url || config.url.trim().length === 0) {
        errors[`${prefix}.url`] = 'URL is required';
      }
      break;

    case 'audio_note':
      if (!config.audio_base64 || config.audio_base64.trim().length === 0) {
        errors[`${prefix}.audio_base64`] = 'Audio recording is required';
      }
      break;

    case 'wifi_button':
      if (!config.label || config.label.trim().length === 0) {
        errors[`${prefix}.label`] = 'Button label is required';
      }
      if (!config.ssid || config.ssid.trim().length === 0) {
        errors[`${prefix}.ssid`] = 'Wi-Fi network name (SSID) is required';
      }
      break;

    case 'checklist':
      if (!Array.isArray(config.items) || config.items.filter((i) => i && i.trim()).length === 0) {
        errors[`${prefix}.items`] = 'Checklist must have at least one item';
      }
      break;
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Server-side & client-side enforcement of THE ONE PRIMARY ACTION RULE:
 * 1. Only action blocks may have is_primary_action = 1.
 * 2. At most one action block has is_primary_action = 1 (first designated kept, extras demoted).
 * 3. If at least one action block exists, but none is marked primary, auto-promote the first action block.
 * 4. Normalizes sort_order sequentially (0, 1, 2...).
 */
export function normalizeBlocks(rawBlocks = []) {
  if (!Array.isArray(rawBlocks)) return [];

  // Clone and ensure config is stringified or preserved
  const blocks = rawBlocks.map((b, idx) => ({
    id: b.id,
    block_type: b.block_type,
    sort_order: b.sort_order ?? idx,
    is_primary_action: b.is_primary_action ? 1 : 0,
    config: b.config !== undefined ? b.config : (typeof b.config_json === 'string' ? JSON.parse(b.config_json || '{}') : b.config_json),
  }));

  // Sort by sort_order
  blocks.sort((a, b) => a.sort_order - b.sort_order);

  // Re-index sort_order
  blocks.forEach((b, idx) => {
    b.sort_order = idx;
    // Non-action blocks are never primary
    if (!isActionBlock(b.block_type)) {
      b.is_primary_action = 0;
    }
  });

  // Action blocks enforcement
  const actionBlocks = blocks.filter((b) => isActionBlock(b.block_type));

  if (actionBlocks.length > 0) {
    const primaryActions = actionBlocks.filter((b) => b.is_primary_action === 1);

    if (primaryActions.length === 0) {
      // Auto-promote the first action block in sort_order to primary
      actionBlocks[0].is_primary_action = 1;
    } else if (primaryActions.length > 1) {
      // Keep only the first designated primary, auto-demote the rest
      let foundFirst = false;
      actionBlocks.forEach((b) => {
        if (b.is_primary_action === 1) {
          if (!foundFirst) {
            foundFirst = true;
          } else {
            b.is_primary_action = 0;
          }
        }
      });
    }
  }

  return blocks;
}
