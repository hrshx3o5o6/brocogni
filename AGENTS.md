# Brocogni

Making Playwright make sense to AI agents.

## For AI agents working on this repo

Brocogni is an MCP server that observes web pages through the Chrome DevTools Protocol, compiles them into structured semantic nodes, and generates self-healing Playwright selectors with fallback chains.

## Architecture

```
src/
  index.ts              Entry point -- wires up the pipeline
  observer/cdpObserver  CDP session: captures AX tree + DOM snapshot
  semantic/infer        Converts AX tree into SemanticNode[]
  semantic/fuse         Extracts DOM geometry and fuses with AX nodes
  selector/generate     Generates ARIA, CSS, XPath, relational selectors
  selector/rank         Scores and sorts selector candidates
  runtime/service       BrowserCognitionService -- orchestrates everything
  runtime/mcp           JSON-RPC MCP server (the executable)
  runtime/contracts     Request/response type contracts
  runtime/delta         State diffing (added/removed/modified)
  context/compiler      Filters nodes for LLM token budgets
  types/schema          SemanticNode, SelectorCandidate, etc.
```

## Conventions

- TypeScript, strict mode, ES2022 target, NodeNext module resolution.
- Single-responsibility modules. Small, focused files.
- Only runtime dependency is Playwright. No other external deps.
- Tests use Node native `node:test` and `node:assert` -- no test framework.
- ESM only (`"type": "module"` in package.json).

## Testing

```bash
npm run check    # TypeScript type checking
npm run build    # Compile to dist/
npm test         # Build + run unit tests
```

Tests are deterministic and don't require a browser.

## Key decisions

- **CDP over Playwright's high-level API** for the observer layer because we need raw AX tree + DOM snapshot access. Playwright is used for browser lifecycle and navigation.
- **Semantic nodes before raw DOM** because LLMs reason better over structured abstractions than HTML soup.
- **Relational sibling selectors** as the last-resort fallback because they anchor unnamed elements to named neighbors, surviving layout changes.
- **Server-side state caching** so agents can call tools without re-sending the full page state every time (token efficiency).

## Git

Atomic commits. One logical change per commit.
