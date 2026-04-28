import { createToolErrorResult, createToolSuccessResult } from './tool_result.js';
import { buildFillFormSummary, normalizeFillFormArgs } from './fill_form_core.js';

export async function fillForm(options = {}) {
  const normalized = normalizeFillFormArgs(options);
  const fields = Array.isArray(options.fields) ? options.fields : [];

  if (!fields.length) {
    return createToolErrorResult({ tool: 'fill_form', error: { code: 'MISSING_FIELDS', message: '缺少 fields' } });
  }

  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) {
      return createToolErrorResult({ tool: 'fill_form', error: '无法获取当前标签页' });
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id, allFrames: true },
      func: (input) => {
        function normalizeText(value) {
          return (value || '').replace(/\s+/g, ' ').trim();
        }

        function isVisible(el) {
          if (!el) return false;
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        }

        const applied = [];
        for (const field of input.fields.slice(0, input.maxFields)) {
          const selector = String(field.selector || '').trim();
          if (!selector) continue;
          let element = null;
          try {
            element = document.querySelector(selector);
          } catch {
            continue;
          }
          if (!element || !isVisible(element)) continue;
          if ('value' in element) {
            element.value = String(field.value ?? '');
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            applied.push({ selector, value: String(field.value ?? ''), tagName: element.tagName || '', id: element.id || '' });
          }
        }

        return {
          success: true,
          data: {
            count: applied.length,
            fields: applied
          }
        };
      },
      args: [{ fields, maxFields: normalized.maxFields }]
    });

    const successResult = (results || []).map((item) => item.result).find((item) => item?.success);
    if (!successResult) {
      return createToolErrorResult({ tool: 'fill_form', error: '执行失败' });
    }

    const summary = buildFillFormSummary({
      count: successResult.data?.count || 0,
      fields: successResult.data?.fields || []
    });

    return createToolSuccessResult({
      tool: 'fill_form',
      message: summary.message,
      data: summary.data,
      meta: { maxFields: normalized.maxFields }
    });
  } catch (error) {
    return createToolErrorResult({ tool: 'fill_form', error: error.message });
  }
}
