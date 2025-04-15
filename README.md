# ARC: The Memory Layer for Engineering Teams

> A local-first, ambient memory system that captures the *why* behind your code — and surfaces it directly inside your IDE.

---

## What is ARC?

### System Architecture
![System Architecture](/resources/arc_diagram.png)

**ARC (Architectural Reasoning Context)** is a developer tool that builds a persistent, versioned memory graph from your codebase. It captures structural code changes, Git history, and engineering decisions — and makes that history ambiently accessible as you work.

ARC helps engineering teams answer the most critical questions in software development:

- Why was this code written this way?
- Who made this change, and when?
- What architectural decisions shaped this system?
- How did this part of the system evolve?

---

## Core Concept: The 5-Stage Loop

ARC works by implementing a 5-stage feedback loop around your development activity:

1. **Capture** — Extract Git commit history and changed files  
2. **Structure** — Parse code via `tree-sitter` to build a Temporal Knowledge Graph (TKG)  
3. **Enrich** — Link commits to authors, decisions, and structural components  
4. **Preserve** — Enable developers to log decisions and link them to specific code states  
5. **Surface** — Show commit history, decision context, and architecture in your IDE (VS Code)

---

## Why It Matters

Today's tools track *what* changed. ARC preserves *why* it changed.

Engineering teams lose institutional knowledge every sprint:
- Decisions live in Slack threads, untracked PRs, and tribal memory
- Code becomes disconnected from rationale
- New engineers spend days reverse-engineering past logic

ARC transforms your repo into **a living architectural memory**, where structural decisions are versioned, searchable, and always visible in context.

---

## Key Features (V1)

| Feature                         | Description                                                                 |
|---------------------------------|-----------------------------------------------------------------------------|
| Local-first knowledge graph  | Powered by SQLite; no cloud or auth required                               |
| Git commit integration       | Pulls and indexes commit history using Git CLI                             |
| Code parsing via `tree-sitter` | Indexes structural elements (Files, Classes, Functions) from ASTs         |
| Temporal KG                  | Tracks how every code element evolves over time (via `CodeElementVersion`)|
| Decision linking             | Developers can record and link decisions to specific code states           |
| Context panel in VS Code     | View commit + decision history per file/class/function                     |
| Architecture diagram         | Auto-generated static view of system structure after initial indexing      |

---

## Tech Stack

- **Language:** TypeScript (VS Code extension)
- **Code Parsing:** [`tree-sitter`](https://tree-sitter.github.io/) (with per-language WASM grammars)
- **Persistence:** SQLite via [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3)
- **UI:** Native VS Code Webview Panels (Context, Architecture)
- **Bundler:** `esbuild`
- **Package Manager:** `pnpm`

---

## What ARC Is *Not* (Yet)

ARC V1 does **not** include:
- Full-text search or embeddings
- Integration with Slack, Jira, or GitHub PRs
- LLM-based suggestions or code explanations
- Team collaboration or cloud sync

Those are coming in future releases — but first, we're perfecting the core: **ambient architectural memory that actually works**.

---

## Quickstart

```bash
pnpm install
pnpm run build
code --install-extension ./dist/arc-1.vsix
```

Then in VS Code:
- Run `ARC: Index Repository`
- Open a file
- See commit + decision history in the **ARC Context Panel**

---

## Vision

We're building the memory substrate for the next generation of AI-assisted software development.

Whether it's developers searching for rationale, agents reasoning over system structure, or LLMs refactoring with awareness — ARC is the foundation layer that remembers.

> "Most tools track what changed — ARC remembers why."

---

## Feedback & Contributions

ARC is in early development and we're actively looking for:
- Foundational users
- Pilot partners (devtools, infra, eng teams)
- Open-source collaborators
