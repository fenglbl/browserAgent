export function normalizeScrollIntoViewArgs(options = {}) {
  const behavior = String(options.behavior || 'smooth').trim() || 'smooth';
  const block = String(options.block || 'center').trim() || 'center';
  const inline = String(options.inline || 'nearest').trim() || 'nearest';
  const observeMs = Number(options.observeMs);

  return {
    selector: String(options.selector || '').trim(),
    behavior,
    block,
    inline,
    observeMs: Number.isFinite(observeMs) && observeMs > 0 ? Math.min(observeMs, 5000) : 1000
  };
}

export function buildScrollIntoViewSummary({ selector, tagName, id, before, after, observation }) {
  return {
    success: true,
    message: `已滚动到元素：${selector}`,
    data: {
      selector,
      tagName,
      id,
      before,
      after,
      observation: observation || null
    }
  };
}
