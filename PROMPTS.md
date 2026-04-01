# jstack Prompt Packs

Copy-paste session starters for each sprint. Open a new CC session in
`~/Code_Complete/jstack/`, paste the prompt, and go.

---

## Sprint 0: Research Spikes

```
I'm building jstack — a fork of gstack (garrytan/gstack) that adds Cursor IDE support
as the #1 differentiator. Before I start coding, I need to answer two unknowns.

Please research these three things and write findings to docs/research/:

1. **Cursor Agent/MCP Capabilities** (docs/research/cursor-capabilities.md)
   - Can Cursor's agent mode invoke external shell commands?
   - Does Cursor support MCP (Model Context Protocol) servers?
   - Can Cursor call external binaries from agent/composer mode?
   - How do .cursorrules work? Can they reference external tools?
   - What's the current state of Cursor's tool/plugin system?
   - Build a capabilities matrix: feature × supported/unsupported/partial

2. **Agent Zero / Browser-Use** (docs/research/agent-zero-browser-capabilities.md)
   - Is Agent Zero (github.com/frdel/agent-zero) Docker-only or does it have MCP/standalone mode?
   - Also check browser-use (github.com/browser-use/browser-use) — similar concept
   - How would either complement a Playwright-based headless browser daemon?
   - What's the setup complexity for end users?
   - Feasibility assessment: can we ship this to Cursor User Group members?

3. **Cursor User Group Recon** (docs/research/cursor-community.md)
   - What are the most common asks/pain points in the Cursor community?
   - What .cursorrules repos are being shared? What patterns work?
   - What's the install friction tolerance for this audience?

4. **Agents vs Skills Architecture Decision**
   - The agent roster (Caleb, Reza, etc.) needs an architecture: are they Claude Code
     agents (.claude/agents/*.md), jstack skills (SKILL.md invoked via /command), or both?
   - For Claude Code: agents are natural (sub-process with persona/voice)
   - For Cursor: agents can't exist natively yet — need MCP tools, prompt templates, or sub-agent pattern
   - Document the pattern so Sprint 2 can execute without ambiguity

Use deep-researcher agents for all three in parallel. Save findings to docs/research/.
After research completes, write the architecture decision to docs/research/architecture-decision.md.
```

---

## Sprint 1: Telemetry Nuke + Core Rename

```
I'm working on jstack (~/Code_Complete/jstack/) — a fork of gstack. The CEO plan,
design doc, and codebase audit are at:
- Design: ~/.gstack/projects/joethorngren-jstack/oh_henry-main-design-20260401-120000.md
- CEO plan: ~/.gstack/projects/joethorngren-jstack/ceo-plans/2026-04-01-jstack-fork.md
- Audit: ./AUDIT.md
- Sprints: ./SPRINTS.md

Read those files first. Then execute Sprint 1 from SPRINTS.md:

1. **Complete telemetry removal**: supabase/ and telemetry scripts are already deleted.
   Now clean scripts/resolvers/preamble.ts — remove all remote telemetry blocks and
   the telemetry opt-in prompts. Keep local JSONL analytics only. Remove installation-id
   generation from setup. Replace remote update-check with local git-based version check.

2. **Global rename gstack → jstack**: Start with the templates and resolvers
   (scripts/resolvers/*.ts, scripts/gen-skill-docs.ts, SKILL.md.tmpl) — these are
   the SOURCE. Then shell scripts (bin/gstack-* → bin/jstack-*, 19 files), then
   TypeScript source (browse/src/, design/src/), then docs. ~/.gstack/ → ~/.jstack/
   everywhere.

3. **Rebrand /office-hours → /brainstorm**: Rename directory, remove YC partner
   framing and Phase 6 closing (Garry's plea, YC links, founder resources). Keep the
   6 forcing questions — they're excellent.

4. **Remove compiled binaries from git tracking**: `git rm --cached browse/dist/
   design/dist/` — stop tracking the ~58MB Mach-O binaries before jstack's first commit.

5. **Fresh CHANGELOG + VERSION**: Start a clean CHANGELOG.md for jstack v0.1.0.
   Do NOT carry over gstack's entries — they reference gstack features and Garry's voice.
   One-line credit: "jstack is a fork of gstack v0.15.1". Set VERSION to 0.1.0.

6. **Slim the preamble**: JS-010 removes telemetry, but the preamble still runs ~8
   external commands. Make non-essential sections (learnings search, routing detection)
   opt-in per preambleTier. Tier 1 should be <15 lines, <4 commands.

7. **Regenerate all skill docs**: bun run gen:skill-docs

8. **Verify**: grep for any remaining "gstack" (excluding CHANGELOG credit line,
   UPSTREAM-RENAME-MAP.md, AUDIT.md), run tests, smoke test 5 core skills.

9. **License**: Keep original LICENSE, add joethorngren copyright, create
   UPSTREAM-RENAME-MAP.md.

Sprint 1 exit criteria: zero "gstack" refs outside CHANGELOG/AUDIT/UPSTREAM-RENAME-MAP,
./setup works, bun test passes, 5 skills functional. Commit as "feat: jstack v0.1.0".
```

