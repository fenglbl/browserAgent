export function normalizeExtractImagesArgs(options = {}) {
  const maxImages = Number(options.maxImages);
  return {
    maxImages: Number.isFinite(maxImages) && maxImages > 0 ? Math.min(maxImages, 50) : 20,
    includeBackgroundImages: Boolean(options.includeBackgroundImages)
  };
}

export function buildExtractImagesSummary({ count, images }) {
  return {
    success: true,
    message: `已提取 ${count} 张图片`,
    data: {
      count,
      images: Array.isArray(images) ? images.slice(0, 20) : []
    }
  };
}
