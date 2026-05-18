import type { BoundingBox, DomGeometry, SemanticNode } from "../types/schema.js";

function toBbox(rect: unknown): BoundingBox | undefined {
  if (!Array.isArray(rect) || rect.length < 4) return undefined;
  const [x, y, width, height] = rect;
  if ([x, y, width, height].some((v) => typeof v !== "number")) return undefined;
  if (width <= 0 || height <= 0) return undefined;
  return { x, y, width, height };
}

export function extractDomGeometry(domSnapshot: any): DomGeometry[] {
  const out: DomGeometry[] = [];
  const documents = Array.isArray(domSnapshot?.documents) ? domSnapshot.documents : [];

  for (const doc of documents) {
    const node = doc?.nodes;
    const layout = doc?.layout;
    const nodeBackendIds: number[] | undefined = node?.backendNodeId;
    const layoutNodeIdx: number[] | undefined = layout?.nodeIndex;
    const bounds: unknown[] | undefined = layout?.bounds;

    if (!Array.isArray(nodeBackendIds) || !Array.isArray(layoutNodeIdx) || !Array.isArray(bounds)) {
      continue;
    }

    for (let i = 0; i < layoutNodeIdx.length; i += 1) {
      const nIdx = layoutNodeIdx[i];
      const backendNodeId = typeof nIdx === "number" ? nodeBackendIds[nIdx] : undefined;
      if (typeof backendNodeId !== "number") continue;

      const bbox = toBbox(bounds[i]);
      if (!bbox) continue;
      out.push({ backendNodeId, bbox });
    }
  }

  return out;
}

export function fuseAxWithDomGeometry(nodes: SemanticNode[], domGeometry: DomGeometry[]): SemanticNode[] {
  const geometryByBackend = new Map<number, BoundingBox>();
  for (const g of domGeometry) geometryByBackend.set(g.backendNodeId, g.bbox);

  return nodes.map((node) => {
    const backendIdRaw = node.attributes.backendDOMNodeId;
    const backendId = backendIdRaw ? Number(backendIdRaw) : Number.NaN;

    if (!Number.isFinite(backendId)) return node;
    const bbox = geometryByBackend.get(backendId);
    if (!bbox) return node;

    return {
      ...node,
      bbox,
      source: "fused"
    };
  });
}
