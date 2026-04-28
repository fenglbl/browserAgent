// Tool: click_element
// 点击页面元素
// 支持：CSS / text=文字 / shadow DOM / iframe
// 执行前后自动监听页面异常与页面变化
import { observePageAfterAction, installPageMonitor } from './page_monitor.js';
import { createToolErrorResult, createToolSuccessResult, normalizeToolResult } from './tool_result.js';

export async function clickElement(selector, options = {}) {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab) {
    return createToolErrorResult({ tool: 'click_element', error: '无法获取当前标签页' });
  }

  const observeMs = options.observeMs || 6000;

  try {
    await installPageMonitor(activeTab.id);

    const results = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id, allFrames: true },
      func: (sel) => {
        try {
          function normalizeText(text) {
            return (text || '').replace(/\s+/g, ' ').trim();
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

          function isInteractive(el) {
            if (!el || !el.tagName) return false;
            const tag = el.tagName.toLowerCase();
            if (['a', 'button', 'input', 'select', 'textarea', 'summary', 'option', 'label', 'li'].includes(tag)) return true;
            if (typeof el.click === 'function') return true;
            if (el.onclick) return true;
            if (el.hasAttribute?.('onclick')) return true;
            if (el.hasAttribute?.('tabindex')) return true;
            const role = (el.getAttribute?.('role') || '').toLowerCase();
            if (['button', 'link', 'tab', 'menuitem', 'option'].includes(role)) return true;
            return false;
          }

          function getClickableTarget(el) {
            let current = el;
            let depth = 0;
            while (current && depth < 5) {
              if (isVisible(current) && isInteractive(current)) return current;
              current = current.parentElement;
              depth += 1;
            }
            return el;
          }

          function getTagBonus(el) {
            if (!el?.tagName) return 0;
            const tag = el.tagName.toLowerCase();
            if (tag === 'a' || tag === 'button') return 18;
            if (tag === 'input' || tag === 'textarea') return 14;
            if (tag === 'label') return 10;
            if (tag === 'li') return 4;
            return 0;
          }

          function getAttributeBonus(el) {
            if (!el) return 0;
            let bonus = 0;
            if (el.id) bonus += 6;
            const role = (el.getAttribute?.('role') || '').toLowerCase();
            if (['tab', 'button', 'link', 'menuitem', 'option'].includes(role)) bonus += 10;
            const parentRole = (el.parentElement?.getAttribute?.('role') || '').toLowerCase();
            if (['tablist', 'navigation', 'menu'].includes(parentRole)) bonus += 6;
            const parentTag = el.parentElement?.tagName?.toLowerCase();
            if (['nav', 'menu'].includes(parentTag)) bonus += 6;
            return bonus;
          }

          function pushCandidate(candidates, el, score, matchReason) {
            const clickable = getClickableTarget(el);
            const text = normalizeText(clickable.innerText || clickable.textContent || '');
            candidates.push({
              element: clickable,
              score: score + getTagBonus(clickable) + getAttributeBonus(clickable),
              text,
              id: clickable.id || '',
              tagName: clickable.tagName || '',
              matchReason
            });
          }

          function dedupeCandidates(items) {
            const map = new Map();
            for (const item of items) {
              const key = `${item.tagName}|${item.id}|${item.text}`;
              const existing = map.get(key);
              if (!existing || item.score > existing.score) map.set(key, item);
            }
            return Array.from(map.values()).sort((a, b) => b.score - a.score);
          }

          function findBestByText(raw) {
            const targetText = normalizeText(raw);
            const compactTarget = targetText.toLowerCase();
            const all = collectAllElements(document.documentElement, []);
            const candidates = [];

            for (const el of all) {
              if (!isVisible(el)) continue;
              const fullText = normalizeText(el.innerText || el.textContent || '');
              const attrs = [
                el.getAttribute?.('aria-label'),
                el.getAttribute?.('title'),
                el.getAttribute?.('value'),
                el.getAttribute?.('data-title'),
                el.getAttribute?.('data-name'),
                el.getAttribute?.('placeholder'),
                el.getAttribute?.('name'),
                el.id,
                typeof el.className === 'string' ? el.className : ''
              ].map(normalizeText).filter(Boolean);
              const haystacks = [fullText, ...attrs].map(v => v.toLowerCase());

              if (haystacks.some(v => v === compactTarget)) {
                pushCandidate(candidates, el, 100, 'exact');
              } else if (haystacks.some(v => v.includes(compactTarget))) {
                pushCandidate(candidates, el, 82, 'contains');
              }
            }

            return dedupeCandidates(candidates)[0] || null;
          }

          function resolveBySelector(rawSelector) {
            let element = null;
            let mode = 'css';
            let recoveredFrom = null;
            const trimmed = String(rawSelector || '').trim();

            try {
              element = document.querySelector(trimmed);
            } catch (queryError) {
              if (trimmed.startsWith('#') && trimmed.length > 1) {
                element = document.getElementById(trimmed.slice(1));
                if (element) {
                  mode = 'css-id-fallback';
                  recoveredFrom = 'invalid-id-selector';
                }
              } else {
                return { element: null, mode, recoveredFrom, error: `无效选择器：${trimmed}`, stack: queryError?.stack || null };
              }
            }

            if (!element && trimmed.startsWith('[id="') && trimmed.endsWith('"]')) {
              const rawId = trimmed.slice(5, -2);
              element = document.getElementById(rawId);
              if (element) {
                mode = 'css-id-attr-fallback';
                recoveredFrom = 'id-attr-selector';
              }
            }

            if (element) element = getClickableTarget(element);
            return { element, mode, recoveredFrom, error: null, stack: null };
          }

          function performClick(element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            try { element.focus?.(); } catch {}
            const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
            for (const name of events) {
              try {
                element.dispatchEvent(new MouseEvent(name, { bubbles: true, cancelable: true, view: window }));
              } catch {}
            }
            try {
              element.click();
            } catch {}
          }

          const rawSelector = String(sel || '').trim();
          const textMatch = rawSelector.match(/^text\s*=\s*(.+)$/i);
          let element = null;
          let mode = 'css';
          let recoveredFrom = null;

          if (textMatch) {
            let rawText = textMatch[1].trim();
            if ((rawText.startsWith('"') && rawText.endsWith('"')) || (rawText.startsWith("'") && rawText.endsWith("'"))) {
              rawText = rawText.slice(1, -1);
            }
            const best = findBestByText(rawText);
            element = best?.element || null;
            mode = best ? `text:${best.matchReason}` : 'text';
          } else {
            const resolved = resolveBySelector(rawSelector);
            if (resolved.error) {
              return { success: false, error: { code: 'TOOL_ERROR', message: resolved.error }, data: { stack: resolved.stack || null, selector: sel } };
            }
            element = resolved.element;
            mode = resolved.mode;
            recoveredFrom = resolved.recoveredFrom;
          }

          if (!element || !isVisible(element)) {
            return { success: false, error: { code: 'NOT_FOUND', message: `未找到元素：${rawSelector}` } };
          }

          performClick(element);

          return {
            success: true,
            message: `已点击：${rawSelector}`,
            data: {
              requestedSelector: sel,
              target: rawSelector,
              mode,
              recoveredFrom,
              text: normalizeText(element.innerText || element.textContent || ''),
              tagName: element.tagName,
              className: element.className || '',
              id: element.id || ''
            }
          };
        } catch (error) {
          return {
            success: false,
            error: { code: error?.message?.includes('无效选择器') ? 'INVALID_SELECTOR' : 'TOOL_ERROR', message: error?.message || '页面内点击异常' },
            data: {
              stack: error?.stack || null,
              selector: sel
            }
          };
        }
      },
      args: [selector]
    });

    const successResult = (results || []).map(r => r.result).find(r => r?.success);
    const firstError = (results || []).map(r => r.result).find(r => r && !r.success);
    if (!successResult) {
      return normalizeToolResult(firstError, { tool: 'click_element', fallbackError: '执行失败', data: { rawResults: results || [] } });
    }

    const observation = await observePageAfterAction(activeTab.id, {
      action: 'click_element',
      selector,
      waitMs: observeMs
    });

    return createToolSuccessResult({
      tool: 'click_element',
      message: successResult.message || `已点击：${selector}`,
      data: {
        ...(successResult.data || {}),
        observation: observation?.data || null
      },
      meta: {
        selector,
        observeMs
      }
    });
  } catch (error) {
    return createToolErrorResult({ tool: 'click_element', error: error.message });
  }
}
