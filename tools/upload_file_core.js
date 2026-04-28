export function normalizeUploadFileArgs(options = {}) {
  return {
    selector: String(options.selector || '').trim(),
    filePath: String(options.filePath || '').trim(),
    observeMs: Number.isFinite(Number(options.observeMs)) && Number(options.observeMs) > 0 ? Math.min(Number(options.observeMs), 5000) : 1000
  };
}

export function buildUploadFileSummary({ selector, filePath, tagName, id, observation }) {
  return {
    success: true,
    message: `已上传文件：${filePath}`,
    data: {
      selector,
      filePath,
      tagName,
      id,
      observation: observation || null
    }
  };
}
