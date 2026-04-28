import { observePageAfterAction, installPageMonitor } from './page_monitor.js';
import { buildReadStorageSummary, normalizeReadStorageArgs } from './read_storage_core.js';
import { createToolErrorResult, createToolSuccessResult, normalizeToolResult } from './tool_result.js';

export async function readStorage(options = {}) {
  const normalized = normalizeReadStorageArgs(options);
  if (!normalized.key) {
    return createToolErrorResult({ tool: 'read_storage', error: '缺少 key' });
  }

  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) {
      return createToolErrorResult({ tool: 'read_storage', error: '无法获取当前标签页' });
    }

    await installPageMonitor(activeTab.id);

    const results = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id, allFrames: true },
      func: (input) => {
        try {
          const storage = input.type === 'session' ? window.sessionStorage : window.localStorage;
          const hasKey = Object.prototype.hasOwnProperty.call(storage, input.key);
          const value = storage.getItem(input.key);
          return {
            success: true,
            data: {
              hasKey,
              value,
              type: input.type
            }
          };
        } catch (error) {
          return { success: false, error: error?.message || '页面内读取 storage 异常' };
        }
      },
      args: [normalized]
    });

    const successResult = (results || []).map((item) => item.result).find((item) => item?.success);
    const firstError = (results || []).map((item) => item.result).find((item) => item && !item.success);
    if (!successResult) {
      return normalizeToolResult(firstError, { tool: 'read_storage', fallbackError: '执行失败' });
    }

    const observation = await observePageAfterAction(activeTab.id, {
      action: 'read_storage',
      selector: normalized.key,
      waitMs: normalized.observeMs
    });

    const summary = buildReadStorageSummary({
      type: successResult.data?.type || normalized.type,
      key: normalized.key,
      value: successResult.data?.value ?? null,
      hasKey: Boolean(successResult.data?.hasKey),
      observation: observation?.data || null
    });

    return createToolSuccessResult({
      tool: 'read_storage',
      message: summary.message,
      data: summary.data,
      meta: { observeMs: normalized.observeMs }
    });
  } catch (error) {
    return createToolErrorResult({ tool: 'read_storage', error: error.message });
  }
}
