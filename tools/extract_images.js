import { createToolErrorResult, createToolSuccessResult, normalizeToolResult } from './tool_result.js';
import { buildExtractImagesSummary, normalizeExtractImagesArgs } from './extract_images_core.js';

export async function extractImages(options = {}) {
  const normalized = normalizeExtractImagesArgs(options);

  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) {
      return createToolErrorResult({ tool: 'extract_images', error: { code: 'NO_ACTIVE_TAB', message: '无法获取当前标签页' } });
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

        const images = Array.from(document.querySelectorAll('img')).filter(isVisible).map((img) => ({
          src: img.currentSrc || img.src || '',
          alt: img.alt || '',
          width: img.naturalWidth || img.width || 0,
          height: img.naturalHeight || img.height || 0,
          id: img.id || ''
        }));

        if (input.includeBackgroundImages) {
          const nodes = Array.from(document.querySelectorAll('*')).filter(isVisible);
          for (const el of nodes) {
            const bg = window.getComputedStyle(el).backgroundImage || '';
            const match = bg.match(/url\(["']?(.*?)["']?\)/i);
            if (match?.[1]) {
              images.push({
                src: match[1],
                alt: '',
                width: 0,
                height: 0,
                id: el.id || ''
              });
            }
          }
        }

        return {
          success: true,
          data: {
            count: images.length,
            images: images.slice(0, input.maxImages)
          }
        };
      },
      args: [normalized]
    });

    const successResult = (results || []).map((item) => item.result).find((item) => item?.success);
    if (!successResult) {
      return normalizeToolResult(results?.[0]?.result, { tool: 'extract_images', fallbackError: '执行失败' });
    }

    const summary = buildExtractImagesSummary({
      count: successResult.data?.count || 0,
      images: successResult.data?.images || []
    });

    return createToolSuccessResult({
      tool: 'extract_images',
      message: summary.message,
      data: summary.data,
      meta: { maxImages: normalized.maxImages, includeBackgroundImages: normalized.includeBackgroundImages }
    });
  } catch (error) {
    return createToolErrorResult({ tool: 'extract_images', error: { code: 'TOOL_ERROR', message: error.message } });
  }
}
