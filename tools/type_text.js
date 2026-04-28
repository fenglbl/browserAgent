// Tool: type_text
// 在输入框填入文字
// 支持 CSS 选择器 / text=文字，支持 shadow DOM / iframe
// 执行前后自动监听页面异常与页面变化
import { observePageAfterAction, installPageMonitor } from './page_monitor.js';
import { createToolErrorResult, createToolSuccessResult, normalizeToolResult } from './tool_result.js';

export async function typeText(selector, text, options = {}) {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab) {
    return createToolErrorResult({ tool: 'type_text', error: '无法获取当前标签页' });
  }

  const observeMs = options.observeMs || 6000;

  try {
    await installPageMonitor(activeTab.id);

    const results = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id, allFrames: true },
      func: (sel, txt) => {
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

          function collectAllElements(root, out = []) {
            if (!root) return out;
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
            let node = walker.currentNode;
            while (node) {
              out.push(node);
              if (node.shadowRoot) collectAllElements(node.shadowRoot, out);
              node = walker.nextNode();
            }
            return out;
          }

          function isInputLike(el) {
            return Boolean(el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable));
          }

          function getInputTarget(el) {
            let current = el;
            let depth = 0;
            while (current && depth < 5) {
              if (isVisible(current) && isInputLike(current)) return current;
              current = current.parentElement;
              depth += 1;
            }
            return el;
          }

          function findInputByText(raw) {
            const target = normalizeText(raw).toLowerCase();
            const all = collectAllElements(document.documentElement, []);
            const candidates = [];

            for (const el of all) {
              if (!isVisible(el)) continue;
              const input = getInputTarget(el);
              if (!isInputLike(input)) continue;
              const attrs = [
                input.getAttribute?.('placeholder'),
                input.getAttribute?.('aria-label'),
                input.getAttribute?.('title'),
                input.getAttribute?.('name'),
                input.id,
                typeof input.className === 'string' ? input.className : ''
              ].map(normalizeText).filter(Boolean);
              const text = normalizeText(input.innerText || input.textContent || '');
              const haystacks = [text, ...attrs].map(v => v.toLowerCase());
              let score = 0;
              if (haystacks.some(v => v === target)) score = 100;
              else if (haystacks.some(v => v.includes(target))) score = 82;
              if (score > 0) candidates.push({ element: input, score });
            }

            candidates.sort((a, b) => b.score - a.score);
            return candidates[0]?.element || null;
          }

          let element = null;
          const rawSelector = String(sel || '').trim();
          const textMatch = rawSelector.match(/^text\s*=\s*(.+)$/i);

          if (textMatch) {
            let rawText = textMatch[1].trim();
            if ((rawText.startsWith('"') && rawText.endsWith('"')) || (rawText.startsWith("'") && rawText.endsWith("'"))) {
              rawText = rawText.slice(1, -1);
            }
            element = findInputByText(rawText);
          } else {
            try {
              element = document.querySelector(rawSelector);
            } catch (queryError) {
              if (rawSelector.startsWith('#') && rawSelector.length > 1) {
                element = document.getElementById(rawSelector.slice(1));
              } else {
                return { success: false, error: { code: 'INVALID_SELECTOR', message: `无效选择器：${rawSelector}` }, data: { stack: queryError?.stack || null } };
              }
            }

            if (!element && rawSelector.startsWith('[id="') && rawSelector.endsWith('"]')) {
              const rawId = rawSelector.slice(5, -2);
              element = document.getElementById(rawId);
            }

            if (element) element = getInputTarget(element);
          }

          if (!element || !isVisible(element)) {
            return { success: false, error: { code: 'NOT_FOUND', message: `未找到元素：${rawSelector}` } };
          }

          element.focus();
          if ('value' in element) {
            element.value = txt;
          } else if (element.isContentEditable) {
            element.innerText = txt;
          } else {
            return { success: false, error: { code: 'UNSUPPORTED_TARGET', message: `元素不支持输入：${rawSelector}` } };
          }

          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));

          return {
            success: true,
            message: `已输入：${txt}`,
            data: {
              requestedSelector: sel,
              target: rawSelector,
              textLength: String(txt || '').length,
              tagName: element.tagName,
              id: element.id || '',
              className: element.className || ''
            }
          };
        } catch (error) {
          return {
            success: false,
            error: { code: error?.message?.includes('无效选择器') ? 'INVALID_SELECTOR' : 'TOOL_ERROR', message: error?.message || '页面内输入异常' },
            data: {
              stack: error?.stack || null,
              selector: sel
            }
          };
        }
      },
      args: [selector, text]
    });

    const successResult = (results || []).map(r => r.result).find(r => r?.success);
    const firstError = (results || []).map(r => r.result).find(r => r && !r.success);
    if (!successResult) {
      return normalizeToolResult(firstError, { tool: 'type_text', fallbackError: '执行失败', data: { rawResults: results || [] } });
    }

    const observation = await observePageAfterAction(activeTab.id, {
      action: 'type_text',
      selector,
      waitMs: observeMs
    });

    return createToolSuccessResult({
      tool: 'type_text',
      message: successResult.message || `已输入：${text}`,
      data: {
        ...(successResult.data || {}),
        observation: observation?.data || null
      },
      meta: {
        selector,
        observeMs,
        textLength: String(text || '').length
      }
    });
  } catch (error) {
    return createToolErrorResult({ tool: 'type_text', error: error.message });
  }
}
