export function normalizeReadAttributeArgs(options = {}) {
  const observeMs = Number(options.observeMs);
  return {
    selector: String(options.selector || '').trim(),
    attribute: String(options.attribute || '').trim(),
    observeMs: Number.isFinite(observeMs) && observeMs > 0 ? Math.min(observeMs, 5000) : 1000
  };
}

export function buildReadAttributeSummary({ selector, attribute, value, tagName, id, observation }) {
  return {
    success: true,
    message: `已读取属性：${attribute}`,
    data: {
      selector,
      attribute,
      value,
      tagName,
      id,
      observation: observation || null
    }
  };
}
