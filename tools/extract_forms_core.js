export function normalizeExtractFormsArgs(options = {}) {
  const maxForms = Number(options.maxForms);
  const maxFieldsPerForm = Number(options.maxFieldsPerForm);
  return {
    includeHidden: Boolean(options.includeHidden),
    maxForms: Number.isFinite(maxForms) && maxForms > 0 ? Math.min(maxForms, 20) : 5,
    maxFieldsPerForm: Number.isFinite(maxFieldsPerForm) && maxFieldsPerForm > 0 ? Math.min(maxFieldsPerForm, 50) : 20
  };
}

export function buildExtractFormsSummary({ count, forms }) {
  return {
    success: true,
    message: `已提取 ${count} 个表单`,
    data: {
      count,
      forms: Array.isArray(forms) ? forms.slice(0, 10) : []
    }
  };
}
