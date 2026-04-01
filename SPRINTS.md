# jstack Sprint Plan

6 sprints to go from fresh fork to shareable product.
Each sprint is designed to be completable in a single CC session (2-4 hours).

---

## Sprint 0: Research Spikes (Discovery — no code changes)

**Goal:** Answer the two unknowns before committing architecture.

### Tickets

**JS-001: Cursor Agent/MCP Capabilities Research**
- Research Cursor's agent mode, MCP support, tool invocation
- Can Cursor invoke shell commands from agent mode?
- Can Cursor connect to an MCP server?
- Can Cursor call external binaries?
- Document: capabilities matrix + architecture decision
- Output: `docs/research/cursor-capabilities.md`

**JS-002: Agent Zero / Browser-Use Research**
- Current state: Docker-only vs MCP server vs standalone?
- How does it complement Playwright? (fast/dumb vs slow/smart)
- Setup complexity for end users
- Can it run alongside the existing browse daemon?
- Output: `docs/research/agent-zero-browser-capabilities.md`

**JS-003: Cursor User Group Reconnaissance**
- What are people asking for in the Cursor User Group?
- What .cursorrules are being shared?
- What's the install friction tolerance?
- What would make someone stop scrolling?
- Output: notes in `docs/research/cursor-community.md`

### Exit Criteria
- [ ] Cursor capabilities matrix complete
- [ ] Agent Zero feasibility assessment complete
- [ ] Architecture decision documented: MCP vs shell vs prompt templates for Cursor
- [ ] **Decision gate**: If Cursor cannot invoke external tools via any path, document that jstack ships Claude Code-first and Cursor support becomes a tracked v2 item. Do NOT block the fork on Cursor.
- [ ] Agents vs skills architecture decision: are the agent roster members (Caleb, Reza, etc.) Claude Code agents, gstack-style skills, or both? Document the pattern for Sprint 2.

---

## Sprint 1: Telemetry Nuke + Core Rename

**Goal:** jstack exists as a clean, working fork with zero telemetry.

### Tickets

**JS-010: Complete Telemetry Removal**
- [x] Delete `supabase/` directory (DONE)
- [x] Delete `bin/gstack-telemetry-*` scripts (DONE)
- [x] Delete `bin/gstack-analytics` (DONE)
- [x] Delete `bin/gstack-community-dashboard` (DONE)
- [x] Delete `test/telemetry.test.ts` (DONE)
- [ ] Clean `scripts/resolvers/preamble.ts`: remove remote telemetry blocks, keep local JSONL
- [ ] Remove telemetry opt-in prompts from preamble (the AskUserQuestion about community/anonymous/off)
- [ ] Remove installation-id generation from setup script
- [ ] Remove update-check phone-home (replace with local git-based version check)
- [ ] Grep for any remaining `supabase`, `telemetry-log`, `telemetry-sync`, `community-dashboard` refs

**JS-011: Global Rename — Templates & Resolvers**
- Rename in `scripts/resolvers/*.ts`: all `gstack` → `jstack`, `~/.gstack/` → `~/.jstack/`
- Rename in `scripts/gen-skill-docs.ts`
- Rename in `SKILL.md.tmpl`
- These are the SOURCE — everything else is generated from them

**JS-012: Global Rename — Shell Scripts**
- Rename `bin/gstack-*` → `bin/jstack-*` (19 files — 4 telemetry scripts already deleted)
- Update all internal references within those scripts
- Update `setup` script: all paths, env vars, binary names
- `$GSTACK_ROOT` → `$JSTACK_ROOT`, `$GSTACK_BIN` → `$JSTACK_BIN`, etc.

**JS-013: Global Rename — TypeScript Source**
- `browse/src/*.ts`: config paths, state file paths, binary references
- `design/src/*.ts`: same pass
- `package.json`: name, description, script names

**JS-014: Global Rename — Documentation**
- `README.md`: full rewrite (placeholder for now — real README in Sprint 4)
- `ETHOS.md`: keep principles, remove YC/Garry framing
- `CONTRIBUTING.md`: update for jstack
- `ARCHITECTURE.md`: update paths and names
- `CLAUDE.md`: update
- `docs/skills.md`: update all skill references

