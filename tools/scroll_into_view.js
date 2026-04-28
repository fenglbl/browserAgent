import { observePageAfterAction, installPageMonitor } from './page_monitor.js';
import {
  buildScrollIntoViewSummary,
  normalizeScrollIntoViewArgs
} from './scroll_into_view_core.js';
import { createToolErrorResult, createToolSuccessResult, normalizeToolResult } from './tool_result.js';

export async function scrollIntoView(selector, options = {}) {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab) {
    return createToolErrorResult({ tool: 'scroll_into_view', error: '无法获取当前标签页' });
  }

  const normalized = normalizeScrollIntoViewArgs({ selector, ...options });
  if (!normalized.selector) {
    return createToolErrorResult({ tool: 'scroll_into_view', error: '缺少 selector' });
  }

  try {
    await installPageMonitor(activeTab.id);

    const results = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id, allFrames: true },
      func: (input) => {
        try {
          function normalizeText(value) {
            return (value || '').replace(/\s+/g, ' ').trim();
          }

          function isVisible(el) {
            if (!el) return false;
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
          }

          function findByText(raw) {
            const target = normalizeText(raw).toLowerCase();
            const all = Array.from(document.querySelectorAll('*'));
            return all.find((el) => {
              if (!isVisible(el)) return false;
              const text = normalizeText(el.innerText || el.textContent || el.getAttribute?.('aria-label') || '');
              return text.toLowerCase().includes(target);
            }) || null;
          }

          let element = null;
          const textMatch = input.selector.match(/^text\s*=\s*(.+)$/i);
          if (textMatch) {
            element = findByText(textMatch[1].trim());
          } else {
            try {
              element = document.querySelector(input.selector);
            } catch {
              return { success: false, error: `无效选择器：${input.selector}` };
            }
          }

          if (!element || !isVisible(element)) {
            return { success: false, error: `未找到元素：${input.selector}` };
          }

          const beforeRect = element.getBoundingClientRect();
          element.scrollIntoView({
            behavior: input.behavior,
            block: input.block,
            inline: input.inline
          });
          const afterRect = element.getBoundingClientRect();

          return {
            success: true,
            data: {
              tagName: element.tagName || '',
              id: element.id || '',
              before: { top: beforeRect.top, left: beforeRect.left },
              after: { top: afterRect.top, left: afterRect.left }
            }
          };
        } catch (error) {
          return { success: false, error: error?.message || '页面内滚动异常' };
        }
      },
      args: [normalized]
    });

    const successResult = (results || []).map((item) => item.result).find((item) => item?.success);
    const firstError = (results || []).map((item) => item.result).find((item) => item && !item.success);
    if (!successResult) {
      return normalizeToolResult(firstError, { tool: 'scroll_into_view', fallbackError: '执行失败' });
    }

    const observation = await observePageAfterAction(activeTab.id, {
      action: 'scroll_into_view',
      selector: normalized.selector,
      waitMs: normalized.observeMs
    });

    const summary = buildScrollIntoViewSummary({
      selector: normalized.selector,
      tagName: successResult.data?.tagName || '',
      id: successResult.data?.id || '',
      before: successResult.data?.before || null,
      after: successResult.data?.after || null,
      observation: observation?.data || null
    });
    return createToolSuccessResult({
      tool: 'scroll_into_view',
      message: summary.message,
      data: summary.data,
      meta: { observeMs: normalized.observeMs }
    });
  } catch (error) {
    return createToolErrorResult({ tool: 'scroll_into_view', error: error.message });
  }
}
