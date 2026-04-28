// Tool: open_url
// 打开新标签页或跳转，并在操作后观察页面状态
import { observePageAfterAction } from './page_monitor.js';
import { createToolErrorResult, createToolSuccessResult } from './tool_result.js';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function openUrl(url, options = {}) {
  const { newTab = true, observeMs = 6000 } = options;

  try {
    let tabId = null;

    if (newTab) {
      const tab = await chrome.tabs.create({ url });
      tabId = tab.id;
      await sleep(1500);
    } else {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab) {
        return createToolErrorResult({ tool: 'open_url', error: '无法获取当前标签页' });
      }
      await chrome.tabs.update(activeTab.id, { url });
      tabId = activeTab.id;
      await sleep(1500);
    }

    const observation = await observePageAfterAction(tabId, { action: 'open_url', selector: url, waitMs: observeMs });

    return createToolSuccessResult({
      tool: 'open_url',
      message: newTab ? `已在新标签页打开: ${url}` : `已跳转到：${url}`,
      data: {
        tabId,
        observation: observation?.data || null
      },
      meta: {
        newTab,
        observeMs,
        url
      }
    });
  } catch (error) {
    return createToolErrorResult({ tool: 'open_url', error: error.message });
  }
}
