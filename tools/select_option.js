import { observePageAfterAction, installPageMonitor } from './page_monitor.js';
import {
  buildSelectOptionSummary,
  normalizeSelectOptionArgs,
  resolveSelectOptionTarget
} from './select_option_core.js';
import { createToolErrorResult, createToolSuccessResult, normalizeToolResult } from './tool_result.js';

function getOptionsFromElement(element) {
  if (!element) return [];
  if (element.tagName === 'SELECT') {
    return Array.from(element.options || []).map((option, index) => ({
      value: option.value,
      label: option.textContent || option.label || '',
      index,
      element: option
    }));
  }
  return [];
}

export async function selectOption(selector, options = {}) {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab) {
    return createToolErrorResult({ tool: 'select_option', error: '无法获取当前标签页' });
  }

  const normalized = normalizeSelectOptionArgs({ selector, ...options });
  if (!normalized.selector) {
    return createToolErrorResult({ tool: 'select_option', error: '缺少 selector' });
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
            const all = Array.from(document.querySelectorAll('select, input, textarea, [role="combobox"], [role="listbox"]'));
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

          const options = Array.from(element.options || []).map((option, index) => ({
            value: option.value,
            label: option.textContent || option.label || '',
            index
          }));
          const target = input.value || input.label || input.index;
          const resolved = (function resolve() {
            const value = String(input.value || '').trim().toLowerCase();
            const label = String(input.label || '').trim().toLowerCase();
            if (Number.isInteger(input.index) && input.index >= 0 && input.index < options.length) {
              return { matched: true, mode: 'index', index: input.index };
            }
            const byValue = options.findIndex((item) => String(item.value || '').trim().toLowerCase() === value && value);
            if (byValue >= 0) return { matched: true, mode: 'value', index: byValue };
            const byLabel = options.findIndex((item) => String(item.label || '').trim().toLowerCase() === label && label);
            if (byLabel >= 0) return { matched: true, mode: 'label', index: byLabel };
            const byValueContains = options.findIndex((item) => String(item.value || '').trim().toLowerCase().includes(value) && value);
            if (byValueContains >= 0) return { matched: true, mode: 'value-contains', index: byValueContains };
            const byLabelContains = options.findIndex((item) => String(item.label || '').trim().toLowerCase().includes(label) && label);
            if (byLabelContains >= 0) return { matched: true, mode: 'label-contains', index: byLabelContains };
            return { matched: false, mode: 'none', index: -1 };
          })();

          if (!resolved.matched || resolved.index < 0) {
            return { success: false, error: '未找到匹配的下拉选项', data: { options } };
          }

          const option = options[resolved.index];
          element.value = option.value;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));

          return {
            success: true,
            data: {
              tagName: element.tagName || '',
              id: element.id || '',
              matched: true,
              mode: resolved.mode,
              value: option.value,
              label: option.label,
              index: resolved.index
            }
          };
        } catch (error) {
          return { success: false, error: error?.message || '页面内选择异常' };
        }
      },
      args: [normalized]
    });

    const successResult = (results || []).map((item) => item.result).find((item) => item?.success);
    const firstError = (results || []).map((item) => item.result).find((item) => item && !item.success);
    if (!successResult) {
      return normalizeToolResult(firstError, { tool: 'select_option', fallbackError: '执行失败' });
    }

    const observation = await observePageAfterAction(activeTab.id, {
      action: 'select_option',
      selector: normalized.selector,
      waitMs: normalized.observeMs
    });

    const summary = buildSelectOptionSummary({
      selector: normalized.selector,
      matched: Boolean(successResult.data?.matched),
      mode: successResult.data?.mode || 'none',
      value: successResult.data?.value || '',
      label: successResult.data?.label || '',
      index: successResult.data?.index ?? null,
      observation: observation?.data || null
    });

    return createToolSuccessResult({
      tool: 'select_option',
      message: summary.message,
      data: summary.data,
      meta: { observeMs: normalized.observeMs }
    });
  } catch (error) {
    return createToolErrorResult({ tool: 'select_option', error: error.message });
  }
}