---

## Sprint 2: Agent Roster & Skill Ports

```
I'm working on jstack (~/Code_Complete/jstack/). Read SPRINTS.md for full context.

Execute Sprint 2 — build the curated agent roster and new skills.

**Agent Roster** — create skill files for each agent in the jstack skill format
(YAML frontmatter, allowed-tools, voice instructions). Each agent needs:
- A clear persona and voice
- Specific expertise and when to invoke
- Allowed tools scoped to their role

The core roster:
1. **Caleb** (Sprint Master) — sprint planning, backlog grooming, ceremonies
2. **Reza** (Architect) — PR reviews, system design, trade-off analysis
3. **Michael** (Docs Maestro) — documentation, changelogs, sprint reports
4. **Mr. Robot** (Security) — pen testing, OWASP, dependency audit, secrets
5. **Chi** (UX/Design) — design reviews, accessibility, user experience
6. **Adam** (Edge Case Hunter) — testing, coverage gaps, QA

The user is the product owner/builder. Agents are the team.

**Architecture (from Sprint 0 research):** Read docs/research/architecture-decision.md
for the agents-vs-skills pattern. In Claude Code, these are agents (.claude/agents/*.md).
For Cursor, use whatever integration path Sprint 0 determined (MCP / rules / templates).

**New Skills:**
- /legal-audit — consolidate 3 legal auditor agents into one skill that spawns
  sub-agents across Claude + Gemini + Codex, then synthesizes a consensus report.
  Graceful degradation: if a model CLI is unavailable, run with remaining models.
  **Prerequisite:** Codex CLI (`codex`) and Gemini CLI (`gemini`) installed.
- /black-hat — adversarial security phase, enhances /cso with active exploitation
- /testing-philosophy — Joe's testing principles as enforceable review rules

Also generate caricature avatars for each agent using Nano Banana 2 (or note
that for a design session if the MCP isn't available).
```

---

## Sprint 3: War Room + Fork Template

```
I'm working on jstack (~/Code_Complete/jstack/). Read SPRINTS.md for full context.

Execute Sprint 3 — the two flagship features.

**1. /war-room skill**
Build a single skill that runs code review across 3 models in parallel:
- Claude (native — the host model)
- Codex (via `codex exec`)
- Gemini (via `gemini` CLI)

Each model reviews the same scope. Then deduplicate findings:
- Match by file + line number + category
- Findings from 2+ models = CONFIRMED (consensus)
- Findings from 1 model only = HIGH-VALUE SURPRISE (unique find)
- Output a formatted consensus report

Reference: Word Freak Sprint 15 multi-model audit in ~/Research/scrabble-ai/README.md
(the "Multi-Model Auditing" section) for the output format we want.

Graceful degradation: if a model CLI isn't installed or errors, run with remaining models.
**Prerequisite:** Codex CLI (`codex`) and Gemini CLI (`gemini`) installed and authed.

**2. jstack init --company command**
Build a shell script (bin/jstack-init) that:
1. Prompts for company name
2. Forks jstack on GitHub: gh repo fork joethorngren/jstack --fork-name {company}-stack
3. Clones locally
4. Runs global rename: jstack → {company}-stack
5. Creates company skill directories
6. Generates starter DESIGN.md (asks for brand colors, fonts, tone)
7. Sets up upstream tracking to jstack
8. Runs ./setup

Test with: jstack init --company test-co (then clean up the test repo after)

**3. Design hierarchy docs**
Document the three-level design system (toolkit / company / product) at
docs/design-system-hierarchy.md.
```

