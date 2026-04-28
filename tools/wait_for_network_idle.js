import { createToolErrorResult, createToolSuccessResult } from './tool_result.js';
import {
  buildWaitForNetworkIdleSummary,
  buildWaitForNetworkIdleTimeoutResult,
  normalizeWaitForNetworkIdleArgs
} from './wait_for_network_idle_core.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForNetworkIdle(options = {}) {
  const normalized = normalizeWaitForNetworkIdleArgs(options);
  const startedAt = Date.now();

  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) {
      return createToolErrorResult({ tool: 'wait_for_network_idle', error: { code: 'NO_ACTIVE_TAB', message: '无法获取当前标签页' } });
    }

    const networkState = { requestCount: 0, responseCount: 0, failedCount: 0, lastActivityAt: Date.now() };
    const handler = {
      onBeforeRequest: (details) => {
        if (details.tabId === activeTab.id) {
          networkState.requestCount += 1;
          networkState.lastActivityAt = Date.now();
        }
      },
      onCompleted: (details) => {
        if (details.tabId === activeTab.id) {
          networkState.responseCount += 1;
          networkState.lastActivityAt = Date.now();
        }
      },
      onErrorOccurred: (details) => {
        if (details.tabId === activeTab.id) {
          networkState.failedCount += 1;
          networkState.lastActivityAt = Date.now();
        }
      }
    };

    chrome.webRequest.onBeforeRequest.addListener(handler.onBeforeRequest, { urls: ['<all_urls>'], tabId: activeTab.id });
    chrome.webRequest.onCompleted.addListener(handler.onCompleted, { urls: ['<all_urls>'], tabId: activeTab.id });
    chrome.webRequest.onErrorOccurred.addListener(handler.onErrorOccurred, { urls: ['<all_urls>'], tabId: activeTab.id });

    try {
      while (true) {
        const elapsedMs = Date.now() - startedAt;
        const quietForMs = Date.now() - networkState.lastActivityAt;
        if (quietForMs >= normalized.quietMs && networkState.requestCount > 0) {
          const summary = buildWaitForNetworkIdleSummary({
            elapsedMs,
            quietMs: normalized.quietMs,
            requestCount: networkState.requestCount,
            responseCount: networkState.responseCount,
            failedCount: networkState.failedCount
          });
          return createToolSuccessResult({
            tool: 'wait_for_network_idle',
            message: summary.message,
            data: summary.data,
            meta: { elapsedMs, quietMs: normalized.quietMs }
          });
        }

        if (elapsedMs >= normalized.timeoutMs) {
          const timeoutResult = buildWaitForNetworkIdleTimeoutResult({
            elapsedMs,
            quietMs: normalized.quietMs,
            requestCount: networkState.requestCount,
            responseCount: networkState.responseCount,
            failedCount: networkState.failedCount
          });
          return createToolErrorResult({
            tool: 'wait_for_network_idle',
            error: { code: 'TIMEOUT', message: timeoutResult.error },
            data: timeoutResult.data,
            meta: { elapsedMs, quietMs: normalized.quietMs }
          });
        }

        await sleep(250);
      }
    } finally {
      try { chrome.webRequest.onBeforeRequest.removeListener(handler.onBeforeRequest); } catch {}
      try { chrome.webRequest.onCompleted.removeListener(handler.onCompleted); } catch {}
      try { chrome.webRequest.onErrorOccurred.removeListener(handler.onErrorOccurred); } catch {}
    }
  } catch (error) {
    return createToolErrorResult({ tool: 'wait_for_network_idle', error: { code: 'TOOL_ERROR', message: error.message } });
  }
}