**JS-015: Regenerate All Skill Docs**
- Run `bun run gen:skill-docs` to regenerate all 34 SKILL.md files from cleaned templates
- Verify output: grep for any remaining "gstack" in generated files
- Verify: `~/.gstack` should not appear anywhere except CHANGELOG.md

**JS-016: Rebrand /office-hours → /brainstorm**
- Rename directory: `office-hours/` → `brainstorm/`
- Update SKILL.md.tmpl: remove YC partner framing, keep 6 forcing questions
- Remove Phase 6 closing sequence (Garry's plea, YC application links, founder resources)
- Rename "Startup mode" → keep as-is (it's useful), remove "YC-style" references
- Update `scripts/gen-skill-docs.ts` for new directory name

**JS-017: Setup Script — Add jstack Hosts**
- Add `cursor` as a host type: `--host cursor`
- Update auto-detection logic
- Create `~/.jstack/` config directory instead of `~/.gstack/`
- Add migration: if `~/.gstack/` exists, offer to migrate config/learnings

**JS-017a: Remove Compiled Binaries from Git Tracking**
- `git rm --cached browse/dist/ design/dist/` — stop tracking the ~58MB Mach-O binaries
- Verify `.gitignore` covers them (it already should)
- This is the right time: before jstack's first commit, not after 50 commits of bloat

**JS-017b: Fresh CHANGELOG + VERSION for jstack**
- Start a fresh CHANGELOG.md — jstack's history begins at v0.1.0, not gstack's v0.15.1
- Keep a one-line credit: "jstack is a fork of [gstack](https://github.com/garrytan/gstack) v0.15.1"
- Set VERSION to 0.1.0
- Decision: do NOT carry over gstack's CHANGELOG entries — they reference gstack features, YC, Garry's voice

**JS-017c: Slim the Preamble**
- The preamble bash block runs ~40 lines / 8+ external commands on every skill invocation (AUDIT 9.5)
- Telemetry removal (JS-010) handles part of this, but session tracking, learnings search, routing detection, and update check remain
- Make non-essential preamble sections opt-in per skill via `preambleTier`
- Goal: tier 1 preamble should be <15 lines of shell, <4 external commands

**JS-018: Verify & Test**
- Run `./setup` end-to-end
- Run existing E2E tests: `bun test`
- Smoke test 5 core skills manually: `/browse`, `/qa`, `/review`, `/ship`, `/brainstorm`
- Verify browse daemon starts and responds

**JS-019: License & Attribution**
- Preserve original LICENSE with Garry Tan copyright
- Add joethorngren copyright for jstack additions
- Add "Based on gstack" credit in README
- Create `UPSTREAM-RENAME-MAP.md` documenting all renamed paths

### Exit Criteria
- [ ] `grep -r "gstack" . | grep -v CHANGELOG | grep -v .git | grep -v node_modules | grep -v AUDIT | grep -v UPSTREAM-RENAME-MAP` returns nothing
- [ ] `grep -r "supabase\|telemetry-sync\|installation-id" .` returns nothing
- [ ] `./setup` completes successfully
- [ ] `bun test` passes
- [ ] 5 core skills load and function
- [ ] First commit: `git commit -m "feat: jstack v0.1.0 — fork of gstack, zero telemetry, clean brand"`

---

## Sprint 2: Agent Roster & Skill Ports

**Goal:** The curated team is assembled and ready.

### Tickets

**JS-020: Define Agent Roster & Personas**
- Write persona docs for each agent (name, role, voice, expertise, when to invoke)
- Core roster:
  - **Caleb** — Sprint Master (sprint planning, backlog grooming, ceremony facilitation)
  - **Reza** — Architect/Reviewer (PR reviews, system design, trade-off analysis)
  - **Michael** — Docs Maestro (documentation, changelogs, sprint reports)
  - **Mr. Robot** — Security (pen testing, OWASP, dependency audit, secrets scan)
  - **Chi** — UX/Design (design reviews, accessibility, user experience)
  - **Adam** — Edge Case Hunter (testing, coverage gaps, QA)
  - **Legal** — Consolidated legal auditor (multi-model: Claude + Gemini + Codex → synthesis)
- **Architecture decision (from Sprint 0):** These are Claude Code agents (`.claude/agents/*.md`)
  that can also be invoked as sub-agents from jstack skills. For Cursor: expose as prompt
  templates in `.cursor/rules/` or via MCP tool delegation (per Sprint 0 research findings).
- For each: write the agent definition with frontmatter (name, description, model, tools)

**JS-022: Build /legal-audit Skill**
- Consolidate Zuckerkorn + Loblaw + Jarvis into one `/legal-audit` skill
- The skill spawns 3 sub-agents (one per model), then synthesizes
- Output: unified legal audit report with consensus grades
- Graceful degradation: if Codex CLI or Gemini CLI is unavailable, run with available models
- Prerequisite: Codex CLI (`codex`) and Gemini CLI (`gemini`) installed and authed
- Test with a sample project

**JS-023: Build /black-hat Skill**
- Enhance existing `/cso` into an adversarial security phase
- Not just a checklist — actively attempt exploitation
- Pen test, dependency audit, secrets archaeology, injection testing
- Test with a sample project

**JS-024: Build /testing-philosophy Skill**
- Codify testing principles: integration > unit, real DB > mocks, test behavior not implementation
- Enforceable during code review — flags violations
- 80% coverage minimum gate

**JS-025: Generate Caricature Avatars**
- Use Nano Banana 2 to generate caricature avatars for each agent
- Consistent style across all 7 agents (6 roster + Legal)
- Electric blue accent color
- Save to `docs/agents/avatars/`

### Exit Criteria
- [ ] 7 agent definitions load and function (6 roster + consolidated Legal)
- [ ] /legal-audit, /black-hat, /testing-philosophy functional
- [ ] Avatars generated for all agents

---

## Sprint 3: War Room + Fork Template

**Goal:** The two flagship features that make jstack unique.

### Tickets

**JS-030: Build /war-room Skill**
- Single skill that runs a review across 3 models in parallel
- Model targets: Claude (native), Codex (`codex exec`), Gemini (`gemini` CLI)
- Each model reviews the same scope (diff, plan, or full codebase)
- Deduplication: match findings by file + line + category
- Consensus report: findings agreed by 2+ models = CONFIRMED, unique finds = HIGH-VALUE SURPRISE
- Output format matches the existing multi-model audit pattern from Word Freak Sprint 15
- Graceful degradation: if a model is unavailable, run with remaining models

**JS-031: Build `jstack init --company` Command**
- Shell script (or Bun binary) that:
  1. Prompts for company name
  2. Forks jstack repo on GitHub (`gh repo fork joethorngren/jstack --fork-name {company}-stack`)
  3. Clones the fork locally
  4. Runs global rename: `jstack` → `{company}-stack`
  5. Creates placeholder directories for company-specific skills
  6. Generates starter DESIGN.md (prompts for brand colors, fonts, tone)
  7. Sets up upstream tracking back to jstack
  8. Generates CLAUDE.md with routing rules
  9. Runs `./setup` to build binaries
- Output: a fully functional {company}-stack repo ready for customization

**JS-032: Design System Hierarchy Documentation**
- Document the three-level design architecture:
  - Toolkit level (jstack): electric blue
  - Company level (RFS, Arity): shared tokens
  - Product level (Word Freak, YPC): per-project DESIGN.md
- How /design-consultation, /design-review, /design-shotgun consume DESIGN.md
- How `jstack init --company` generates the starter DESIGN.md
- Save to `docs/design-system-hierarchy.md`

### Exit Criteria
- [ ] `/war-room` runs successfully with at least 2 models
- [ ] `jstack init --company test-co` produces a working fork
- [ ] Design hierarchy documented

---

## Sprint 4: Cursor Integration + Design Pass

**Goal:** Cursor users can use jstack. The product looks beautiful.

### Tickets

**JS-040: Cursor Integration (based on Sprint 0 research)**
- Implement the chosen integration path (MCP / shell / prompt templates)
- Add `cursor` host to setup script
- Generate `.cursor/rules/` or Cursor-compatible skill format
- Test: invoke 3 skills from within Cursor
- Write "jstack for Cursor Users" onboarding guide

**JS-041: Agent Zero Integration (based on Sprint 0 research)**
- Sprint 0 verdict: DEFER. No AI browser agent can share jstack's Playwright instance.
- Document findings in TODOS.md as a Q3 2026 revisit item
- Highest-leverage alternative: expose browse daemon as MCP server (may overlap with JS-040)
- If MCP is the Cursor integration path, this ticket merges into JS-040

**JS-042: DESIGN.md for jstack**
- Electric blue primary (#0066FF or similar — test a few shades)
- Warm, friendly tone guidelines
- Typography choices
- Logo concept (if time)
- Component patterns for docs/README

**JS-043: Workflow Diagram**
- Create sleek flow diagram: /brainstorm → /plan-ceo-review → Implementation → /qa → /review → /ship → /canary
- Show agent assignments at each stage
- Electric blue + warm palette
- Excalidraw or high-quality SVG
- This is the README hero image

**JS-044: README Rewrite**
- Hero section with workflow diagram
- Agent roster with caricature avatars
- "Install in 30 seconds" callout
- Before/after comparison
- Cursor-first install instructions
- Credits to gstack as upstream

### Exit Criteria
- [ ] Cursor users can install and invoke 3+ skills
- [ ] DESIGN.md complete
- [ ] Workflow diagram rendered
- [ ] README is beautiful and compelling

---

## Sprint 5: Polish, Test & Ship

**Goal:** Post in the Cursor User Group.

### Tickets

**JS-050: End-to-End Testing**
- All skills load (renamed originals + new: /legal-audit, /black-hat, /testing-philosophy, /war-room)
- Browse daemon starts and responds in both Claude Code and Cursor
- /war-room runs with 2+ models
- `jstack init --company` produces working fork
- /brainstorm completes without YC references

**JS-051: Record Demo Video**
- Screen recording: install jstack in Cursor, run /qa on a sample project
- Show the browse daemon finding real bugs
- Show /war-room multi-model consensus
- Show the agent roster
- Keep it under 3 minutes

**JS-052: Cursor User Group Post**
- Write the post (electric blue energy, warm tone)
- Include: what it is, why it exists, install instructions, demo video
- Link to GitHub repo
- Prepare for feedback

**JS-053: Tag v0.1.0 Release**
- `git tag v0.1.0`
- GitHub release with notes
- Clean up any remaining TODOs from sprint work

### Exit Criteria
- [ ] All tests pass
- [ ] Demo video recorded
- [ ] Posted in Cursor User Group
- [ ] v0.1.0 tagged

---

---

# v1.5 Sprints — Research, Skinning, Marketplace

---

## Sprint 6: Research MCP Server + /research Skill

**Goal:** Cross-project research discovery. Any agent in any IDE can find and use prior research.

### Tickets

**JS-060: Build jstack-research MCP Server**
- stdio MCP server (same pattern as jstack-browse) with 4 tools:
  - `research_search` — keyword/tag search across the registry
  - `research_read` — read a research file by reference (cross-project)
  - `research_list` — browse by tag, project, or date
  - `research_create` — register a new research file in the index
- Registry: `~/.jstack/research-index.jsonl` (append-only, latest-wins dedup by path)
- Each entry: `{ path, project, tags[], title, date, summary, format }`

**JS-061: Build /research Skill**
- Template for structured teardowns following Joe's existing Research/CLAUDE.md pattern:
  1. Spin up 3 deep-researcher agents in parallel (product deep-dive, competitive landscape, domain expertise)
  2. Each agent saves a report in `docs/research/{topic}/`
  3. Synthesis agent reads all reports, produces README.md with TL;DR decision matrix
  4. Cross-reference: add `## Related Research` section with bidirectional links
- Output format: Obsidian-compatible (YAML frontmatter with tags, `[[wiki-links]]`)
- Auto-registers in jstack-research MCP server registry

**JS-062: Integrate Research into /brainstorm**
- Before CEO review, `/brainstorm` checks research registry for relevant prior work
- Surfaces: "Found 3 related research files across 2 projects" with summaries
- User can pull them into the current project or just reference them

**JS-063: Add jstack-research to Cursor Setup**
- Add to `.cursor/mcp.json` during `setup --cursor`
- Add to MCP marketplace manifest (prerequisite for Sprint 8)

### Exit Criteria
- [ ] `research_search "spaced repetition"` returns results from any project
- [ ] `/research teardown "Duolingo"` produces structured output in docs/research/
- [ ] Research files are Obsidian-compatible (open in Obsidian, links work)
- [ ] `/brainstorm` surfaces relevant prior research automatically

---

## Sprint 7: Agentic Org Skinning

**Goal:** `jstack init --company` becomes a guided, agentic onboarding experience.

### Tickets

**JS-070: Org Context Folder Structure**
- Define `docs/org/` as the host-agnostic home for company context
- Template files: `overview.md`, `tech-stack.md`, `products.md`, `brand.md`, `culture.md`, `legal.md`
- Each file: short, single-purpose, YAML frontmatter with tags
- gen-skill-docs translates `docs/org/` → host-specific format (.mdc rules, AGENTS.md sections)
- Test: generate .mdc rules from Arity's existing research as proof of concept

**JS-071: Agentic Company Discovery**
- During `jstack init --company <name>`:
  1. Web search for company name → find website, LinkedIn, Glassdoor
  2. Browse company website (via browse MCP) → extract brand colors, logo, typography
  3. Deduce: tech stack (from job postings), products (from product pages), culture (from about page)
  4. Present findings: "Here's what we found about {company}"
  5. Ask: "Do you have an existing design system?" → validate against web findings
- Output: populated `docs/org/` folder with discovered context

**JS-072: Import Existing Assets**
- `jstack init --company --import ~/Research/arity-company-research/`
- Reads existing research files, reformats to `docs/org/` structure
- Registers in research MCP server index
- Handles: markdown files, component library docs, design system docs

**JS-073: Guided Creation for New Orgs**
- If no existing assets: walk through creating each `docs/org/` file interactively
- "Tell me about your company" → generates `overview.md`
- "What's your tech stack?" → generates `tech-stack.md`
- "Do you have brand guidelines?" → if no, runs /design-consultation
- Result: complete `docs/org/` folder from a conversation

### Exit Criteria
- [ ] `jstack init --company arity` produces a fork with populated `docs/org/`
- [ ] Web discovery finds Arity's brand colors, products, and tech stack
- [ ] Import flow handles Joe's existing 20+ Arity research files
- [ ] New-org flow creates `docs/org/` from interactive Q&A

---

## Sprint 8: MCP Marketplace + Arity Deployment

**Goal:** First real org deployment. Plugin system for MCP servers.

### Tickets

**JS-080: MCP Marketplace Registry**
- `~/.jstack/marketplace.yaml` — registry of available MCP servers
- Each entry: name, description, command, args, tool_count, category, enabled
- Built-in servers: jstack-browse (10 tools), jstack-research (4 tools)
- Org servers: added during `jstack init --company`

**JS-081: MCP CLI Commands**
- `jstack mcp list` — show all available servers with tool counts
- `jstack mcp add <name>` — add server to current project's `.cursor/mcp.json`
- `jstack mcp remove <name>` — remove server
- `jstack mcp budget` — show tool usage: "14/40 tools active"
- Warning when approaching Cursor's ~40 tool limit

**JS-082: Setup Picker UI**
- During `jstack setup --cursor`, present a checkbox picker:
  ```
  Available MCP servers:
    [x] jstack-browse    (10 tools)  headless browser
    [x] jstack-research   (4 tools)  cross-project research
    [ ] gmail              (5 tools)  Gmail automation
    Tool budget: 14/40
  ```
- Writes selected servers to `.cursor/mcp.json`

**JS-083: Arity Fork — First Real Deployment**
- Run `jstack init --company arity` end-to-end
- Import all existing Arity research (3 repos, 20+ files)
- Validate: agents know Arity's business, tech stack, brand, legal landscape
- Test: spin up a new project within the Arity fork, verify org context loads
- Document: what worked, what didn't, what to improve

**JS-084: Arity-Specific MCP Servers**
- Identify which of Joe's existing MCP servers should be in the Arity marketplace
- Create manifests for each (name, tool count, install command)
- Test: `jstack mcp add <arity-server>` works in Cursor

### Exit Criteria
- [ ] `jstack mcp list` shows available servers with tool counts
- [ ] `jstack mcp budget` tracks usage against Cursor's limit
- [ ] Arity fork exists with populated `docs/org/` and marketplace
- [ ] At least 1 Arity-specific MCP server in the marketplace

---

## Sprint 9: Testing Opinions + Model Agnosticism

**Goal:** jstack has strong opinions about testing. Multi-model support is first-class.

### Tickets

**JS-090: Opinionated Testing Framework**
- Expand /testing-philosophy from "principles" to "enforcement"
- Integration tests > unit tests (real DB, not mocks)
- 80% coverage minimum gate in /review and /ship
- Test behavior, not implementation
- Auto-detect test runner from project config (jest, vitest, pytest, go test)

**JS-091: Model-Agnostic Skill Architecture**
- Audit all skills for Claude Code-specific assumptions
- Ensure every skill works in Cursor (via .mdc) and Codex (via AGENTS.md)
- Document: "which skills work in which hosts" matrix
- Goal: 100% of core workflow skills work in Cursor-only mode

**JS-092: Gemini CLI Integration**
- Add Gemini as a first-class host (like codex, factory)
- gen-skill-docs emits Gemini-compatible format
- /war-room and /legal-audit use all three models when available
- Graceful degradation: works with any 1 of 3

**JS-093: Multi-Model Research**
- /research skill uses multiple models for teardowns (not just Claude)
- Each model agent covers a different angle (same pattern as /war-room)
- Synthesis combines findings with consensus scoring

### Exit Criteria
- [ ] /review enforces 80% coverage gate
- [ ] All core skills work in Cursor-only mode
- [ ] /war-room works with any combination of available models
- [ ] /research uses multi-model teardown when models are available

---

## Sprint 10: Polish + Ship v1.5

**Goal:** Tag v1.5.0, share with Arity team.

### Tickets

**JS-100: End-to-End Regression**
- All v0.1.0 skills still work
- Research MCP server functional
- Org skinning works for fresh and existing companies
- MCP marketplace picks servers correctly
- Arity fork is production-quality

**JS-101: Arity Onboarding Guide**
- Step-by-step for Arity developers (Cursor-only)
- Install jstack, setup Cursor, pick MCP servers
- "Your first /qa session" walkthrough
- "Your first /research teardown" walkthrough

**JS-102: Demo + Share**
- Updated demo video showing research + org skinning
- Share with Arity Cursor User Group
- Collect feedback

**JS-103: Tag v1.5.0**
- GitHub release
- CHANGELOG update
- Upstream sync: ensure gstack changes are merged

### Exit Criteria
- [ ] v1.5.0 tagged
- [ ] Arity team using jstack in Cursor
- [ ] Feedback collected and triaged for v2.0

---

## Full Sprint Dependency Graph

```
v0.1.0 Track
═══════════
Sprint 0 (Research)
    │
    ├──► Sprint 1 (Rename + Nuke)
    │        │
    │        ├──► Sprint 2 (Agents + Skills)
    │        │        │
    │        │        └──► Sprint 3 (War Room + Fork Template)
    │        │                 │
    │        └─────────────────┤
    │                          │
    │                    Sprint 4 (Cursor + Design) ✓
    │                          │
    │                    Sprint 5 (Polish + Ship v0.1.0)
    │
    └──► Sprint 4 (Cursor research feeds directly into integration)

v1.5 Track
══════════
Sprint 5 (Ship v0.1.0)
    │
    ├──► Sprint 6 (Research MCP + /research)
    │        │
    │        └──► Sprint 7 (Agentic Org Skinning)
    │                 │
    │                 └──► Sprint 8 (Marketplace + Arity Deploy)
    │
    ├──► Sprint 9 (Testing + Model Agnosticism)  ←── independent track
    │
    └──► Sprint 10 (Polish + Ship v1.5)
```

Sprints 6-7-8 are a dependency chain (research → skinning → marketplace).
Sprint 9 is independent and can overlap with 7 or 8.
Sprint 10 waits for everything.

Sprint 0 unblocks everything. Sprints 2 and 3 can partially overlap.
Sprint 4 depends on both Sprint 1 (working rename) and Sprint 0 (Cursor research).
