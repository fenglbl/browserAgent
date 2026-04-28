import { buildScreenshotSummary, normalizeScreenshotArgs } from './screenshot_core.js';
import { createToolErrorResult, createToolSuccessResult } from './tool_result.js';

function estimateDataUrlSize(dataUrl) {
  const base64 = String(dataUrl || '').split(',')[1] || '';
  return Math.floor((base64.length * 3) / 4);
}

export async function screenshot(options = {}) {
  const normalized = normalizeScreenshotArgs(options);

  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(undefined, {
      format: normalized.format,
      quality: normalized.format === 'jpeg' ? normalized.quality : undefined
    });

    const summary = buildScreenshotSummary({
      format: normalized.format,
      dataUrl,
      sizeBytes: estimateDataUrlSize(dataUrl),
      widthHint: null,
      heightHint: null
    });
    return createToolSuccessResult({
      tool: 'screenshot',
      message: summary.message,
      data: summary.data,
      meta: { format: normalized.format, quality: normalized.quality, fullPage: normalized.fullPage }
    });
  } catch (error) {
    return createToolErrorResult({ tool: 'screenshot', error: error.message });
  }
}
