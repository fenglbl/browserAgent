import { createToolErrorResult, createToolSuccessResult, normalizeToolResult } from './tool_result.js';
import { buildExtractFormsSummary, normalizeExtractFormsArgs } from './extract_forms_core.js';

export async function extractForms(options = {}) {
  const normalized = normalizeExtractFormsArgs(options);

  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) {
      return createToolErrorResult({ tool: 'extract_forms', error: { code: 'NO_ACTIVE_TAB', message: '无法获取当前标签页' } });
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

        const forms = Array.from(document.querySelectorAll('form')).filter((form) => input.includeHidden || isVisible(form)).map((form, formIndex) => {
          const fields = Array.from(form.querySelectorAll('input, textarea, select, button')).filter((el) => input.includeHidden || isVisible(el)).slice(0, input.maxFieldsPerForm).map((el) => ({
            tagName: el.tagName || '',
            type: el.getAttribute?.('type') || '',
            name: el.getAttribute?.('name') || '',
            id: el.id || '',
            placeholder: el.getAttribute?.('placeholder') || '',
            value: el.value ?? '',
            checked: typeof el.checked === 'boolean' ? el.checked : null,
            disabled: Boolean(el.disabled),
            required: Boolean(el.required),
            options: el.tagName === 'SELECT' ? Array.from(el.options || []).slice(0, 20).map((option) => ({
              value: option.value,
              label: normalizeText(option.textContent || option.label || ''),
              selected: Boolean(option.selected)
            })) : []
          }));

          return {
            index: formIndex,
            id: form.id || '',
            name: form.getAttribute?.('name') || '',
            action: form.getAttribute?.('action') || '',
            method: (form.getAttribute?.('method') || 'get').toLowerCase(),
            title: normalizeText(form.getAttribute?.('aria-label') || form.getAttribute?.('title') || ''),
            fields
          };
        });

        return {
          success: true,
          data: {
            count: forms.length,
            forms: forms.slice(0, input.maxForms)
          }
        };
      },
      args: [normalized]
    });

    const successResult = (results || []).map((item) => item.result).find((item) => item?.success);
    if (!successResult) {
      return normalizeToolResult(results?.[0]?.result, { tool: 'extract_forms', fallbackError: '执行失败' });
    }

    const summary = buildExtractFormsSummary({
      count: successResult.data?.count || 0,
      forms: successResult.data?.forms || []
    });

    return createToolSuccessResult({
      tool: 'extract_forms',
      message: summary.message,
      data: summary.data,
      meta: { maxForms: normalized.maxForms, maxFieldsPerForm: normalized.maxFieldsPerForm }
    });
  } catch (error) {
    return createToolErrorResult({ tool: 'extract_forms', error: { code: 'TOOL_ERROR', message: error.message } });
  }
}
