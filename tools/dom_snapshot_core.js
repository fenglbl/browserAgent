export function normalizeDomSnapshotArgs(options = {}) {
  const maxDepth = Number(options.maxDepth);
  const maxNodes = Number(options.maxNodes);
  return {
    maxDepth: Number.isFinite(maxDepth) && maxDepth > 0 ? Math.min(maxDepth, 8) : 4,
    maxNodes: Number.isFinite(maxNodes) && maxNodes > 0 ? Math.min(maxNodes, 200) : 80
  };
}

export function buildDomSnapshotSummary({ maxDepth, maxNodes, nodes, rootTitle }) {
  return {
    success: true,
    message: '已生成 DOM 快照',
    data: {
      maxDepth,
      maxNodes,
      rootTitle,
      nodes: Array.isArray(nodes) ? nodes.slice(0, 100) : []
    }
  };
}
