# Changelog

jstack is a fork of [gstack](https://github.com/garrytan/gstack) v0.15.1.0.

## [0.1.0] — 2026-04-01

Privacy-first AI engineering toolkit with Cursor IDE support. 38 skills, 8 agents,
multi-model code review, and a headless browser — all running locally with zero telemetry.

### What's new

- **Zero telemetry.** Nothing leaves your machine. No Supabase, no installation ID, no phone-home. Local JSONL analytics only.
- **38 workflow skills.** QA, review, ship, brainstorm, design consultation, legal audit, security audit, retrospective, and more — all invokable from Claude Code or Cursor.
- **8 curated agents.** Caleb (sprint master), Reza (architect), Michael (docs), Mr. Robot (security), Chi (UX), Adam (edge cases), plus consolidated legal and code auditors.
- **Cursor IDE support.** MCP server (10 tools) for the browse daemon + 35 `.mdc` rules for all workflow skills. Install with `./setup --host cursor`.
- **Multi-model code review.** `/war-room` spawns parallel reviews across Claude, Codex, and Gemini. Consensus findings from 2+ models are high-confidence.
- **Company fork system.** `jstack init --company <name>` creates a branded fork with renamed paths, starter DESIGN.md, and upstream tracking.
- **Upstream sync automation.** GitHub Actions workflow merges gstack changes weekly, auto-resolves renames, blocks telemetry re-introduction.
- **/brainstorm** replaces /office-hours — same great forcing questions, fresh framing.

### For contributors

- Compiled binaries removed from git tracking
- Fresh CHANGELOG starting at v0.1.0
- UPSTREAM-RENAME-MAP.md documents all renamed paths for cherry-picking upstream fixes
- Sprint plans in `docs/sprint-plans/`
- 603 test assertions across skill validation, gen-skill-docs, and Sprint 4 coverage
