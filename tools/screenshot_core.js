export function normalizeScreenshotArgs(options = {}) {
  const format = String(options.format || 'png').trim().toLowerCase() === 'jpeg' ? 'jpeg' : 'png';
  const quality = Number(options.quality);

  return {
    format,
    quality: Number.isFinite(quality) ? Math.min(Math.max(Math.round(quality), 1), 100) : 90,
    fullPage: false
  };
}

export function buildScreenshotSummary({ format, dataUrl, sizeBytes, widthHint, heightHint }) {
  return {
    success: true,
    message: '已截取页面截图',
    data: {
      format,
      dataUrl,
      sizeBytes,
      widthHint,
      heightHint
    }
  };
}
