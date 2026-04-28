import { observePageAfterAction, installPageMonitor } from './page_monitor.js';
import { buildReadCookieSummary, normalizeReadCookieArgs } from './read_cookie_core.js';
import { createToolErrorResult, createToolSuccessResult, normalizeToolResult } from './tool_result.js';

export async function readCookie(options = {}) {
  const normalized = normalizeReadCookieArgs(options);
  if (!normalized.name) {
    return createToolErrorResult({ tool: 'read_cookie', error: { code: 'MISSING_NAME', message: '缺少 name' } });
  }

  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) {
      return createToolErrorResult({ tool: 'read_cookie', error: { code: 'NO_ACTIVE_TAB', message: '无法获取当前标签页' } });
    }

    await installPageMonitor(activeTab.id);

    const results = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id, allFrames: true },
      func: async (input) => {
        try {
          const cookieString = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ kind: 'read-cookie', name: input.name, domain: input.domain }, (response) => {
              const err = chrome.runtime.lastError;
              if (err) return reject(new Error(err.message));
              resolve(response || null);
            });
          });

          return {
            success: true,
            data: {
              hasCookie: Boolean(cookieString),
              value: cookieString || null
            }
          };
        } catch (error) {
          return { success: false, error: error?.message || '读取 cookie 异常' };
        }
      },
      args: [normalized]
    });

    const successResult = (results || []).map((item) => item.result).find((item) => item?.success);
    const firstError = (results || []).map((item) => item.result).find((item) => item && !item.success);
    if (!successResult) {
      return normalizeToolResult(firstError, { tool: 'read_cookie', fallbackError: '执行失败' });
    }

    const observation = await observePageAfterAction(activeTab.id, {
      action: 'read_cookie',
      selector: normalized.name,
      waitMs: normalized.observeMs
    });

    const summary = buildReadCookieSummary({
      name: normalized.name,
      value: successResult.data?.value ?? null,
      hasCookie: Boolean(successResult.data?.hasCookie),
      observation: observation?.data || null
    });

    return createToolSuccessResult({
      tool: 'read_cookie',
      message: summary.message,
      data: summary.data,
      meta: { observeMs: normalized.observeMs }
    });
  } catch (error) {
    return createToolErrorResult({ tool: 'read_cookie', error: { code: 'TOOL_ERROR', message: error.message } });
  }
}
