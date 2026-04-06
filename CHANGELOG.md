# Changelog

jstack is a fork of [gstack](https://github.com/garrytan/gstack).

## [0.2.0] — 2026-04-06

Upstream sync: merged 26 commits from gstack v0.15.15.0. All upstream improvements
with jstack branding preserved.

### What's new

- **GStack Browser.** Double-click AI browser with anti-bot stealth for QA testing and site dogfooding. Launch with `/open-jstack-browser`.
- **DX review skills.** New `/plan-devex-review` and `/devex-review` for developer experience audits — interactive scoring with proven DX patterns.
- **Review army improvements.** Adaptive gating + cross-review dedup eliminates redundant findings across specialist reviewers. Anti-skip rule enforces all review skills run to completion.
- **Multi-host platform.** Declarative host configs for OpenCode, Slate, Cursor, Kiro, and OpenClaw. Add new hosts with `hosts/*.ts` — no more hardcoded paths.
- **OpenClaw integration.** Native OpenClaw skills + ClaHub publishing support. Three CLAUDE.md tiers: lite (planning only), full (pipeline), and plan (review gauntlet).
- **Voice triggers.** AquaVoice-friendly speech-to-text aliases on all skills — say "run QA" or "auto plan" and it works.
- **Ship re-run.** Re-running `/ship` executes all verification checks again (tests, coverage, reviews). Only actions (VERSION bump, push, PR create) are idempotent.
- **Team mode.** `jstack-team-init` sets up team-wide jstack with enforcement hooks, vendoring detection, and auto-upgrade on session start.
- **Security hardening.** 14 fixes from community security audit + 8 PRs from 4 contributors. Path traversal guards, auth token validation, URL sanitization.
- **Snapshot dropdown detection.** `snapshot -i` auto-detects dropdown/popover interactive elements.
- **Connect Chrome.** `/connect-chrome` launches real Chrome controlled by jstack with Side Panel extension auto-loaded.

### Breaking changes

- Preamble now uses `jstack-update-check` instead of local `cat VERSION`. Skills check for updates at startup.
- Session tracking via `~/.jstack/sessions/` replaces simple session ID generation.

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
