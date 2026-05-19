# Browser Context Intelligence Framework - Working Context

## Date
- 2026-05-18

## Objective
Build a browser-context intelligence layer that gives coding agents structured semantic page understanding (not raw DOM dumps) to improve automation reliability.

## Change Log

### Commit 1 - Phase 1 Bootstrap
- Bootstrapped TypeScript prototype with:
  - CDP observer (`DOMSnapshot`, `Accessibility` tree capture)
  - AX-based semantic node inference
  - Selector ranking + initial selector candidate generation
  - Context compiler (`action`, `extract`, `debug`)
  - Runtime service (`observePage`, `compile`, `findTargets`, `getSelectorPlan`)
  - Demo script for end-to-end state observation

### Commit 2 - Repo Hygiene + Context Tracking
- Added `.gitignore` to exclude generated/vendor artifacts.
- Added this `CONTEXT.md` as persistent implementation journal.

## Current Status
- Phase 1 scaffold is implemented.
- Type checking passes (`npm run check`).
- Runtime browser demo requires elevated permission to launch Chromium in this environment.

## Next Planned Implementation Steps
1. Fuse DOMSnapshot geometry into semantic nodes (`bbox`, visibility confidence).
2. Add selector fallback chain generation and diagnostics fields.
3. Add iframe/shadow provenance metadata for each semantic node.
4. Define stable JSON contracts for MCP tool exposure.
5. Add deterministic fixture-based tests for semantic output stability.

### Commit 3 - Semantic Node Enrichment (in progress)
- Added semantic node provenance metadata:
  - `source` (`ax` | `dom` | `fused`)
  - optional `frameId`
- Improved AX inference:
  - captures AX properties into `attributes`
  - visibility inferred from AX `hidden` property
  - confidence boosted when accessible name is present
- Selector generation is now attached during inference (not left empty).
- Exported selector generation and runtime service from package entrypoint.

### Commit 4 - DOM Geometry Fusion (in progress)
- Added `src/semantic/fuse.ts`:
  - `extractDomGeometry(domSnapshot)` to extract `backendNodeId -> bbox` from CDP DOMSnapshot layout data.
  - `fuseAxWithDomGeometry(nodes, domGeometry)` to attach bounding boxes to AX-derived semantic nodes.
- Updated AX inference to preserve `backendDOMNodeId` in node attributes.
- Updated observer pipeline in `src/index.ts` to run:
  - AX inference
  - DOM geometry extraction
  - AX+DOM fusion
- Exported fusion helpers from package entrypoint.

### Commit 5 - Agent Contract Layer + Selector Plan Diagnostics (in progress)
- Added `src/runtime/contracts.ts` with stable request/response contracts for:
  - `observePage`
  - `findTargets`
  - `getSelectorPlan`
- Extended selector candidates with optional `reason` metadata.
- Enhanced selector generation with explicit rationale for primary/fallback candidates.
- Updated `BrowserCognitionService`:
  - `observePage(page, request)` now supports context mode+budget in one call.
  - Added `findTargetsTool(...)` contract response wrapper (`matches`, `count`).
  - `getSelectorPlan(...)` now returns ordered selector plan + fallback chain.
- Exported runtime contracts from package entrypoint.

### Commit 6 - Deterministic Test Harness + CI-Safe Runner (in progress)
- Added deterministic unit tests in `test/semantic.test.ts` covering:
  - AX semantic extraction + purpose inference + selector candidate presence.
  - DOM geometry extraction and AX/DOM fusion behavior.
  - Service contract behavior for target finding and selector plan generation.
- Added test build inclusion in `tsconfig.json`.
- Updated `npm test` flow to be sandbox-safe and deterministic:
  - `npm run build && node --test dist/test/**/*.test.js`
- Verified: typecheck and tests both pass.

### Commit 7 - Provenance + Action Verification Hooks (in progress)
- Extended `SemanticNode` with `inShadowTree` provenance flag.
- Added shadow-tree inference in AX reducer using available node/property signals.
- Added runtime action verification contracts in `src/runtime/contracts.ts`:
  - `VerifyActionRequest`
  - `VerifyActionResponse`
- Added `verifyAction(...)` in service to preflight actionability checks:
  - `visible`
  - `enabled`
  - selector availability
  - action-role compatibility checks (`supports_fill`, click intent guard)
- Extended deterministic tests to cover provenance and action verification behavior.
