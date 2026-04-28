import { createToolErrorResult, createToolSuccessResult } from './tool_result.js';
import {
  buildWaitForUrlChangeSummary,
  buildWaitForUrlChangeTimeoutResult,
  normalizeWaitForUrlChangeArgs,
  shouldStopWaitingForUrlChange
} from './wait_for_url_change_core.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForUrlChange(options = {}) {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab) {
    return createToolErrorResult({ tool: 'wait_for_url_change', error: '无法获取当前标签页' });
  }

  const normalized = normalizeWaitForUrlChangeArgs(options);
  const startedAt = Date.now();
  let pollCount = 0;
  const before = { url: activeTab.url || '', title: activeTab.title || '' };

  while (true) {
    pollCount += 1;
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const current = { url: currentTab?.url || '', title: currentTab?.title || '' };
    const elapsedMs = Date.now() - startedAt;

    const decision = shouldStopWaitingForUrlChange({
      elapsedMs,
      timeoutMs: normalized.timeoutMs,
      before,
      current
    });

    if (decision.done && decision.success) {
      const summary = buildWaitForUrlChangeSummary({
        elapsedMs,
        pollCount,
        before,
        current,
        reason: decision.reason
      });
      return createToolSuccessResult({
        tool: 'wait_for_url_change',
        message: summary.message,
        data: summary.data,
        meta: { elapsedMs, pollCount }
      });
    }

    if (decision.done) {
      const timeoutResult = buildWaitForUrlChangeTimeoutResult({
        elapsedMs,
        pollCount,
        before,
        current
      });
      return createToolErrorResult({
        tool: 'wait_for_url_change',
        error: timeoutResult.error,
        data: timeoutResult.data,
        meta: { elapsedMs, pollCount }
      });
    }

    await sleep(normalized.intervalMs);
  }
}
