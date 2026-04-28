export function normalizeWaitForTextArgs(options = {}) {
  const timeoutMs = Number(options.timeoutMs);
  const intervalMs = Number(options.intervalMs);
  const maxMatches = Number(options.maxMatches);

  return {
    text: String(options.text || '').trim(),
    caseSensitive: Boolean(options.caseSensitive),
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.min(timeoutMs, 15000) : 3000,
    intervalMs: Number.isFinite(intervalMs) && intervalMs > 0 ? Math.min(Math.max(intervalMs, 100), 2000) : 250,
    maxMatches: Number.isFinite(maxMatches) && maxMatches > 0 ? Math.min(maxMatches, 10) : 5
  };
}

export function shouldStopWaitingForText({ elapsedMs, timeoutMs, result }) {
  if (result?.found) {
    return { done: true, success: true, reason: 'found' };
  }

  if (elapsedMs >= timeoutMs) {
    return { done: true, success: false, reason: 'timeout' };
  }

  return { done: false, success: false, reason: 'pending' };
}

export function buildWaitForTextSummary({ text, elapsedMs, pollCount, match }) {
  return {
    success: true,
    message: `等待文本成功：${text}`,
    data: {
      text,
      elapsedMs,
      pollCount,
      count: Number(match?.count || 0),
      matches: Array.isArray(match?.matches) ? match.matches.slice(0, 5) : []
    }
  };
}

export function buildWaitForTextTimeoutResult({ text, elapsedMs, pollCount, lastMatch }) {
  return {
    success: false,
    error: `等待文本超时：${text}`,
    data: {
      text,
      elapsedMs,
      pollCount,
      lastMatch: {
        found: Boolean(lastMatch?.found),
        count: Number(lastMatch?.count || 0),
        matches: Array.isArray(lastMatch?.matches) ? lastMatch.matches.slice(0, 5) : []
      }
    }
  };
}
