import { observePageAfterAction, installPageMonitor } from './page_monitor.js';
import { buildCheckElementSummary, normalizeCheckElementArgs } from './check_element_core.js';
import { createToolErrorResult, createToolSuccessResult, normalizeToolResult } from './tool_result.js';

export async function checkElement(selector, options = {}) {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab) {
    return createToolErrorResult({ tool: 'check_element', error: '无法获取当前标签页' });
  }

  const normalized = normalizeCheckElementArgs({ selector, ...options });
  if (!normalized.selector) {
    return createToolErrorResult({ tool: 'check_element', error: '缺少 selector' });
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
            const all = Array.from(document.querySelectorAll('input, label, button, a, [role="checkbox"], [aria-checked]'));
            return all.find((el) => {
              if (!isVisible(el)) return false;
              const text = normalizeText(el.innerText || el.textContent || el.getAttribute?.('aria-label') || el.getAttribute?.('placeholder') || '');
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

          const checkbox = element.tagName === 'INPUT' ? element : element.querySelector?.('input[type="checkbox"]') || element;
          if (!checkbox) {
            return { success: false, error: `未找到可勾选元素：${input.selector}` };
          }

          const currentChecked = Boolean(checkbox.checked || checkbox.getAttribute?.('aria-checked') === 'true');
          const shouldCheck = Boolean(input.checked);
          if (currentChecked !== shouldCheck) {
            checkbox.focus?.();
            if ('checked' in checkbox) {
              checkbox.checked = shouldCheck;
            }
            checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            checkbox.dispatchEvent(new Event('input', { bubbles: true }));
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
          }

          return {
            success: true,
            data: {
              tagName: checkbox.tagName || '',
              id: checkbox.id || element.id || '',
              checked: shouldCheck
            }
          };
        } catch (error) {
          return { success: false, error: error?.message || '页面内勾选异常' };
        }
      },
      args: [normalized]
    });

    const successResult = (results || []).map((item) => item.result).find((item) => item?.success);
    const firstError = (results || []).map((item) => item.result).find((item) => item && !item.success);
    if (!successResult) {
      return normalizeToolResult(firstError, { tool: 'check_element', fallbackError: '执行失败' });
    }

    const observation = await observePageAfterAction(activeTab.id, {
      action: 'check_element',
      selector: normalized.selector,
      waitMs: normalized.observeMs
    });

    const summary = buildCheckElementSummary({
      selector: normalized.selector,
      checked: normalized.checked,
      tagName: successResult.data?.tagName || '',
      id: successResult.data?.id || '',
      observation: observation?.data || null
    });

    return createToolSuccessResult({
      tool: 'check_element',
      message: summary.message,
      data: summary.data,
      meta: { observeMs: normalized.observeMs }
    });
  } catch (error) {
    return createToolErrorResult({ tool: 'check_element', error: error.message });
  }
}
