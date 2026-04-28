export function normalizeWaitForUrlChangeArgs(options = {}) {
  const timeoutMs = Number(options.timeoutMs);
  const intervalMs = Number(options.intervalMs);

  return {
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.min(timeoutMs, 15000) : 5000,
    intervalMs: Number.isFinite(intervalMs) && intervalMs > 0 ? Math.min(Math.max(intervalMs, 100), 2000) : 250
  };
}

export function shouldStopWaitingForUrlChange({ elapsedMs, timeoutMs, before, current }) {
  if ((current?.url || '') !== (before?.url || '')) {
    return { done: true, success: true, reason: 'url-changed' };
  }

  if (elapsedMs >= timeoutMs) {
    return { done: true, success: false, reason: 'timeout' };
  }

  return { done: false, success: false, reason: 'pending' };
}

export function buildWaitForUrlChangeSummary({ elapsedMs, pollCount, before, current, reason }) {
  return {
    success: true,
    message: '等待 URL 变化成功',
    data: {
      elapsedMs,
      pollCount,
      reason,
      before,
      current,
      urlChanged: (current?.url || '') !== (before?.url || '')
    }
  };
}

export function buildWaitForUrlChangeTimeoutResult({ elapsedMs, pollCount, before, current }) {
  return {
    success: false,
    error: '等待 URL 变化超时',
    data: {
      elapsedMs,
      pollCount,
      before,
      current,
      urlChanged: false
    }
  };
}
