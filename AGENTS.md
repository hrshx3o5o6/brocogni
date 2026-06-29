# Brocogni

## Commands

```bash
npm run check       # tsc --noEmit (type-check only, no output)
npm run build       # tsc -p tsconfig.json (emit to dist/)
npm test            # build + node --test 'dist/test/**/*.test.js'
npm start           # node dist/src/runtime/mcp.js
```

Tests are deterministic, no browser needed. 6 tests across 3 files.

## Architecture

```
src/
  index.ts              Entry — wires observer → semantic → selector pipeline
  observer/cdpObserver  CDP session: AX tree + DOM snapshot via CDP (not Playwright API)
  semantic/infer        Filters AX tree to actionable roles, infers purpose, generates selectors
  semantic/fuse         Extracts DOM geometry and fuses bounding boxes onto AX nodes
  selector/generate     Generates ARIA, CSS, XPath, relational sibling selectors
  selector/rank         Scores selectors (semantic, stability, uniqueness, resilience)
  runtime/service       BrowserCognitionService — orchestrates all pipeline steps
  runtime/mcp           JSON-RPC MCP server (the npm binary entrypoint)
  runtime/contracts     Request/response type interfaces
  runtime/delta         State diffing: keyed by backendDOMNodeId, falls back to node id
  runtime/prompts/instructions  AGENT_INSTRUCTIONS prompt for "write-robust-playwright-script"
  context/compiler      Trims nodes by mode (action/extract/debug) and budget
  types/schema          SemanticNode, SelectorCandidate, SemanticPageState, etc.
  setup/index.ts        Interactive setup — detects 7 clients, writes config files
```

## Key facts an agent will miss without this

- **Entrypoint**: `src/runtime/mcp.ts` is the npm binary (`bin` in package.json). It's also the `start` script. The configured entry in `opencode.json` for this repo points to it.
- **TTY gate**: When stdin is a TTY (bare `npx browser-cognition-mcp`), it runs interactive setup, not the MCP server. Server mode only with piped stdin. Use `--help`/`--version`/`--setup` flags for CLI discoverability.
- **CDP auto-connect**: `getOrCreatePage()` probes ports 9222–9224 for existing Chrome via `connectOverCDP` before falling back to `chromium.launch()`. Sets `isCdpMode = true`, which makes `cleanup()` skip closing the browser (won't kill user's Chrome).
- **Browser lifecycle**: No shared `contextInstance` variable. Each new page creates or reuses the first available context from `browserInstance.contexts()[0]`. CDP mode uses the existing browser's contexts directly.
- **MCP protocol quirks**: `notifications/initialized` silently ignored (no response). Error responses guard against null/undefined `id`. Protocol version echoes client request with fallback to `"2024-11-05"`.
- **13 MCP tools**: navigate, observe, delta, verify, act, get_selector_plan, find_targets, screenshot, evaluate, save_cookies, list_pages, use_page, evaluate (also `browser_info` and `browser_run_script` exist in handler but not in TOOLS array — hidden/internal).
- **Semantic nodes only**: Only 7 actionable ARIA roles survive filtering (button, link, textbox, combobox, checkbox, radio, menuitem, tab). Other roles dropped.
- **Selector fallback chain**: For each node, generates ordered candidates: ARIA role+name → text-based XPath → relational CSS/XPath (preceding/following named sibling). Sorted by score descending.
- **Delta keying**: Nodes are matched by `attributes.backendDOMNodeId`. If absent, falls back to `id_${node.id}` string key.
- **Packaging**: `package.json` `"files"` is scoped to `dist/src/` only. No test files, no examples shipped.
- **Setup detects 7 clients**: Antigravity, Cursor, Windsurf, Claude Desktop, Claude Code, OpenCode, Hermes. Each auto-configures on selection (writes JSON/YAML to the right location). Detection uses env vars (`CURSOR_TRACE_ID`, `TERM_PROGRAM`, `CLAUDE_CODE`, etc.) and `fs.existsSync` for config paths.
- **`@clack/prompts`**: Dynamic import only in setup path (not at MCP server runtime).

## Conventions

- TypeScript strict mode, ES2022 target, NodeNext module/ resolution.
- ESM only (`"type": "module"`). All internal imports use `.js` extensions.
- Single-responsibility modules. Small, focused files (~20–120 lines).
- Only runtime dependency is Playwright. `@clack/prompts` is setup-only.
- Tests: native `node:test` + `node:assert`. No test framework.
- Atomic commits. One logical change per commit.
- Branches go through PRs to `main`. CI runs `check → build → test` on Node 18/20/22.
- The `agent-reach` skill is installed — use it for web research browsing.

## Key decisions

- **CDP over Playwright API** for observer layer because we need raw AX tree + DOM snapshot access. Playwright is only used for browser lifecycle and navigation.
- **Semantic nodes before raw DOM** because LLMs reason better over structured abstractions than HTML soup.
- **Relational sibling selectors** as last-resort fallback — anchor unnamed elements to named neighbors, surviving layout changes.
- **Server-side state caching** so agents call tools without re-sending full page state every time (token efficiency).
