export function normalizeWaitForNetworkIdleArgs(options = {}) {
  const timeoutMs = Number(options.timeoutMs);
  const quietMs = Number(options.quietMs);
  return {
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.min(timeoutMs, 30000) : 5000,
    quietMs: Number.isFinite(quietMs) && quietMs > 0 ? Math.min(quietMs, 5000) : 1000
  };
}

export function buildWaitForNetworkIdleSummary({ elapsedMs, quietMs, requestCount, responseCount, failedCount }) {
  return {
    success: true,
    message: '已等待网络空闲',
    data: {
      elapsedMs,
      quietMs,
      requestCount,
      responseCount,
      failedCount
    }
  };
}

export function buildWaitForNetworkIdleTimeoutResult({ elapsedMs, quietMs, requestCount, responseCount, failedCount }) {
  return {
    success: false,
    error: '等待网络空闲超时',
    data: {
      elapsedMs,
      quietMs,
      requestCount,
      responseCount,
      failedCount
    }
  };
}
