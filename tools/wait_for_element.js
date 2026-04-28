import { locateWaitMatchInPage } from './dom_locator.js';
import {
  buildWaitSummary,
  buildWaitTimeoutResult,
  normalizeWaitOptions,
  shouldStopWaiting
} from './wait_for_element_core.js';
import { createToolErrorResult, createToolSuccessResult } from './tool_result.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mergeFrameMatches(results, maxCandidates) {
  const candidates = [];

  for (const item of results || []) {
    const frameCandidates = Array.isArray(item?.result?.data?.candidates)
      ? item.result.data.candidates
      : [];

    for (const candidate of frameCandidates) {
      candidates.push(candidate);
      if (candidates.length >= maxCandidates) {
        return candidates;
      }
    }
  }

  return candidates;
}

export async function waitForElement(selectorOrText, options = {}) {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab) {
    return createToolErrorResult({ tool: 'wait_for_element', error: { code: 'NO_ACTIVE_TAB', message: '无法获取当前标签页' } });
  }

  const normalized = normalizeWaitOptions(options);
  const startedAt = Date.now();
  let pollCount = 0;
  let lastMatch = { found: false, count: 0, bestCandidate: null, candidates: [] };

  while (true) {
    pollCount += 1;

    const results = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id, allFrames: true },
      func: locateWaitMatchInPage,
      args: [selectorOrText, { maxCandidates: normalized.maxCandidates }]
    });

    const candidates = mergeFrameMatches(results, normalized.maxCandidates);
    lastMatch = {
      found: candidates.length > 0,
      count: candidates.length,
      bestCandidate: candidates[0] || null,
      candidates
    };

    const elapsedMs = Date.now() - startedAt;
    const decision = shouldStopWaiting({
      elapsedMs,
      timeoutMs: normalized.timeoutMs,
      result: lastMatch
    });

    if (decision.done && decision.success) {
      const summary = buildWaitSummary({
        selectorOrText,
        elapsedMs,
        pollCount,
        match: lastMatch
      });
      return createToolSuccessResult({
        tool: 'wait_for_element',
        message: summary.message,
        data: summary.data,
        meta: { elapsedMs, pollCount }
      });
    }

    if (decision.done) {
      const timeoutResult = buildWaitTimeoutResult({
        selectorOrText,
        elapsedMs,
        pollCount,
        lastMatch
      });
      return createToolErrorResult({
        tool: 'wait_for_element',
        error: { code: 'TIMEOUT', message: timeoutResult.error },
        data: timeoutResult.data,
        meta: { elapsedMs, pollCount }
      });
    }

    await sleep(normalized.intervalMs);
  }
}
