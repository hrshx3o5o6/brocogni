import assert from "node:assert/strict";
import { test } from "node:test";

import { axToSemanticNodes } from "../src/semantic/infer.js";
import { extractDomGeometry, fuseAxWithDomGeometry } from "../src/semantic/fuse.js";
import { BrowserCognitionService } from "../src/runtime/service.js";
import type { SemanticPageState } from "../src/types/schema.js";

test("axToSemanticNodes extracts actionable semantics and selector candidates", () => {
  const axTree = {
    nodes: [
      {
        nodeId: "11",
        frameId: "main-frame",
        backendDOMNodeId: 101,
        role: { value: "button" },
        name: { value: "Submit" },
        properties: []
      },
      {
        nodeId: "12",
        backendDOMNodeId: 102,
        role: { value: "textbox" },
        name: { value: "Search" },
        properties: [{ name: "disabled", value: { value: true } }]
      },
      {
        nodeId: "13",
        role: { value: "StaticText" },
        name: { value: "Ignore me" },
        properties: []
      }
    ]
  };

  const nodes = axToSemanticNodes(axTree);
  assert.equal(nodes.length, 2);

  const submit = nodes.find((n) => n.name === "Submit");
  assert.ok(submit);
  assert.equal(submit.role, "button");
  assert.equal(submit.purpose, "form_submission");
  assert.equal(submit.enabled, true);
  assert.equal(submit.source, "ax");
  assert.equal(submit.frameId, "main-frame");
  assert.ok(submit.selectors.length > 0);

  const search = nodes.find((n) => n.name === "Search");
  assert.ok(search);
  assert.equal(search.role, "textbox");
  assert.equal(search.purpose, "search_input");
  assert.equal(search.enabled, false);
});

test("dom geometry is extracted and fused into semantic nodes", () => {
  const domSnapshot = {
    documents: [
      {
        nodes: {
          backendNodeId: [101, 102]
        },
        layout: {
          nodeIndex: [0],
          bounds: [[10, 20, 120, 40]]
        }
      }
    ]
  };

  const geometry = extractDomGeometry(domSnapshot);
  assert.equal(geometry.length, 1);
  assert.equal(geometry[0].backendNodeId, 101);

  const fused = fuseAxWithDomGeometry(
    [
      {
        id: "11",
        role: "button",
        name: "Submit",
        purpose: "form_submission",
        visible: true,
        enabled: true,
        confidence: 0.8,
        selectors: [],
        attributes: { backendDOMNodeId: "101" },
        source: "ax"
      }
    ],
    geometry
  );

  assert.equal(fused[0].source, "fused");
  assert.deepEqual(fused[0].bbox, { x: 10, y: 20, width: 120, height: 40 });
});

test("service contracts provide deterministic target and selector planning", () => {
  const service = new BrowserCognitionService();

  const state: SemanticPageState = {
    summary: {
      url: "https://example.test",
      title: "Example",
      capturedAt: new Date(0).toISOString(),
      nodeCount: 2,
      actionableCount: 1
    },
    nodes: [
      {
        id: "n1",
        role: "button",
        name: "Submit",
        purpose: "form_submission",
        visible: true,
        enabled: true,
        confidence: 0.9,
        selectors: [
          { kind: "aria", value: "role=button[name='Submit']", score: 0.9, reason: "best" },
          { kind: "xpath", value: "//button[text()='Submit']", score: 0.5, reason: "fallback" }
        ],
        attributes: {},
        source: "fused"
      },
      {
        id: "n2",
        role: "textbox",
        name: "Search",
        purpose: "search_input",
        visible: true,
        enabled: false,
        confidence: 0.8,
        selectors: [],
        attributes: {},
        source: "ax"
      }
    ]
  };

  const found = service.findTargetsTool(state, { role: "button", onlyEnabled: true });
  assert.equal(found.count, 1);
  assert.equal(found.matches[0].id, "n1");

  const plan = service.getSelectorPlan(state, "n1");
  assert.ok(plan);
  assert.equal(plan.nodeId, "n1");
  assert.equal(plan.selectors.length, 2);
  assert.deepEqual(plan.fallbackChain, ["//button[text()='Submit']"]);
});
