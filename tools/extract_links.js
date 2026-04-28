import { createToolErrorResult, createToolSuccessResult, normalizeToolResult } from './tool_result.js';
import { buildExtractLinksSummary, normalizeExtractLinksArgs } from './extract_links_core.js';

export async function extractLinks(options = {}) {
  const normalized = normalizeExtractLinksArgs(options);

  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) {
      return createToolErrorResult({ tool: 'extract_links', error: '无法获取当前标签页' });
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

        const links = Array.from(document.querySelectorAll('a[href]')).filter(isVisible).map((el) => {
          const href = el.href || el.getAttribute('href') || '';
          return {
            text: normalizeText(el.innerText || el.textContent || el.getAttribute('aria-label') || ''),
            href,
            target: el.getAttribute('target') || '',
            id: el.id || '',
            tagName: el.tagName || ''
          };
        });

        return {
          success: true,
          data: {
            count: links.length,
            links: links.slice(0, input.maxLinks)
          }
        };
      },
      args: [normalized]
    });

    const successResult = (results || []).map((item) => item.result).find((item) => item?.success);
    if (!successResult) {
      return normalizeToolResult(results?.[0]?.result, { tool: 'extract_links', fallbackError: '执行失败' });
    }

    const summary = buildExtractLinksSummary({
      count: successResult.data?.count || 0,
      links: successResult.data?.links || []
    });

    return createToolSuccessResult({
      tool: 'extract_links',
      message: summary.message,
      data: summary.data,
      meta: { maxLinks: normalized.maxLinks }
    });
  } catch (error) {
    return createToolErrorResult({ tool: 'extract_links', error: error.message });
  }
}
