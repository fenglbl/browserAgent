// Tool: extract_text
// 提取页面主要内容文本
import { createToolErrorResult, createToolSuccessResult } from './tool_result.js';

export async function extractText(options = {}) {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab) {
    return createToolErrorResult({ tool: 'extract_text', error: { code: 'NO_ACTIVE_TAB', message: '无法获取当前标签页' } });
  }

  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: () => {
        const mainSelectors = ['main', 'article', '[role="main"]', '.content', '#content', '.post', 'article'];
        let mainContent = null;

        for (const selector of mainSelectors) {
          mainContent = document.querySelector(selector);
          if (mainContent) break;
        }

        const target = mainContent || document.body;
        const clone = target.cloneNode(true);
        clone.querySelectorAll('script, style, nav, header, footer, noscript').forEach((el) => el.remove());

        return {
          success: true,
          data: {
            title: document.title,
            url: window.location.href,
            text: clone.innerText,
            length: clone.innerText.length
          }
        };
      }
    });

    const payload = result[0]?.result;
    if (!payload?.success) {
      return createToolErrorResult({ tool: 'extract_text', error: { code: 'EXTRACTION_FAILED', message: '提取失败' } });
    }

    return createToolSuccessResult({
      tool: 'extract_text',
      message: '已提取页面文本',
      data: payload.data,
      meta: {
        title: payload.data?.title || '',
        url: payload.data?.url || '',
        length: payload.data?.length || 0
      }
    });
  } catch (error) {
    return createToolErrorResult({ tool: 'extract_text', error: { code: 'TOOL_ERROR', message: error.message } });
  }
}
