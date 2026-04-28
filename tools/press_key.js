import { observePageAfterAction, installPageMonitor } from './page_monitor.js';
import {
  buildPressKeySummary,
  normalizePressKeyArgs,
  resolveKeyDefinition
} from './press_key_core.js';
import { createToolErrorResult, createToolSuccessResult, normalizeToolResult } from './tool_result.js';

export async function pressKey(key, options = {}) {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab) {
    return createToolErrorResult({ tool: 'press_key', error: '无法获取当前标签页' });
  }

  const normalized = normalizePressKeyArgs({ key, ...options });
  const resolved = resolveKeyDefinition(normalized.key);
  if (!resolved) {
    return createToolErrorResult({ tool: 'press_key', error: `暂不支持按键：${key}` });
  }

  try {
    await installPageMonitor(activeTab.id);

    const results = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id, allFrames: true },
      func: (selector, keyDef) => {
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
            const all = Array.from(document.querySelectorAll('input, textarea, button, a, [role="button"], [tabindex]'));
            return all.find((el) => {
              if (!isVisible(el)) return false;
              const text = normalizeText(el.innerText || el.textContent || el.getAttribute?.('aria-label') || el.getAttribute?.('placeholder') || '');
              return text.toLowerCase().includes(target);
            }) || null;
          }

          let element = document.activeElement || document.body;
          if (selector) {
            const textMatch = String(selector).trim().match(/^text\s*=\s*(.+)$/i);
            if (textMatch) {
              element = findByText(textMatch[1].trim()) || element;
            } else {
              try {
                element = document.querySelector(selector) || element;
              } catch {
                return { success: false, error: `无效选择器：${selector}` };
              }
            }
          }

          if (!element) {
            return { success: false, error: '未找到可按键目标' };
          }

          element.focus?.();
          const eventInit = {
            key: keyDef.key,
            code: keyDef.code,
            keyCode: keyDef.keyCode,
            which: keyDef.keyCode,
            bubbles: true,
            cancelable: true
          };

          element.dispatchEvent(new KeyboardEvent('keydown', eventInit));
          element.dispatchEvent(new KeyboardEvent('keypress', eventInit));
          element.dispatchEvent(new KeyboardEvent('keyup', eventInit));

          if ((keyDef.key === 'Enter' || keyDef.key === 'Escape') && typeof element.click === 'function' && element.tagName === 'BUTTON') {
            try { element.click(); } catch {}
          }

          return {
            success: true,
            data: {
              tagName: element.tagName || '',
              id: element.id || ''
            }
          };
        } catch (error) {
          return { success: false, error: error?.message || '页面内按键异常' };
        }
      },
      args: [normalized.selector, resolved]
    });

    const successResult = (results || []).map((item) => item.result).find((item) => item?.success);
    const firstError = (results || []).map((item) => item.result).find((item) => item && !item.success);
    if (!successResult) {
      return normalizeToolResult(firstError, { tool: 'press_key', fallbackError: '执行失败' });
    }

    const observation = await observePageAfterAction(activeTab.id, {
      action: 'press_key',
      selector: normalized.selector || normalized.key,
      waitMs: normalized.observeMs
    });

    const summary = buildPressKeySummary({
      key: normalized.key,
      selector: normalized.selector,
      tagName: successResult.data?.tagName || '',
      id: successResult.data?.id || '',
      observation: observation?.data || null
    });
    return createToolSuccessResult({
      tool: 'press_key',
      message: summary.message,
      data: summary.data,
      meta: { observeMs: normalized.observeMs }
    });
  } catch (error) {
    return createToolErrorResult({ tool: 'press_key', error: error.message });
  }
}
