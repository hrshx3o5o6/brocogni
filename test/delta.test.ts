import { test } from "node:test";
import * as assert from "node:assert";
import { computeDelta } from "../src/runtime/delta.js";
import type { SemanticPageState, SemanticNode } from "../src/types/schema.js";

function createMockNode(id: string, name: string, visible = true, expanded = "false"): SemanticNode {
  return {
    id,
    role: "button",
    name,
    visible,
    enabled: true,
    confidence: 1.0,
    attributes: { backendDOMNodeId: id, expanded },
    inShadowTree: false,
    source: "ax",
    selectors: []
  };
}

test("computeDelta accurately identifies added, removed, and modified nodes", () => {
  const nodeA = createMockNode("1", "Submit");
  const nodeB = createMockNode("2", "Cancel");
  const nodeC = createMockNode("3", "Dropdown", true, "false");

  const oldState: SemanticPageState = {
    summary: { url: "", title: "", capturedAt: "", nodeCount: 3, actionableCount: 3 },
    nodes: [nodeA, nodeB, nodeC]
  };

  // Modify nodeC (expand it)
  const nodeCModified = createMockNode("3", "Dropdown", true, "true");
  
  // Add nodeD
  const nodeD = createMockNode("4", "Dropdown Item 1");

  // Remove nodeA
  
  const newState: SemanticPageState = {
    summary: { url: "", title: "", capturedAt: "", nodeCount: 3, actionableCount: 3 },
    nodes: [nodeB, nodeCModified, nodeD]
  };

  const delta = computeDelta(oldState, newState);

  assert.strictEqual(delta.added.length, 1);
  assert.strictEqual(delta.added[0].id, "4");

  assert.strictEqual(delta.removed.length, 1);
  assert.strictEqual(delta.removed[0].id, "1");

  assert.strictEqual(delta.modified.length, 1);
  assert.strictEqual(delta.modified[0].id, "3");
  assert.strictEqual(delta.modified[0].attributes.expanded, "true");
});
