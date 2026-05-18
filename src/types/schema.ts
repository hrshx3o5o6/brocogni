export type SelectorKind = "aria" | "css" | "xpath";

export interface SelectorCandidate {
  kind: SelectorKind;
  value: string;
  score: number;
  reason?: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SemanticNode {
  id: string;
  role: string;
  name?: string;
  purpose?: string;
  visible: boolean;
  enabled: boolean;
  confidence: number;
  bbox?: BoundingBox;
  selectors: SelectorCandidate[];
  attributes: Record<string, string>;
  frameId?: string;
  source: "ax" | "dom" | "fused";
}

export interface PageSummary {
  url: string;
  title: string;
  capturedAt: string;
  nodeCount: number;
  actionableCount: number;
}

export interface SemanticPageState {
  summary: PageSummary;
  nodes: SemanticNode[];
}

export interface DomGeometry {
  backendNodeId: number;
  bbox: BoundingBox;
}

export interface RawCapture {
  domSnapshot: unknown;
  axTree: unknown;
}
