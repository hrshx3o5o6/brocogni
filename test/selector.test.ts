import assert from "node:assert/strict";
import { test } from "node:test";
import { generateSelectorCandidates } from "../src/selector/generate.js";
import type { SemanticNode } from "../src/types/schema.js";

function createMockNode(id: string, role: string, name?: string): SemanticNode {
  return {
    id,
    role,
    name,
    visible: true,
    enabled: true,
    confidence: 0.8,
    selectors: [],
    attributes: {},
    inShadowTree: false,
    source: "ax"
  };
}

test("selector healing generates relational css and xpath when node lacks name", () => {
  const buttonNode = createMockNode("n1", "button", "Submit");
  const inputNode = createMockNode("n2", "textbox"); // unnamed textbox

  const allNodes = [buttonNode, inputNode];
  
  const selectors = generateSelectorCandidates(inputNode, allNodes, 1);
  
  // n2 has no name, so it should generate relational selectors referencing n1
  const relationalCss = selectors.find(
    (s) => s.kind === "css" && s.value === "button:has-text('Submit') + input"
  );
  assert.ok(relationalCss);
  assert.ok(relationalCss.score < 0.8);
  assert.ok(relationalCss.reason && relationalCss.reason.includes("follows named sibling"));

  const relationalXpath = selectors.find(
    (s) => s.kind === "xpath" && s.value === "//button[normalize-space()='Submit']/following-sibling::input[1]"
  );
  assert.ok(relationalXpath);
  assert.ok(relationalXpath.reason && relationalXpath.reason.includes("follows sibling"));
});

test("selector healing generates relational preceding sibling xpath when next node has name", () => {
  const inputNode = createMockNode("n1", "textbox"); // unnamed textbox
  const buttonNode = createMockNode("n2", "button", "Submit");

  const allNodes = [inputNode, buttonNode];
  
  const selectors = generateSelectorCandidates(inputNode, allNodes, 0);

  const relationalXpath = selectors.find(
    (s) => s.kind === "xpath" && s.value === "//button[normalize-space()='Submit']/preceding-sibling::input[1]"
  );
  assert.ok(relationalXpath);
  assert.ok(relationalXpath.reason && relationalXpath.reason.includes("precedes sibling"));
});
