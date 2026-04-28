function hasUrlChanged(before = {}, current = {}) {
  return String(before.url || '') !== String(current.url || '');
}

function hasTitleChanged(before = {}, current = {}) {
  return String(before.title || '') !== String(current.title || '');
}

export function shouldStopWaitingForNavigation({ elapsedMs, timeoutMs, before, current }) {
  if (hasUrlChanged(before, current)) {
    return { done: true, success: true, reason: 'url-changed' };
  }

  if (hasTitleChanged(before, current)) {
    return { done: true, success: true, reason: 'title-changed' };
  }

  if (elapsedMs >= timeoutMs) {
    return { done: true, success: false, reason: 'timeout' };
  }

  return { done: false, success: false, reason: 'pending' };
}

export function normalizeNavigationWaitOptions(options = {}) {
  const timeoutMs = Number(options.timeoutMs);
  const intervalMs = Number(options.intervalMs);

  return {
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.min(timeoutMs, 15000) : 5000,
    intervalMs: Number.isFinite(intervalMs) && intervalMs > 0 ? Math.min(Math.max(intervalMs, 100), 2000) : 250
  };
}

export function buildNavigationWaitResult({ elapsedMs, pollCount, before, current, reason }) {
  return {
    success: true,
    message: '等待页面跳转成功',
    data: {
      elapsedMs,
      pollCount,
      reason,
      before,
      current,
      urlChanged: hasUrlChanged(before, current),
      titleChanged: hasTitleChanged(before, current)
    }
  };
}

export function buildNavigationTimeoutResult({ elapsedMs, pollCount, before, current }) {
  return {
    success: false,
    error: '等待页面跳转超时',
    data: {
      elapsedMs,
      pollCount,
      before,
      current,
      urlChanged: hasUrlChanged(before, current),
      titleChanged: hasTitleChanged(before, current)
    }
  };
}
