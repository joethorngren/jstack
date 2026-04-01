# gstack Architecture & Code Quality Audit

**Auditor:** Claude Opus 4.6 (1M context)
**Date:** 2026-03-31
**Version audited:** 0.15.1.0 (commit on main)
**Purpose:** Complete codebase understanding before forking to jstack

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Assessment](#2-architecture-assessment)
3. [Code Quality](#3-code-quality)
4. [Telemetry Deep Dive](#4-telemetry-deep-dive)
5. [Skill System Architecture](#5-skill-system-architecture)
6. [Multi-Host Support](#6-multi-host-support)
7. [Security Review](#7-security-review)
8. [What's Brilliant (Keep)](#8-whats-brilliant-keep)
9. [What's Concerning (Fix or Remove)](#9-whats-concerning-fix-or-remove)
10. [Fork Readiness Assessment](#10-fork-readiness-assessment)

---

## 1. Executive Summary

gstack is a well-engineered developer tool that solves two distinct problems:

1. **A persistent headless browser daemon** (the "browse" binary) that gives AI coding agents sub-second web interaction via localhost HTTP
2. **A skill authoring framework** that generates prompt documents (SKILL.md) for Claude Code, Codex CLI, Factory Droid, and Kiro from YAML-frontmattered templates

The codebase is approximately 15,000 lines of TypeScript (browse + scripts), 4,500 lines of shell scripts (bin/ + setup), 31,700 lines of generated SKILL.md content (34 skills), and 26,700 lines of tests. It is a single-package Bun project with Playwright and puppeteer-core as runtime dependencies and the Anthropic SDK as a dev dependency.

**Overall Grade: B+**

The browser daemon is genuinely excellent engineering -- the daemon lifecycle, ref system, security model, and crash recovery are thoughtful and battle-tested. The skill template system is clever and functional. The main concerns for a fork are: (1) deep coupling to Garry Tan's Supabase telemetry infrastructure, (2) the 687-line setup script, (3) a 1,530-line god file (server.ts), and (4) hardcoded "gstack" branding throughout every layer.

---

## 2. Architecture Assessment

### 2.1 The Chromium Daemon Model

**Grade: A**

This is the crown jewel. The architecture is:

```
CLI (compiled binary) --HTTP--> Server (Bun.serve) --CDP--> Chromium (headless)
```

**Key decisions that are correct:**

- **Daemon over cold-start.** First call ~3s, subsequent calls ~100-200ms. For QA sessions with 20+ commands, this saves 40+ seconds of browser startup overhead. The state persistence (cookies, localStorage, login sessions) across commands is essential for real-world testing.

- **Random port selection (10000-60000)** with 5 retries. Supports multiple concurrent workspaces with zero configuration. Previous approach of scanning 9400-9409 was fragile.

- **State file with atomic writes.** `browse.json` is written via tmp+rename with mode 0o600. Contains pid, port, bearer token, and binary version hash. The CLI reads this to find the server.

- **Version auto-restart.** Build writes `git rev-parse HEAD` to `.version`. CLI detects stale server and auto-restarts. Eliminates the "stale binary" class of bugs entirely.

- **Crash recovery via exit-and-restart** rather than self-healing. When Chromium crashes, the server exits immediately. The CLI detects the dead server on next command and auto-restarts. Simple and correct.

- **Exclusive lockfile** for concurrent ensureServer() races (TOCTOU prevention). Uses `fs.openSync(lockPath, 'wx')` with PID-based stale lock detection.

**Files:** `browse/src/cli.ts` (680 LOC), `browse/src/server.ts` (1,530 LOC), `browse/src/browser-manager.ts` (1,038 LOC)

**Concern:** `server.ts` at 1,530 lines is a god file. It contains: HTTP routing, sidebar chat/session management, git worktree creation, agent process spawning, inspector endpoints, SSE streaming, and buffer flushing. This is the single highest-priority refactor target.

### 2.2 The Ref System

**Grade: A**

Refs (`@e1`, `@e2`, `@c1`) let the AI agent address page elements without CSS selectors or XPath.

The approach is architecturally superior to DOM mutation:
- No CSP violations (injecting `data-ref` attributes is blocked by many production sites)
- No framework hydration conflicts (React/Vue reconciliation strips injected attributes)
- No shadow DOM issues

Implementation: `page.accessibility.snapshot()` -> walk ARIA tree -> assign sequential refs -> build Playwright Locators via `getByRole(role, { name }).nth(index)` -> store `Map<string, RefEntry>`.

**Staleness detection** is excellent: `resolveRef()` performs an async `count()` check (~5ms) before using any ref, failing fast instead of letting Playwright's 30-second timeout expire.

**Cursor-interactive refs** (`@c` namespace with `-C` flag) catch custom components styled with `cursor: pointer` that aren't in the ARIA tree. This is a thoughtful addition for modern SPAs.

### 2.3 The Skill Authoring Framework

**Grade: B+**

34 skills, each with a `.tmpl` template and a generated `SKILL.md`. The pipeline:

```
SKILL.md.tmpl  -->  gen-skill-docs.ts  -->  SKILL.md (committed)
                    (reads source code)
                    (resolves placeholders)
```

**Template resolvers** (13 modules in `scripts/resolvers/`):
- `preamble.ts` -- update checks, session tracking, telemetry, learnings, routing
- `browse.ts` -- command reference, snapshot flags, binary setup
- `design.ts` -- design methodology, shotgun loop, mockup generation
- `review.ts` -- review dashboard, codex second opinion, scope drift
- `testing.ts` -- test bootstrap, coverage audit
- `utility.ts` -- base branch detection, QA methodology, changelog workflow
- `composition.ts` -- `{{INVOKE_SKILL:name}}` for skill-to-skill delegation
- `learnings.ts` -- cross-session operational self-improvement
- `confidence.ts` -- confidence calibration

**Strengths:**
- Source-of-truth architecture: if a command exists in `commands.ts`, it appears in docs
- Three-tier testing: static validation (free), E2E via `claude -p` (~$3.85), LLM-as-judge (~$0.15)
- Committed output means git blame works and CI can validate freshness

**Concerns:**
- The preamble is enormous. A single bash block that runs: update check, session tracking, config reads, git operations, telemetry writes, learnings count, timeline logging, and routing detection. This runs at the START of every skill invocation.
- 34 skills * average 932 lines = ~31,700 lines of generated prompt content. That is a lot of prompt surface area that jstack inherits.

### 2.4 The Setup/Installation Flow

**Grade: C+**

The `setup` script is 687 lines of bash that:
1. Checks for Bun, builds the browse binary
2. Generates `.agents/skills/` for Codex format
3. Generates `.factory/skills/` for Factory Droid format
4. Ensures Playwright Chromium is installed
5. Creates `~/.gstack/` global state directory
6. Symlinks skills into `~/.claude/skills/`, `~/.codex/skills/`, `~/.kiro/skills/`, `~/.factory/skills/`
7. Handles prefix/no-prefix naming, migration from old installs

**Concerns:**
- 10 helper functions for symlink management across 4 host targets
- Migration logic for direct Codex installs, old unprefixed symlinks, old prefixed symlinks
- Windows support adds complexity (MINGW/MSYS/CYGWIN detection, Node.js fallback)
- Interactive TTY prompt for skill naming with 10-second timeout
- This script is the biggest barrier to forking: renaming from gstack to jstack means touching every path

### 2.5 Browse Binary Compilation and Distribution

The build command:
```bash
bun build --compile browse/src/cli.ts --outfile browse/dist/browse
bun build --compile browse/src/find-browse.ts --outfile browse/dist/find-browse
bun build --compile design/src/cli.ts --outfile design/dist/design
bun build --compile bin/gstack-global-discover.ts --outfile bin/gstack-global-discover
bash browse/scripts/build-node-server.sh  # Node.js fallback for Windows
```

Produces ~58MB Mach-O arm64 binaries. CLAUDE.md explicitly warns these should NOT be committed (tracked by git due to historical mistake). The setup script builds from source for every platform.

**Concern for jstack:** The compiled binary approach means we need Bun on every developer machine. This is fine for us but is a real dependency.

---

## 3. Code Quality

### 3.1 TypeScript Quality (browse/src/)

**Grade: B+**

**Strengths:**
- Clean separation of concerns in command handlers: `read-commands.ts`, `write-commands.ts`, `meta-commands.ts`
- `commands.ts` as single source of truth with load-time validation (lines 143-150 verify descriptions match command sets exactly)
- Good error wrapping: `wrapError()` translates Playwright errors into AI-actionable messages
- Trust boundary markers for untrusted content (`wrapUntrustedContent()`) with marker escape prevention
- Consistent use of TypeScript interfaces (`RefEntry`, `BrowserState`, `ServerState`)

**Concerns:**
- `server.ts` (1,530 LOC) is a god file. The sidebar chat/session management, agent spawning, and inspector endpoints should each be their own module. At minimum: extract `sidebar-routes.ts`, `inspector-routes.ts`, `session-manager.ts`.
- `browser-manager.ts` (1,038 LOC) mixes browser lifecycle, tab management, ref system, headed mode, watch mode, and dialog handling. The ref system and watch mode could be separate modules.
- Mixed use of `require()` and `import` in `browser-manager.ts` (lines 107-108: `const fs = require('fs')` inside a method of an ES module class). This is a Bun-ism but makes the code harder to reason about.
- Several `(browserManager as any)._inspectorData` casts in `server.ts` indicate the BrowserManager API surface is incomplete.

### 3.2 Shell Script Quality (bin/)

**Grade: B**

26 shell scripts in `bin/`, most 50-200 lines. Generally well-structured with:
- Consistent `set -euo pipefail` (or `set -uo pipefail` for telemetry scripts that must never fail)
- `json_safe()` function for JSON injection prevention in `gstack-telemetry-log`
- Config validation (alphanumeric + underscore only for keys)

**Concerns:**
- `gstack-telemetry-log` (203 LOC) constructs JSON via `printf` with field interpolation rather than using `jq` or a proper JSON builder. The `json_safe()` function strips quotes and truncates to 200 chars, but this is fragile. A single missed field could corrupt the entire JSONL line.
- No shellcheck annotations or CI linting for shell scripts (there is an `actionlint.yml` for GitHub Actions YAML but not for the bin/ scripts)
- `gstack-update-check` (212 LOC) sources `supabase/config.sh` which sets global variables. This is a side-effect import pattern.

### 3.3 Test Coverage and Quality

**Grade: B+**

**Test counts:**
- `browse/test/`: ~8,600 lines across integration tests
- `test/`: ~18,100 lines across 38 test files (skill validation, E2E, LLM eval, telemetry, analytics, audit compliance)

**Test infrastructure is excellent:**
- `test/helpers/session-runner.ts`: spawns `claude -p` as subprocess, streams NDJSON, races against timeout
- `test/helpers/eval-store.ts`: incremental partial writes (survives kills), timestamped final writes
- `test/helpers/touchfiles.ts`: diff-based test selection (only runs tests affected by changes)
- Two-tier system: `gate` (blocks merge) vs `periodic` (weekly cron)

**Audit compliance tests** (`test/audit-compliance.test.ts`) verify security properties:
- No hardcoded credentials in SKILL.md.tmpl
- Telemetry calls are conditional on `_TEL`
- Bun install uses checksum verification
- Extension validates message sender
- Chrome CDP binds to localhost only

**Concern:** No unit tests for the browse server itself (only integration tests that hit a running server). The `server.ts` god file is essentially untested at the unit level -- its correctness depends on integration tests.

### 3.4 Dependency Health

**Grade: A-**

Minimal dependency tree:
```json
{
  "dependencies": {
    "diff": "^7.0.0",
    "playwright": "^1.58.2",
    "puppeteer-core": "^24.40.0"
  },
  "devDependencies": {
    "@anthropic-ai/sdk": "^0.78.0"
  }
}
```

Three runtime dependencies is remarkably lean for a tool this capable. `diff` is a pure-JS text diff library. `playwright` is the browser automation engine. `puppeteer-core` is used for CDP inspector features.

**Minor concern:** Both `playwright` and `puppeteer-core` are large, but only `playwright` bundles Chromium. Having both adds some redundancy.

---

## 4. Telemetry Deep Dive

### 4.1 Complete Map of Data Egress Points

Every point where data could leave the machine:

| # | What | When | Where | Data Sent | Controlled By |
|---|------|------|-------|-----------|---------------|
| 1 | **Telemetry sync** | After every skill run (backgrounded, rate-limited to 1x/5min) | `POST {SUPABASE_URL}/functions/v1/telemetry-ingest` | skill name, duration, outcome, error_class, gstack_version, os, arch, session count, installation_id (community only) | `telemetry` config: `off`/`anonymous`/`community` |
| 2 | **Update check ping** | On every skill start (backgrounded, cache: 60min up-to-date, 720min upgrade-available) | `POST {SUPABASE_URL}/functions/v1/update-check` | gstack_version, os | `telemetry` config (respects `off`) AND `update_check` config |
| 3 | **Version check** | On every skill start | `GET https://raw.githubusercontent.com/garrytan/gstack/main/VERSION` | HTTP request (IP visible to GitHub CDN) | `update_check` config |
| 4 | **Community dashboard** | On explicit user request (`gstack-community-dashboard`) | `GET {SUPABASE_URL}/functions/v1/community-pulse` | Nothing (read-only, uses anon key) | User-initiated only |

### 4.2 Supabase Integration Points

**Supabase project:** `frugpmstpnojnhfyimgv.supabase.co`
**Anon key:** `sb_publishable_tR4i6cyMIrYTE3s6OyHGHw_ppx2p6WK` (in `supabase/config.sh`)

Three edge functions:
1. `telemetry-ingest` -- validates and inserts skill usage events (uses `SUPABASE_SERVICE_ROLE_KEY` server-side)
2. `update-check` -- logs install ping, returns current version
3. `community-pulse` -- returns aggregated community stats (cached 1 hour)

Three tables:
1. `telemetry_events` -- skill runs, upgrades, error classes
2. `installations` -- first_seen, last_seen per installation_id
3. `update_checks` -- version + os per check

**RLS is properly tightened** (migration 002): anon key can INSERT but NOT SELECT or UPDATE. All reads go through edge functions using `SUPABASE_SERVICE_ROLE_KEY`.

### 4.3 Installation ID and Device Fingerprinting

- **Community tier:** random UUID v4 stored at `~/.gstack/installation-id`. NOT derived from hostname, username, or any machine-specific data. Cannot be guessed or correlated by someone who knows the machine identity.
- **Anonymous tier:** No installation_id sent. Events are counters only.
- **Off tier:** No data sent at all. JSONL is not even written locally.

### 4.4 Local-Only Fields

The telemetry-log script writes `_repo_slug` and `_branch` to local JSONL, but the sync script strips them before sending (`sed -e 's/,"_repo_slug":"[^"]*"//g' -e 's/,"_branch":"[^"]*"//g'`).

### 4.5 What Needs to Change for jstack

**CRITICAL:** All four egress points phone home to Garry Tan's infrastructure:
1. Supabase URL and anon key are hardcoded in `supabase/config.sh`
2. GitHub raw URL points to `garrytan/gstack/main/VERSION`
3. Telemetry is opt-in (defaults to `off`) but the infrastructure is baked in

**Recommendation:** For jstack, we should:
1. Remove or replace `supabase/config.sh` with our own Supabase project (or remove entirely)
2. Change the VERSION URL to our own repo
3. Keep the telemetry architecture (it is well-designed) but point it at our infrastructure
4. Keep telemetry defaulting to `off`

---

## 5. Skill System Architecture

### 5.1 Skill Discovery and Loading

Skills are discovered by the host (Claude Code, Codex, etc.) via their native skill discovery mechanisms:
- **Claude Code:** Scans `~/.claude/skills/` for directories containing `SKILL.md`
- **Codex CLI:** Scans `~/.codex/skills/` and `.agents/skills/` for directories containing `SKILL.md`
- **Factory Droid:** Scans `~/.factory/skills/` and `.factory/skills/`
- **Kiro:** Scans `~/.kiro/skills/`

gstack's `setup` script creates symlinks from these host-specific directories to the gstack source. For Claude, individual skill directories are symlinked. For Codex/Factory/Kiro, generated copies (with path rewrites) are placed in host-specific directories.

### 5.2 Template Resolver System

The resolver system (`scripts/resolvers/`) maps placeholder names to generator functions:

```typescript
export const RESOLVERS: Record<string, ResolverFn> = {
  PREAMBLE: generatePreamble,
  COMMAND_REFERENCE: generateCommandReference,
  BROWSE_SETUP: generateBrowseSetup,
  // ... 30+ resolvers total
};
```

Each resolver takes a `TemplateContext` containing:
- `skillName` -- which skill is being generated
- `tmplPath` -- path to the .tmpl file
- `host` -- `claude` | `codex` | `factory`
- `paths` -- host-specific path patterns
- `preambleTier` -- 1-4, controls which preamble sections are included
- `benefitsFrom` -- optional list of features (browse, design, etc.)

Placeholders in .tmpl files: `{{PLACEHOLDER_NAME}}` or parameterized `{{INVOKE_SKILL:skill-name}}`.

### 5.3 Preamble Generation and Tiers

Every skill gets a preamble (tier 1-4). The preamble is a bash block that runs first, followed by prose sections:

**Tier 1 (minimal):** Update check, session tracking, config reads, telemetry start, learnings count, routing detection
**Tier 2:** + AskUserQuestion format, completeness principle, repo mode
**Tier 3:** + Search Before Building (ETHOS.md reference)
**Tier 4:** + Contributor mode (for gstack's own development)

The preamble bash block alone is ~40 lines of shell that runs 8+ external commands. This is the most impactful piece of prompt real estate in the entire system.

### 5.4 Skill Composition (INVOKE_SKILL)

`{{INVOKE_SKILL:plan-ceo-review}}` generates prose instructing Claude to:
1. Read the target skill's SKILL.md via the Read tool
2. Follow its instructions top-to-bottom
3. Skip sections already handled by the parent skill (preamble, AskUserQuestion format, completeness principle, etc.)

This is composition via prompt delegation, not code execution. It is elegant but fragile -- the skip list is hardcoded strings that must match section headings exactly.

### 5.5 The Learn/Memory System

Operational self-improvement across sessions:
- `gstack-learnings-log` -- appends JSON to `~/.gstack/projects/{slug}/learnings.jsonl`
- `gstack-learnings-search` -- searches learnings by keyword, returns top N
- Deduplication at read time ("latest winner" per key+type)
- The preamble loads learnings count at startup and displays top 3

This is genuinely useful for long-lived projects. The learning entries include: skill, type (pitfall/pattern/observation), key, insight, confidence (1-10), source (observed/hypothesized).

### 5.6 Routing Rules

The preamble detects whether `CLAUDE.md` has a `## Skill routing` section. If not, it offers to inject routing rules that tell Claude Code to auto-invoke skills when user requests match patterns. This is the mechanism that makes gstack "proactive."

---

## 6. Multi-Host Support

### 6.1 Claude Code Integration Surface

**Primary host.** Skills are SKILL.md files in `~/.claude/skills/gstack/` (or `~/.claude/skills/{skill-name}/` with symlinks).

The integration is via Claude Code's native skill loading: when a user types `/skill-name`, Claude reads the SKILL.md and follows its instructions. gstack's browse binary is invoked via `$B` in bash code blocks within the SKILL.md.

Path patterns: `~/.claude/skills/gstack/bin/`, `~/.claude/skills/gstack/browse/dist/`.

### 6.2 Codex CLI Integration Surface

Skills are generated to `.agents/skills/gstack-{name}/SKILL.md` with path rewrites:
- `$GSTACK_ROOT` -- resolved at preamble time via git root or `$HOME/.codex/skills/gstack`
- `$GSTACK_BIN`, `$GSTACK_BROWSE`, `$GSTACK_DESIGN` -- derived from `$GSTACK_ROOT`

A runtime root at `~/.codex/skills/gstack/` contains only: SKILL.md (root skill), bin/ (symlink), browse/dist/ (symlink), review/ assets. This avoids duplicate skill discovery.

OpenAI YAML manifest (`agents/openai.yaml`) is generated for each skill with `display_name`, `short_description` (<120 chars), and `default_prompt`.

### 6.3 Factory Droid Integration Surface

Nearly identical to Codex: `.factory/skills/gstack-{name}/SKILL.md` with path rewrites. Additional frontmatter fields: `user-invocable: true`, `disable-model-invocation: true` (for sensitive skills).

### 6.4 Kiro Integration Surface

Kiro uses sed-based path rewriting from the Codex-generated skills:
```bash
sed -e 's|$HOME/.codex/skills/gstack|$HOME/.kiro/skills/gstack|g' ...
```

### 6.5 What a Cursor Integration Would Look Like

Cursor uses `.cursor/rules/` for custom instructions. A Cursor integration would:
1. Generate SKILL.md files to `.cursor/rules/jstack-{name}.md`
2. Path patterns: `~/.cursor/skills/jstack/` or inline paths
3. No special manifest format needed (Cursor reads markdown rules directly)
4. Browse binary would be the same -- just different path resolution

The resolver system already supports this via the `Host` type and `HOST_PATHS` mapping. Adding a new host is: define paths in `types.ts`, add a case to setup, add a case to `gen-skill-docs.ts`.

---

## 7. Security Review

### 7.1 Supabase Keys

The anon key in `supabase/config.sh` is genuinely public-safe:
- RLS is tightened (migration 002): anon key can INSERT but NOT SELECT or UPDATE
- All reads go through edge functions using service role key
- The comment correctly notes this is equivalent to Firebase public config

**For jstack:** We should replace these with our own Supabase project or remove them entirely. Leaving them means our fork's telemetry would go to Garry's Supabase.

### 7.2 Token Handling for Browse Daemon

**Good:**
- Bearer token is `crypto.randomUUID()` per server session
- State file written with mode 0o600 (owner-only read)
- Token rotates on every server restart
- Cookie picker UI (`/cookie-picker`) is exempt from auth but only serves HTML
- Health check (`/health`) is exempt but does not execute commands and does not expose the token

**Concern:**
- Token is passed as `?token=` query parameter for SSE endpoints (EventSource can't send headers). Query parameters appear in access logs and `referer` headers. This is localhost-only so the risk is minimal, but it is a deviation from best practice.

### 7.3 Cookie Import Security

**Good:**
- Keychain access requires explicit user approval (macOS dialog)
- Decryption happens in-memory, never written to disk in plaintext
- Cookie DB is copied to temp file and opened read-only
- No cookie values in logs
- Browser registry is hardcoded (no user-supplied database paths)
- Keychain access uses `Bun.spawn()` with explicit argument arrays (no shell string interpolation)

### 7.4 Hardcoded Secrets/Credentials

**None found.** The audit compliance tests verify no hardcoded passwords in SKILL.md.tmpl (`$TEST_EMAIL` and `$TEST_PASSWORD` are used as placeholders).

### 7.5 Extension Security

**Good:**
- `background.js` validates `sender.id !== chrome.runtime.id` and uses `ALLOWED_TYPES` allowlist
- Auth token is written to `.auth.json` with mode 0o600
- Chrome CDP binds to localhost only with `--remote-debugging-address=127.0.0.1`

### 7.6 Dependency Supply Chain

Minimal attack surface (3 runtime deps). No postinstall scripts. `bun.lock` provides integrity hashes. The CI image (`Dockerfile.ci`) is pre-baked with specific Playwright/Chromium versions.

**Concern:** No `npm audit` or equivalent in CI. The `package.json` uses `^` ranges which allow minor/patch version drift.

### 7.7 Prompt Injection Protection

**Good:**
- `wrapUntrustedContent()` wraps page content commands with trust boundary markers
- Marker escape prevention: content containing boundary strings gets zero-width space injected
- URL sanitization (newlines removed to prevent marker injection via `history.pushState`)
- Sidebar agent system prompt has explicit security rules: XML escaping of user messages, allowed commands whitelist, instruction to refuse prompt injection attempts

---

## 8. What's Brilliant (Keep)

### 8.1 The Daemon Model with Automatic Lifecycle

The entire daemon lifecycle -- startup-on-first-use, health-check-based liveness, version auto-restart, 30-minute idle shutdown, crash-via-exit-and-restart -- is a masterclass in building reliable daemon infrastructure for developer tools. This would take weeks to replicate from scratch and the edge cases (concurrent startup races, stale state files, orphaned Chromium processes, Windows process management) are all handled.

**Estimated recreation cost:** 3-4 weeks human, 8-12 hours AI-assisted.

### 8.2 The Ref System

ARIA-tree-based element referencing that avoids DOM mutation is the right architectural choice. The staleness detection, cursor-interactive refs, and per-navigation ref clearing are all correct. This is the kind of thing that looks simple but requires deep understanding of browser automation edge cases.

**Estimated recreation cost:** 1-2 weeks human, 4-6 hours AI-assisted.

### 8.3 The Template Resolver Architecture

The separation of human-written prose (`.tmpl` files) from code-derived facts (resolved at build time) is elegant. It solves the "docs drift from code" problem structurally. The three-tier test approach (static validation for free, E2E for confidence, LLM-judge for quality) is smart economics.

**Estimated recreation cost:** 1 week human, 2-3 hours AI-assisted.

### 8.4 The Command Registry as Single Source of Truth

`commands.ts` with load-time validation ensuring COMMAND_DESCRIPTIONS matches the command sets is a pattern worth keeping. Zero-side-effects module safe to import from build scripts, tests, and runtime.

### 8.5 The Trust Boundary Architecture

`wrapUntrustedContent()` with marker escape prevention, the sidebar agent's prompt injection defenses (XML escaping, allowed command whitelist), and the `PAGE_CONTENT_COMMANDS` categorization are all correct security architecture for an AI agent interacting with untrusted web content.

### 8.6 The E2E Test Infrastructure

The session-runner that spawns `claude -p` as a subprocess, streams NDJSON for real-time progress, and the eval-store with incremental/partial writes that survive kills -- this is production-grade test infrastructure. The diff-based test selection (`touchfiles.ts`) is a smart optimization.

### 8.7 The Self-Learning System

Cross-session operational learnings (`learnings.jsonl`) with deduplication and confidence scoring is a genuinely novel feature. Most AI coding tools have no memory across sessions. This gives gstack/jstack a compounding advantage.

---

## 9. What's Concerning (Fix or Remove)

### 9.1 CRITICAL: Telemetry Points to Garry's Infrastructure

**Impact:** Every jstack user would phone home to garrytan's Supabase
**Files:** `supabase/config.sh`, `bin/gstack-update-check` (line 21: `garrytan/gstack/main/VERSION`), `bin/gstack-telemetry-sync`, `bin/gstack-community-dashboard`
**Fix:** Replace Supabase URL/key with our own project, change VERSION URL to our repo, or remove telemetry entirely for initial fork

### 9.2 CRITICAL: "gstack" Branding in Every Layer

**Impact:** Renaming requires changes in 100+ files
**Scope:**
- 26 shell scripts in `bin/` all prefixed `gstack-*`
- `~/.gstack/` state directory hardcoded throughout
- `gstack-` prefix in skill names
- `package.json` name field
- ETHOS.md, ARCHITECTURE.md, CLAUDE.md all reference "gstack"
- Setup script references `gstack` in 50+ places
- All generated SKILL.md content references `gstack`

**Fix:** Systematic find-and-replace is the only option. The resolver system's `HOST_PATHS` makes this tractable for path patterns, but prose references require manual review.

### 9.3 HIGH: server.ts God File (1,530 LOC)

**Impact:** Hard to understand, test, or modify safely
**Fix:** Extract:
- `sidebar-routes.ts` (~500 LOC of sidebar chat/session/agent endpoints)
- `inspector-routes.ts` (~100 LOC of CDP inspector endpoints)
- `session-manager.ts` (~200 LOC of session/worktree management)
- `agent-manager.ts` (~200 LOC of Claude subprocess spawning and lifecycle)
This would leave server.ts at ~530 LOC: config, startup, health check, command dispatch, shutdown.

### 9.4 HIGH: Setup Script Complexity (687 LOC)

**Impact:** Brittle, hard to test, hard to modify for jstack
**Fix:** Split into:
- `setup-build.sh` -- compile binaries
- `setup-claude.sh` -- symlink skills for Claude Code
- `setup-codex.sh` -- generate and symlink for Codex
- `setup-factory.sh` -- generate and symlink for Factory
- `setup-kiro.sh` -- generate and rewrite for Kiro
- `setup` -- orchestrator that calls the above based on `--host` flag

### 9.5 HIGH: The Preamble is Too Heavy

**Impact:** Every skill invocation runs ~40 lines of shell that executes 8+ external commands before the skill's own logic begins
**Concern:** This adds latency and token overhead to every skill run. Some of these (update check, learnings search, routing detection) are not needed for every skill.
**Fix:** Make preamble sections opt-in per skill via `preambleTier`. Currently tiers control which prose sections are included but the bash block is the same for all tiers.

### 9.6 MEDIUM: JSON Construction via printf in Shell

**Impact:** Potential for JSON corruption despite `json_safe()` sanitization
**File:** `bin/gstack-telemetry-log` (lines 191-195)
**Fix:** Use `jq` to construct JSON, or rewrite telemetry-log in TypeScript (since Bun is already a dependency)

### 9.7 MEDIUM: 31,700 Lines of Generated SKILL.md Content

**Impact:** Massive prompt surface area that consumes tokens on every skill invocation
**Concern:** The largest skill (ship) is 2,216 lines. That is a lot of instruction for an LLM to process.
**Fix:** Audit each skill for content that could be moved to reference files (read on demand) rather than included in the SKILL.md prompt.

### 9.8 MEDIUM: Compiled Binaries in Git History

**Impact:** Repository bloat, cross-platform issues (Mach-O arm64 only)
**Current status:** CLAUDE.md warns "NEVER commit these" but they are tracked due to historical mistake
**Fix:** `git rm --cached browse/dist/ design/dist/` and add to `.gitignore`

### 9.9 LOW: Mixed require/import in TypeScript

**Impact:** Code clarity
**Files:** `browser-manager.ts` lines 107-108 (`const fs = require('fs')` inside an ES module)
**Fix:** Use consistent `import` statements

### 9.10 LOW: `(browserManager as any)` Casts

**Impact:** Type safety
**Files:** `server.ts` lines 1341-1342
**Fix:** Add proper properties to BrowserManager's public interface

### 9.11 LOW: ETHOS.md and Garry Tan's Personal Philosophy

**Impact:** Identity confusion in a fork
**ETHOS.md** contains Garry's personal builder philosophy ("The Golden Age", "Boil the Lake", "User Sovereignty"). It is genuinely good content but is deeply personal and branded.
**Fix:** For jstack, write our own ETHOS.md or adapt the principles in our own voice.

---

## 10. Fork Readiness Assessment

### 10.1 What to Do Before First jstack Commit

1. **Replace telemetry infrastructure** (or disable entirely for v0.1)
2. **Rename "gstack" to "jstack"** across all files (systematic, ~2 hours)
3. **Change VERSION URL** from `garrytan/gstack` to our repo
4. **Write our own ETHOS.md** (or remove the reference)
5. **Remove Garry-specific CLAUDE.md rules** (community PR guardrails, CHANGELOG voice rules)

### 10.2 What to Do in Sprint 1

1. **Refactor server.ts** into 4-5 smaller modules
2. **Split setup script** into per-host modules
3. **Remove skills we don't need** (probably: office-hours, cso, design-consultation, design-shotgun, retro, document-release, canary, benchmark)
4. **Slim the preamble** to only essentials
5. **Remove compiled binaries from git tracking**

### 10.3 What to Keep Exactly As-Is

1. The daemon model (cli.ts, server startup/shutdown, state file)
2. The ref system (snapshot.ts, browser-manager.ts ref methods)
3. The command registry pattern (commands.ts)
4. The template resolver architecture (scripts/resolvers/)
5. The trust boundary architecture (wrapUntrustedContent, XML escaping)
6. The self-learning system (learnings-log, learnings-search)
7. The E2E test infrastructure (session-runner, eval-store, touchfiles)
8. The cookie import system (cookie-import-browser.ts, cookie-picker-*)

### 10.4 Lines of Code Summary

| Component | Lines | Keep/Modify/Remove |
|-----------|-------|-------------------|
| browse/src/ (daemon) | 8,981 | Keep (refactor server.ts) |
| scripts/ (template system) | 3,600 | Keep (rename paths) |
| bin/ (CLI utilities) | 2,400 | Keep (rename gstack-> jstack) |
| setup | 687 | Modify (split, simplify) |
| test/ | 18,135 | Keep |
| browse/test/ | 8,621 | Keep |
| design/src/ | ~2,400 | Evaluate (do we need GPT Image?) |
| extension/ | ~800 | Keep (rename) |
| SKILL.md files (34) | 31,707 | Trim to ~15-20 skills |
| SKILL.md.tmpl files (34) | ~6,000 | Trim to ~15-20 skills |
| Docs (ARCHITECTURE, CLAUDE, etc.) | ~5,000 | Rewrite for jstack |
| supabase/ | ~400 | Replace or remove |

**Total codebase:** ~88,000 lines
**After fork cleanup:** ~55,000-65,000 lines (estimate)

---

*This audit was performed by reading every significant source file, shell script, test, and configuration file in the repository. No code was executed. Findings are based on static analysis and architectural reasoning.*
