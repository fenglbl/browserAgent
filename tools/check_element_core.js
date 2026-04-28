export function normalizeCheckElementArgs(options = {}) {
  const observeMs = Number(options.observeMs);
  const rawChecked = options.checked;
  const checked = rawChecked === true || rawChecked === 'true' || rawChecked === 1 || rawChecked === '1';

  return {
    selector: String(options.selector || '').trim(),
    checked,
    observeMs: Number.isFinite(observeMs) && observeMs > 0 ? Math.min(observeMs, 5000) : 3000
  };
}

export function buildCheckElementSummary({ selector, checked, tagName, id, observation }) {
  return {
    success: true,
    message: `${checked ? '已勾选' : '已取消勾选'}元素：${selector}`,
    data: {
      selector,
      checked,
      tagName,
      id,
      observation: observation || null
    }
  };
}
