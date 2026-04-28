export function normalizeReadCookieArgs(options = {}) {
  const observeMs = Number(options.observeMs);
  return {
    name: String(options.name || '').trim(),
    domain: String(options.domain || '').trim(),
    observeMs: Number.isFinite(observeMs) && observeMs > 0 ? Math.min(observeMs, 5000) : 1000
  };
}

export function buildReadCookieSummary({ name, value, hasCookie, observation }) {
  return {
    success: true,
    message: `已读取 cookie${name ? `: ${name}` : ''}`,
    data: {
      name,
      value,
      hasCookie,
      observation: observation || null
    }
  };
}
