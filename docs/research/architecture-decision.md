# Architecture Decision Record: jstack Integration Strategy

**Date:** 2026-04-01
**Status:** DECIDED
**Decision makers:** Joe Thorngren + Sprint 0 research synthesis

---

## Context

jstack is a fork of gstack that needs to support two hosts:
1. **Claude Code** (existing, works today via SKILL.md + `~/.claude/skills/`)
2. **Cursor** (new, the #1 differentiator for jstack)

Three research spikes informed this decision:
- `cursor-capabilities.md` — Cursor's agent, MCP, and rules capabilities
- `agent-zero-browser-capabilities.md` — AI browser agent feasibility
- `cursor-community.md` — Community pain points and ecosystem analysis

---

## Decision: Hybrid MCP + Rules (Path D)

### For the Browse Daemon: MCP Server

Expose jstack's browse daemon as an **stdio MCP server** with 7 typed tools:
`goto`, `click`, `type`, `screenshot`, `snapshot`, `diff`, `assert`

**Why MCP for browse:**
- Cursor has native MCP support (since late 2024), configured via `.cursor/mcp.json`
- Typed tools with schemas > shell commands that agents might hallucinate arguments for
- Portable: works in Cursor, Windsurf, VS Code + Continue.dev, any MCP-compatible host
- Replaces the "expose browse as MCP" recommendation from the Agent Zero research
- Stays within the ~40 tool soft limit (7 tools is well under)

**Implementation:** `jstack mcp-serve` command that wraps the existing browse HTTP API
as stdio MCP. The browse daemon architecture stays unchanged — MCP is a transport
adapter, not a rewrite.

### For Workflow Skills: .mdc Rules

Generate Cursor-compatible `.cursor/rules/jstack-*.mdc` files from the same `.tmpl`
templates that produce SKILL.md files.

**Why .mdc for skills:**
- `.cursor/rules/*.mdc` is Cursor's native format (Markdown + YAML frontmatter)
- Skills are prompt documents — they instruct the agent what to do
- .mdc files need to be **condensed** (<500 lines vs SKILL.md's 1500-2000 lines)
- The `gen-skill-docs.ts` pipeline already supports multi-host output; adding .mdc is
  a new output target, not a new architecture

**Key constraint:** Cursor has NO global `~/.cursor/rules/` directory. Rules are
per-project only. `jstack setup --cursor` must write rules into the current project's
`.cursor/rules/` directory — different from Claude Code's global `~/.claude/skills/`.

### For the Agent Roster: Claude Code Agents + Cursor MCP Delegation

**In Claude Code:** Agents are `.claude/agents/*.md` files with frontmatter (name,
description, model, tools). They're invoked via the Agent tool as sub-processes with
full persona and voice. This is the native, first-class experience.

**In Cursor:** Cursor has no equivalent of Claude Code's agent system. Instead:
1. Agent personas live in `.cursor/rules/jstack-agent-*.mdc` as rules the agent adopts
2. Complex multi-agent workflows (like /legal-audit spawning 3 model sub-agents) use
   shell commands via the browse daemon's agent spawning capability
3. The user invokes agents by name in Composer: "Use the Mr. Robot agent to review this"
4. The .mdc rule gives Cursor the persona, expertise scope, and tool permissions

**Migration path:** When Cursor ships native agent support (expected but unscheduled),
migrate from .mdc rules to native agents. The persona content transfers directly.

---

## What We're NOT Doing

### Agent Zero / AI Browser Agents: DEFERRED (Q3 2026)
- No AI browser agent (Agent Zero, browser-use, Stagehand) can share jstack's Playwright
  browser instance — each creates a separate Chromium process
- Claude IS the AI agent; jstack IS the executor
- The MCP server gives any LLM structured browser access without a second process
- Revisit when: Stagehand's MCP story matures, "connect to existing browser" patterns
  emerge in the ecosystem

### Cursor Extension/Plugin API: SKIP
- Cursor's extension system is immature and unverifiable
- Do NOT build on Cursor-specific extension APIs
- MCP is the stable, portable integration surface

---

## Implementation Plan (Sprint 4)

| Phase | Days | What |
|-------|------|------|
| 1 | 1-3 | Build `jstack mcp-serve` — stdio MCP server wrapping browse daemon (7 tools) |
| 2 | 3-5 | Extend `gen-skill-docs.ts` to emit `.mdc` format with condensation logic |
| 3 | 5-6 | Build `jstack setup --cursor` — writes `.cursor/mcp.json` + copies `.mdc` rules |

### Setup Flow for Cursor Users
```
git clone https://github.com/joethorngren/jstack
cd jstack && ./setup --host cursor
cd ~/my-project && jstack setup --cursor
# Creates .cursor/mcp.json (browse MCP) + .cursor/rules/jstack-*.mdc (skills)
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Dual-format maintenance (SKILL.md + .mdc) | Template drift | Single source of truth (.tmpl), two output targets |
| .mdc condensation loses important instructions | Degraded Cursor experience | Test each skill in Cursor after condensation |
| ~40 tool limit across all MCP servers | Crowded tool namespace | jstack uses only 7 tools, well under limit |
| Cursor ignores .mdc rules (community pain point) | Skills don't work | Keep rules short (<500 lines), delegate complexity to MCP tools |
| No global rules in Cursor | Per-project install friction | `jstack setup --cursor` automates it; document clearly |

---

## Decision Gate: PASSED

Cursor CAN invoke external tools via multiple paths (MCP, shell commands, rules).
jstack ships with full Cursor support. The "Claude Code-first, Cursor v2" fallback
is NOT needed.

---

## Sources

- Cursor capabilities research: `docs/research/cursor-capabilities.md`
- Agent Zero browser research: `docs/research/agent-zero-browser-capabilities.md`
- Community reconnaissance: `docs/research/cursor-community.md`
