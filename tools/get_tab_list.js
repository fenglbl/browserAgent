// Tool: get_tab_list
// 获取所有标签页列表
import { createToolErrorResult, createToolSuccessResult } from './tool_result.js';

export async function getTabList(options = {}) {
  try {
    const tabs = await chrome.tabs.query({});

    const tabList = tabs.map((tab) => ({
      id: tab.id,
      title: tab.title,
      url: tab.url,
      active: tab.active,
      windowId: tab.windowId
    }));

    return createToolSuccessResult({
      tool: 'get_tab_list',
      message: `共 ${tabList.length} 个标签页`,
      data: {
        count: tabList.length,
        tabs: tabList
      },
      meta: {
        count: tabList.length
      }
    });
  } catch (error) {
    return createToolErrorResult({ tool: 'get_tab_list', error: { code: 'TOOL_ERROR', message: error.message } });
  }
}