---

## Sprint 4: Cursor Integration + Design Pass

```
I'm working on jstack (~/Code_Complete/jstack/). Read SPRINTS.md and
docs/research/cursor-capabilities.md for the research findings.

Execute Sprint 4 — Cursor integration and the design pass.

**Cursor Integration:**
Based on the Sprint 0 research, implement Cursor support. The research doc
at docs/research/cursor-capabilities.md has the capabilities matrix and
architecture decision. Implement the chosen path:
- If MCP: expose jstack as an MCP server
- If shell: generate .cursor/rules/ that invoke jstack CLI
- If prompt templates: generate .cursorrules with skill knowledge
Add `cursor` as a host in the setup script. Write an onboarding guide.

**Agent Zero Integration:**
Check docs/research/agent-zero-browser-capabilities.md. Sprint 0 research verdict was DEFER —
none of the AI browser agents (Agent Zero, browser-use, Stagehand) can share jstack's
Playwright browser instance. Claude IS the AI agent; jstack IS the executor.
Highest-leverage move: expose browse daemon as MCP server (may already be the Cursor
integration path). Skip /agent-browse for v0.1.0. Revisit in Q3 2026.

**Design Pass:**
1. Create DESIGN.md — electric blue primary, warm/friendly tone, typography.
   The vibe: technical credibility + "anyone can ship like a beast."
   Think t3.gg energy. Not cold corporate, not hacker-bro.

2. Create the workflow diagram (Excalidraw MCP or SVG):
   /brainstorm → /plan-ceo-review → Implementation → /qa → /review → /ship → /canary
   Show agent assignments at each stage. Electric blue + warm palette.
   This is the README hero image.

3. Rewrite README.md:
   - Hero section with workflow diagram
   - Agent roster with avatars
   - "Install in 30 seconds"
   - Before/after comparison
   - Cursor-first install instructions
   - Credits to gstack

IMPORTANT Excalidraw rule: NEVER use the `label` property on shapes or arrows.
Create separate text elements centered inside shapes instead.
```

---

## Sprint 5: Polish & Ship

```
I'm working on jstack (~/Code_Complete/jstack/). Read SPRINTS.md for full context.

Execute Sprint 5 — final polish and ship to the Cursor User Group.

1. **End-to-end testing**: All skills load. Browse daemon works. /war-room runs.
   jstack init --company works. /brainstorm has no YC references. Test in both
   Claude Code and Cursor.

2. **Demo video script**: Write a script for a <3 minute screen recording showing:
   - Install jstack in Cursor (30 sec)
   - Run /qa on a sample project — browse daemon finds real bugs (60 sec)
   - Run /war-room — multi-model consensus (45 sec)
   - Show the agent roster (15 sec)
   - "Fork it for your company" (15 sec)

3. **Cursor User Group post**: Write the post. Electric blue energy, warm tone.
   What it is, why it exists, install instructions, demo video link.
   Make someone stop scrolling.

4. **Tag v0.1.0**: git tag, GitHub release with notes. Clean up remaining TODOs.
```

---

## Quick Reference: Session Startup

Every session in the jstack repo, start by reading context:

```
Read these files to get up to speed on jstack:
- ./SPRINTS.md (sprint plan and tickets)
- ./AUDIT.md (codebase audit findings)
- ~/.gstack/projects/joethorngren-jstack/oh_henry-main-design-20260401-120000.md (design doc)
- ~/.gstack/projects/joethorngren-jstack/ceo-plans/2026-04-01-jstack-fork.md (CEO plan)

Then check: git log --oneline -10 and git status to see current state.
```
