export function normalizeFillFormArgs(options = {}) {
  const maxFields = Number(options.maxFields);
  return {
    maxFields: Number.isFinite(maxFields) && maxFields > 0 ? Math.min(maxFields, 50) : 20
  };
}

export function buildFillFormSummary({ count, fields }) {
  return {
    success: true,
    message: `已识别 ${count} 个可填写字段`,
    data: {
      count,
      fields: Array.isArray(fields) ? fields.slice(0, 20) : []
    }
  };
}
