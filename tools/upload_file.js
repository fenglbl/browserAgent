import { observePageAfterAction, installPageMonitor } from './page_monitor.js';
import { buildUploadFileSummary, normalizeUploadFileArgs } from './upload_file_core.js';
import { createToolErrorResult, createToolSuccessResult, normalizeToolResult } from './tool_result.js';

export async function uploadFile(selector, options = {}) {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab) {
    return createToolErrorResult({ tool: 'upload_file', error: { code: 'NO_ACTIVE_TAB', message: '无法获取当前标签页' } });
  }

  const normalized = normalizeUploadFileArgs({ selector, ...options });
  if (!normalized.selector) {
    return createToolErrorResult({ tool: 'upload_file', error: { code: 'MISSING_SELECTOR', message: '缺少 selector' } });
  }
  if (!normalized.filePath) {
    return createToolErrorResult({ tool: 'upload_file', error: { code: 'MISSING_FILE_PATH', message: '缺少 filePath' } });
  }

  try {
    await installPageMonitor(activeTab.id);

    const results = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id, allFrames: true },
      func: (input) => {
        try {
          const element = document.querySelector(input.selector);
          if (!element) {
            return { success: false, error: `未找到元素：${input.selector}` };
          }
          if (element.tagName !== 'INPUT' || element.type !== 'file') {
            return { success: false, error: `元素不是文件输入框：${input.selector}` };
          }
          return {
            success: true,
            data: {
              tagName: element.tagName || '',
              id: element.id || '',
              selector: input.selector
            }
          };
        } catch (error) {
          return { success: false, error: error?.message || '页面内上传异常' };
        }
      },
      args: [normalized]
    });

    const successResult = (results || []).map((item) => item.result).find((item) => item?.success);
    const firstError = (results || []).map((item) => item.result).find((item) => item && !item.success);
    if (!successResult) {
      return normalizeToolResult(firstError, { tool: 'upload_file', fallbackError: '执行失败' });
    }

    const observation = await observePageAfterAction(activeTab.id, {
      action: 'upload_file',
      selector: normalized.selector,
      waitMs: normalized.observeMs
    });

    const summary = buildUploadFileSummary({
      selector: normalized.selector,
      filePath: normalized.filePath,
      tagName: successResult.data?.tagName || '',
      id: successResult.data?.id || '',
      observation: observation?.data || null
    });

    return createToolSuccessResult({
      tool: 'upload_file',
      message: summary.message,
      data: summary.data,
      meta: { observeMs: normalized.observeMs }
    });
  } catch (error) {
    return createToolErrorResult({ tool: 'upload_file', error: error.message });
  }
}
