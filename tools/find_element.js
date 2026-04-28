// Tool: find_element
// 基于共享定位器返回候选元素列表，供 click/type 后续直接消费。
import { locateDomCandidatesInPage } from './dom_locator.js';
import { createToolErrorResult, createToolSuccessResult } from './tool_result.js';

export async function findElement(selectorOrText, options = {}) {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab) {
    return createToolErrorResult({ tool: 'find_element', error: '无法获取当前标签页' });
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id, allFrames: true },
      func: locateDomCandidatesInPage,
      args: [selectorOrText]
    });

    const merged = [];
    const debugList = [];

    for (const item of results || []) {
      if (item?.result?.data?.debug) debugList.push(item.result.data.debug);
      if (item?.result?.success && item.result.data?.candidates?.length) {
        merged.push(...item.result.data.candidates);
      }
    }

    const deduped = [];
    const seen = new Set();
    for (const candidate of merged.sort((a, b) => b.score - a.score)) {
      const key = `${candidate.tagName}|${candidate.id}|${candidate.path}|${candidate.selectorHint}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(candidate);
      if (deduped.length >= 10) break;
    }

    const bestCandidate = deduped[0] || null;

    return createToolSuccessResult({
      tool: 'find_element',
      message: deduped.length ? `找到 ${deduped.length} 个候选元素` : '未找到候选元素',
      data: {
        count: deduped.length,
        bestCandidate,
        preferredClickSelector: bestCandidate?.preferredClickSelector || null,
        preferredTypeSelector: bestCandidate?.preferredTypeSelector || null,
        candidates: deduped,
        debug: debugList.slice(0, 10)
      },
      meta: {
        query: selectorOrText,
        totalMergedCandidates: merged.length
      }
    });
  } catch (error) {
    return createToolErrorResult({ tool: 'find_element', error: error.message });
  }
}
