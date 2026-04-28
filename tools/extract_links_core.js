export function normalizeExtractLinksArgs(options = {}) {
  const maxLinks = Number(options.maxLinks);
  return {
    includeExternal: Boolean(options.includeExternal),
    maxLinks: Number.isFinite(maxLinks) && maxLinks > 0 ? Math.min(maxLinks, 100) : 20
  };
}

export function buildExtractLinksSummary({ count, links }) {
  return {
    success: true,
    message: `已提取 ${count} 个链接`,
    data: {
      count,
      links: Array.isArray(links) ? links.slice(0, 20) : []
    }
  };
}
