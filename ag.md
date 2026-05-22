# Browser Cognition Prototype (ag.md)

## Developer Directives

> [!IMPORTANT]
> **Git Commit Policy**
> **AFTER EVERY MINOR CHANGE OR FIX THAT HAS BEEN MADE, IT MUST BE COMMITTED TO GIT.** This is non-negotiable and ensures a clean, atomic, and reversible history of all implementations, refactors, and bug fixes.

---

## Project Overview

**Browser Cognition Prototype** is a TypeScript-based intelligence layer designed for AI coding agents interacting with web browsers. 

When AI agents perform browser automation (using tools like Playwright or Puppeteer), providing them with raw, noisy HTML DOM dumps is inefficient and error-prone. This project solves that problem by extracting a structured, semantic understanding of a web page. It distills the page into meaningful nodes (like "submit button" or "search input") rather than raw markup, significantly improving the reliability, resilience, and token-efficiency of automated browser actions.

## Core Architecture

The framework operates by tapping into the Chrome DevTools Protocol (CDP) via Playwright to observe and synthesize page state. 

### 1. Semantic Extraction & Fusion
- **AX Tree Inference:** Captures the Accessibility (AX) tree to infer the roles (e.g., `button`, `textbox`, `link`) and accessible names of elements.
- **DOM Snapshot Geometry:** Extracts the spatial geometry (bounding boxes) and layout data of the page.
- **Fusion Engine:** Fuses the AX nodes with DOM layout data using `backendDOMNodeId`, creating a unified `SemanticNode` that understands both *what* an element is and *where* it is.

### 2. Intelligent Selector Generation
- Generates ranked, highly reliable selector candidates (CSS, XPath, ARIA) for interacting with elements.
- Provides fallback chains so that if a primary selector fails, the agent has structural or relational alternatives to locate the element.

### 3. Action Verification Preflight
- Implements safety checks (`verifyAction`) before executing an interaction.
- Verifies if the target node is `visible`, `enabled`, and supports the intended action (e.g., ensuring a node actually supports text input before trying to fill it).

### 4. Agent Contract Layer
- Exposes stable, strongly-typed JSON service contracts (`observePage`, `findTargets`, `getSelectorPlan`, `verifyAction`).
- Designed specifically to be plugged into an agent's Model Context Protocol (MCP) toolset.

---

## Project Structure

- **`src/`**: The core TypeScript logic.
  - `src/semantic/`: Logic for extracting AX trees, inferring node purpose, and fusing DOM geometry.
  - `src/selector/`: Logic for generating and ranking selector candidates and fallbacks.
  - `src/runtime/`: The core service runtime (`BrowserCognitionService`) and API contracts for agent interactions.
  - `src/types/`: TypeScript schemas defining `SemanticNode`, `SelectorCandidate`, etc.
- **`test/`**: Deterministic unit tests to validate semantic extraction and contract behavior without live browser overhead.
- **`examples/`**: Demo scripts (like `demo.ts`) to showcase end-to-end framework capabilities.
- **`dist/`**: Compiled output.

---

## Current Status & Roadmap

### Phase 1: Bootstrap (Completed)
- Established the CDP observer and initial AX semantic inference.
- Added selector ranking and generation.
- Implemented core runtime service and deterministic testing.

### Phase 2: Resilience & Token Optimization (Planned/In Progress)
- **Delta Snapshots:** Instead of dumping the full page state on every interaction, the service will diff states using `backendDOMNodeId` and return only `added`, `removed`, and `modified` nodes. This optimizes context window usage for LLMs.
- **Selector Healing v1:** Implements neighborhood/positional inference. If an actionable node lacks strong identifiers, the system will look at adjacent sibling nodes (e.g., generating Playwright relational locators like `:right-of()`) to create robust structural fallbacks.

### Phase 3: Advanced Comprehension (Upcoming)
- Expanding extraction beyond actionable roles to include critical text nodes, complex grid/table comprehension, and cross-frame state observation.
