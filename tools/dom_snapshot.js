import { createToolErrorResult, createToolSuccessResult, normalizeToolResult } from './tool_result.js';
import { buildDomSnapshotSummary, normalizeDomSnapshotArgs } from './dom_snapshot_core.js';

function sanitizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 160);
}

export async function domSnapshot(options = {}) {
  const normalized = normalizeDomSnapshotArgs(options);

  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) {
      return createToolErrorResult({ tool: 'dom_snapshot', error: '无法获取当前标签页' });
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id, allFrames: true },
      func: (input) => {
        function isVisible(el) {
          if (!el) return false;
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        }

        const nodes = [];
        const visited = new Set();

        function walk(root, depth) {
          if (!root || depth > input.maxDepth || nodes.length >= input.maxNodes) return;
          const children = root.children ? Array.from(root.children) : [];
          for (const el of children) {
            if (nodes.length >= input.maxNodes) return;
            if (visited.has(el)) continue;
            visited.add(el);
            if (!isVisible(el)) continue;
            nodes.push({
              depth,
              tagName: el.tagName || '',
              id: el.id || '',
              text: String(el.innerText || el.textContent || el.getAttribute?.('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 120),
              role: el.getAttribute?.('role') || '',
              name: el.getAttribute?.('name') || ''
            });
            if (el.shadowRoot) walk(el.shadowRoot, depth + 1);
            walk(el, depth + 1);
          }
        }

        walk(document.body || document.documentElement, 0);

        return {
          success: true,
          data: {
            rootTitle: document.title || '',
            nodes
          }
        };
      },
      args: [normalized]
    });

    const successResult = (results || []).map((item) => item.result).find((item) => item?.success);
    if (!successResult) {
      return normalizeToolResult(results?.[0]?.result, { tool: 'dom_snapshot', fallbackError: '执行失败' });
    }

    const summary = buildDomSnapshotSummary({
      maxDepth: normalized.maxDepth,
      maxNodes: normalized.maxNodes,
      nodes: successResult.data?.nodes || [],
      rootTitle: successResult.data?.rootTitle || ''
    });

    return createToolSuccessResult({
      tool: 'dom_snapshot',
      message: summary.message,
      data: summary.data,
      meta: { maxDepth: normalized.maxDepth, maxNodes: normalized.maxNodes }
    });
  } catch (error) {
    return createToolErrorResult({ tool: 'dom_snapshot', error: error.message });
  }
}
