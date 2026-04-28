const KEY_ALIASES = {
  enter: { key: 'Enter', code: 'Enter', keyCode: 13 },
  return: { key: 'Enter', code: 'Enter', keyCode: 13 },
  escape: { key: 'Escape', code: 'Escape', keyCode: 27 },
  esc: { key: 'Escape', code: 'Escape', keyCode: 27 },
  tab: { key: 'Tab', code: 'Tab', keyCode: 9 },
  arrowup: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
  arrowdown: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
  arrowleft: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
  arrowright: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 }
};

export function resolveKeyDefinition(rawKey) {
  const normalized = String(rawKey || '').trim().toLowerCase();
  return KEY_ALIASES[normalized] || null;
}

export function normalizePressKeyArgs(options = {}) {
  const resolved = resolveKeyDefinition(options.key);
  const observeMs = Number(options.observeMs);

  return {
    key: resolved?.key || 'Enter',
    selector: options.selector ? String(options.selector).trim() : '',
    observeMs: Number.isFinite(observeMs) && observeMs > 0 ? Math.min(observeMs, 10000) : 3000
  };
}

export function buildPressKeySummary({ key, selector, tagName, id, observation }) {
  return {
    success: true,
    message: `已按键：${key}`,
    data: {
      key,
      selector,
      tagName,
      id,
      observation: observation || null
    }
  };
}
