export function normalizeReadStorageArgs(options = {}) {
  const observeMs = Number(options.observeMs);
  return {
    type: String(options.type || 'local').trim() === 'session' ? 'session' : 'local',
    key: String(options.key || '').trim(),
    observeMs: Number.isFinite(observeMs) && observeMs > 0 ? Math.min(observeMs, 5000) : 1000
  };
}

export function buildReadStorageSummary({ type, key, value, hasKey, observation }) {
  return {
    success: true,
    message: `已读取 ${type}Storage${key ? `: ${key}` : ''}`,
    data: {
      type,
      key,
      value,
      hasKey,
      observation: observation || null
    }
  };
}
