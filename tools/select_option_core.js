export function normalizeSelectOptionArgs(options = {}) {
  const observeMs = Number(options.observeMs);
  const index = Number(options.index);

  return {
    selector: String(options.selector || '').trim(),
    value: String(options.value || '').trim(),
    label: String(options.label || '').trim(),
    index: Number.isFinite(index) ? index : null,
    observeMs: Number.isFinite(observeMs) && observeMs > 0 ? Math.min(observeMs, 5000) : 3000
  };
}

export function resolveSelectOptionTarget({ options = [], value = '', label = '', index = null } = {}) {
  const normalizedValue = String(value || '').trim().toLowerCase();
  const normalizedLabel = String(label || '').trim().toLowerCase();

  if (Number.isInteger(index) && index >= 0 && index < options.length) {
    return { matched: true, mode: 'index', index };
  }

  const byValue = options.findIndex((item) => String(item?.value || '').trim().toLowerCase() === normalizedValue && normalizedValue);
  if (byValue >= 0) return { matched: true, mode: 'value', index: byValue };

  const byLabel = options.findIndex((item) => String(item?.label || '').trim().toLowerCase() === normalizedLabel && normalizedLabel);
  if (byLabel >= 0) return { matched: true, mode: 'label', index: byLabel };

  const byValueContains = options.findIndex((item) => String(item?.value || '').trim().toLowerCase().includes(normalizedValue) && normalizedValue);
  if (byValueContains >= 0) return { matched: true, mode: 'value-contains', index: byValueContains };

  const byLabelContains = options.findIndex((item) => String(item?.label || '').trim().toLowerCase().includes(normalizedLabel) && normalizedLabel);
  if (byLabelContains >= 0) return { matched: true, mode: 'label-contains', index: byLabelContains };

  return { matched: false, mode: 'none', index: -1 };
}

export function buildSelectOptionSummary({ selector, matched, mode, value, label, index, observation }) {
  return {
    success: true,
    message: `已选择下拉选项：${selector}`,
    data: {
      selector,
      matched,
      mode,
      value,
      label,
      index,
      observation: observation || null
    }
  };
}
