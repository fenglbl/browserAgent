const ERROR_CODE_BY_MESSAGE = new Map([
  ['无法获取当前标签页', 'NO_ACTIVE_TAB'],
  ['缺少 selector', 'MISSING_SELECTOR'],
  ['缺少 text', 'MISSING_TEXT'],
  ['缺少 attribute', 'MISSING_ATTRIBUTE'],
  ['缺少 filePath', 'MISSING_FILE_PATH'],
  ['缺少 fields', 'MISSING_FIELDS'],
  ['未配置 API', 'MISSING_API_CONFIG'],
  ['提取失败', 'EXTRACTION_FAILED'],
  ['执行失败', 'TOOL_FAILED'],
  ['等待元素超时', 'TIMEOUT'],
  ['等待页面跳转超时', 'TIMEOUT'],
  ['等待文本超时', 'TIMEOUT'],
  ['等待 URL 变化超时', 'TIMEOUT'],
  ['等待网络空闲超时', 'TIMEOUT'],
  ['总结请求失败', 'API_REQUEST_FAILED'],
  ['模型未返回总结内容', 'EMPTY_MODEL_RESPONSE']
]);

function normalizeErrorInput(error) {
  if (error && typeof error === 'object') {
    const message = String(error.message || error.error || '执行失败');
    const code = String(
      error.code ||
      ERROR_CODE_BY_MESSAGE.get(message) ||
      [...ERROR_CODE_BY_MESSAGE.entries()].find(([key]) => message.includes(key))?.[1] ||
      (message.includes('超时') ? 'TIMEOUT' : 'TOOL_ERROR')
    );
    return { code, kind: 'error', message };
  }

  const message = String(error || '执行失败');
  const code = ERROR_CODE_BY_MESSAGE.get(message) || [...ERROR_CODE_BY_MESSAGE.entries()].find(([key]) => message.includes(key))?.[1] || (message.includes('超时') ? 'TIMEOUT' : 'TOOL_ERROR');
  return { code, kind: 'error', message };
}

export function normalizeToolError(error) {
  return normalizeErrorInput(error);
}

export function createToolSuccessResult({ tool = '', message = '', data = {}, meta = {} } = {}) {
  return {
    success: true,
    tool,
    message,
    data,
    error: null,
    code: 'OK',
    kind: 'success',
    meta
  };
}

export function createToolErrorResult({ tool = '', error = '执行失败', data = {}, meta = {}, message = '' } = {}) {
  const normalizedError = normalizeErrorInput(error);
  const errorPayload = error && typeof error === 'object'
    ? { code: normalizedError.code, message: normalizedError.message }
    : normalizedError.message;

  return {
    success: false,
    tool,
    message,
    data,
    error: errorPayload,
    code: normalizedError.code,
    kind: normalizedError.kind,
    meta
  };
}

export function normalizeToolResult(result, { tool = '', fallbackError = '执行失败', data = {}, meta = {}, message = '' } = {}) {
  if (!result) {
    return createToolErrorResult({ tool, error: fallbackError, data, meta, message });
  }

  if (result.success === false) {
    return createToolErrorResult({
      tool: result.tool || tool,
      error: result.error ?? fallbackError,
      data: result.data ?? data,
      meta: result.meta ?? meta,
      message: result.message ?? message
    });
  }

  return result;
}
