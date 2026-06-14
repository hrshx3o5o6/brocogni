# Contributing to Browser Cognition

## Getting Started

1. Fork the repository
2. Clone your fork
3. Install dependencies: `npm install`
4. Install Playwright browsers: `npx playwright install chromium`
5. Build: `npm run build`
6. Run tests: `npm test`

## Development Workflow

- Run `npm run check` for TypeScript type checking
- Run `npm run build` to compile
- Run `npm test` to run unit tests
- Add tests for any new functionality

## Code Style

- TypeScript with strict mode
- No external runtime dependencies beyond Playwright
- Single-responsibility modules (small, focused files)
- Exports are well-typed with interfaces in `src/types/schema.ts`

## Project Structure

```
src/
├── index.ts           # Package entry point
├── observer/           # CDP browser observation
├── semantic/           # AX tree inference & DOM fusion
├── selector/           # Selector generation & ranking
├── runtime/            # MCP server & service layer
├── context/            # Context compilation for LLM token budgets
└── types/              # Shared type definitions
```

## Testing

Tests use Node.js native `node:test` and `node:assert`. They are deterministic and don't require a browser:

```bash
npm test
```

## Pull Request Process

1. Ensure TypeScript type checking passes
2. Ensure all tests pass
3. Update the README if adding new tools or features
4. Create a PR with a clear description of changes

## Reporting Issues

- Use the Bug Report template for bugs
- Use the Feature Request template for feature suggestions
- For security vulnerabilities, use SECURITY.md reporting process
