export function shouldStopWaiting({ elapsedMs, timeoutMs, result }) {
  if (result?.found) {
    return { done: true, success: true, reason: 'found' };
  }

  if (elapsedMs >= timeoutMs) {
    return { done: true, success: false, reason: 'timeout' };
  }

  return { done: false, success: false, reason: 'pending' };
}

export function normalizeWaitOptions(options = {}) {
  const timeoutMs = Number(options.timeoutMs);
  const intervalMs = Number(options.intervalMs);
  const maxCandidates = Number(options.maxCandidates);

  return {
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.min(timeoutMs, 15000) : 3000,
    intervalMs: Number.isFinite(intervalMs) && intervalMs > 0 ? Math.min(Math.max(intervalMs, 100), 2000) : 250,
    maxCandidates: Number.isFinite(maxCandidates) && maxCandidates > 0 ? Math.min(maxCandidates, 10) : 10
  };
}

export function buildWaitTimeoutResult({ selectorOrText, elapsedMs, pollCount, lastMatch }) {
  return {
    success: false,
    error: `等待元素超时：${selectorOrText}`,
    data: {
      selectorOrText,
      elapsedMs,
      pollCount,
      lastMatch: {
        found: Boolean(lastMatch?.found),
        count: Number(lastMatch?.count || 0),
        bestCandidate: lastMatch?.bestCandidate || null,
        candidates: Array.isArray(lastMatch?.candidates) ? lastMatch.candidates.slice(0, 5) : []
      }
    }
  };
}

export function buildWaitSummary({ selectorOrText, elapsedMs, pollCount, match }) {
  const candidates = Array.isArray(match?.candidates)
    ? match.candidates.slice(0, 5).map((candidate) => ({
        text: candidate.text || '',
        tagName: candidate.tagName || '',
        id: candidate.id || '',
        preferredClickSelector: candidate.preferredClickSelector || null,
        preferredTypeSelector: candidate.preferredTypeSelector || null
      }))
    : [];

  return {
    success: true,
    message: `等待元素成功：${selectorOrText}`,
    data: {
      selectorOrText,
      count: Number(match?.count || 0),
      elapsedMs,
      pollCount,
      bestCandidate: match?.bestCandidate || null,
      candidates
    }
  };
}
