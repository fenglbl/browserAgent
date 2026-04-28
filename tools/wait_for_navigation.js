import {
  buildNavigationTimeoutResult,
  buildNavigationWaitResult,
  normalizeNavigationWaitOptions,
  shouldStopWaitingForNavigation
} from './wait_for_navigation_core.js';
import { createToolErrorResult, createToolSuccessResult } from './tool_result.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeTabInfo(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    return {
      url: tab?.url || '',
      title: tab?.title || ''
    };
  } catch {
    return {
      url: '',
      title: ''
    };
  }
}

export async function waitForNavigation(options = {}) {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab) {
    return createToolErrorResult({ tool: 'wait_for_navigation', error: '无法获取当前标签页' });
  }

  const normalized = normalizeNavigationWaitOptions(options);
  const before = await safeTabInfo(activeTab.id);
  const startedAt = Date.now();
  let pollCount = 0;

  while (true) {
    pollCount += 1;
    const current = await safeTabInfo(activeTab.id);
    const elapsedMs = Date.now() - startedAt;
    const decision = shouldStopWaitingForNavigation({
      elapsedMs,
      timeoutMs: normalized.timeoutMs,
      before,
      current
    });

    if (decision.done && decision.success) {
      const result = buildNavigationWaitResult({
        elapsedMs,
        pollCount,
        before,
        current,
        reason: decision.reason
      });
      return createToolSuccessResult({
        tool: 'wait_for_navigation',
        message: result.message,
        data: result.data,
        meta: { elapsedMs, pollCount }
      });
    }

    if (decision.done) {
      const result = buildNavigationTimeoutResult({
        elapsedMs,
        pollCount,
        before,
        current
      });
      return createToolErrorResult({
        tool: 'wait_for_navigation',
        error: result.error,
        data: result.data,
        meta: { elapsedMs, pollCount }
      });
    }

    await sleep(normalized.intervalMs);
  }
}
