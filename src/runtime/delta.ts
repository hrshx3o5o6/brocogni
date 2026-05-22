import type { SemanticNode, SemanticPageState } from "../types/schema.js";

function isNodeModified(oldNode: SemanticNode, newNode: SemanticNode): boolean {
  if (oldNode.visible !== newNode.visible) return true;
  if (oldNode.enabled !== newNode.enabled) return true;
  
  // Check attributes
  const oldKeys = Object.keys(oldNode.attributes);
  const newKeys = Object.keys(newNode.attributes);
  if (oldKeys.length !== newKeys.length) return true;
  for (const k of oldKeys) {
    if (oldNode.attributes[k] !== newNode.attributes[k]) return true;
  }

  // Check bbox
  if (!!oldNode.bbox !== !!newNode.bbox) return true;
  if (oldNode.bbox && newNode.bbox) {
    if (
      oldNode.bbox.x !== newNode.bbox.x ||
      oldNode.bbox.y !== newNode.bbox.y ||
      oldNode.bbox.width !== newNode.bbox.width ||
      oldNode.bbox.height !== newNode.bbox.height
    ) {
      return true;
    }
  }

  return false;
}

function getNodeKey(node: SemanticNode): string {
  return node.attributes.backendDOMNodeId ? `backend_${node.attributes.backendDOMNodeId}` : `id_${node.id}`;
}

export function computeDelta(oldState: SemanticPageState, newState: SemanticPageState) {
  const oldMap = new Map<string, SemanticNode>();
  for (const node of oldState.nodes) {
    oldMap.set(getNodeKey(node), node);
  }

  const added: SemanticNode[] = [];
  const modified: SemanticNode[] = [];
  const seenKeys = new Set<string>();

  for (const newNode of newState.nodes) {
    const key = getNodeKey(newNode);
    seenKeys.add(key);

    const oldNode = oldMap.get(key);
    if (!oldNode) {
      added.push(newNode);
    } else {
      if (isNodeModified(oldNode, newNode)) {
        modified.push(newNode);
      }
    }
  }

  const removed: SemanticNode[] = [];
  for (const [key, oldNode] of oldMap.entries()) {
    if (!seenKeys.has(key)) {
      removed.push(oldNode);
    }
  }

  return { added, removed, modified };
}
