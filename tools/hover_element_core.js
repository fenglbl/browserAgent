export function normalizeHoverElementArgs(options = {}) {
  const observeMs = Number(options.observeMs);
  return {
    selector: String(options.selector || '').trim(),
    observeMs: Number.isFinite(observeMs) && observeMs > 0 ? Math.min(observeMs, 5000) : 1000
  };
}

export function buildHoverElementSummary({ selector, tagName, id, observation }) {
  return {
    success: true,
    message: `已悬停元素：${selector}`,
    data: {
      selector,
      tagName,
      id,
      observation: observation || null
    }
  };
}
