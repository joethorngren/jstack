# Cursor IDE Agent/MCP Capabilities Matrix

**Date:** April 1, 2026
**Research Method:** Tier 1 (Gemini Quick Query x9) with cross-referencing and hallucination verification
**Purpose:** Inform jstack's Cursor integration architecture
**Companion:** See `cursor-community.md` for community pain points and positioning strategy

---

## Research Question

What are Cursor IDE's exact agent, MCP, rules, and extension capabilities as of
April 2026, and which integration path should jstack use to expose its headless
browser daemon and skill framework to Cursor's Agent Mode?

## Confidence Framework

Research on Cursor is complicated by several factors:

1. **Cursor evolves weekly** -- features ship in minor releases with minimal changelogs
2. **No stable public docs** -- Cursor's documentation is sparse; community forums are the source of truth
3. **Gemini hallucinates Cursor details** -- multiple queries returned plausible but unverifiable claims (specific version numbers, internal protocol names, exact limits). These are flagged below.
4. **Post-training knowledge gap** -- my training data cuts off May 2025; Gemini fills the gap but requires triangulation

Confidence levels:
- **HIGH** = Consistent across 3+ sources, aligns with pre-2025 architecture
- **MEDIUM** = Consistent across 2 sources, plausible but not independently verified
- **LOW** = Single source or Gemini-only claim, may be hallucinated

---

## 1. Cursor Agent Mode (Composer Agent)

### Shell Command Execution

| Capability | Status | Confidence | Notes |
|:-----------|:-------|:-----------|:------|
| Execute arbitrary shell commands | YES | HIGH | Via `run_terminal_command` tool |
| Read stdout/stderr from commands | YES | HIGH | Agent uses output for self-correction loops |
| User confirmation before execution | YES (default) | HIGH | Requires "Run" click in normal mode |
| YOLO Mode (auto-execute) | YES | HIGH | Official feature in Settings > Features |
| YOLO allowlist/denylist for commands | YES | MEDIUM | Reported in multiple sources; prevents `rm -rf`, `git push` |
| Interactive CLI prompts (`y/n`) | NO | HIGH | Agent cannot handle interactive input |
| Long-running blocking commands | PARTIAL | HIGH | Community pain point #6 -- `npm start` blocks agent |
| Background/cloud agent execution | YES | MEDIUM | Background Agents launched mid-2025; run in cloud sandboxes |
| Parallel agent execution | YES | MEDIUM | Up to 8 parallel agents in isolated Git worktrees |
| Command timeout | ~120s default | LOW | Various sources say 30-120s; not definitively documented |

### Built-in Agent Tools

These are the tools Cursor's Agent can call natively (without MCP):

| Tool Name | Function | Confidence |
|:----------|:---------|:-----------|
| `run_terminal_command` | Execute shell commands, read output | HIGH |
| `read_file` | Read file contents (supports line ranges) | HIGH |
| `edit_file` | Apply diffs or rewrites to files | HIGH |
| `create_file` | Create new files | HIGH |
| `delete_file` | Delete files (with confirmation) | HIGH |
| `list_dir` | List directory contents | HIGH |
| `file_search` | Fuzzy file name search | HIGH |
| `grep_search` | Regex pattern search (ripgrep-like) | HIGH |
| `codebase_search` | Semantic/vector search across codebase | HIGH |
| `ask_user` | Request human-in-the-loop input | MEDIUM |

**Key finding:** The `run_terminal_command` tool means Cursor's Agent can already
invoke `jstack browse goto https://example.com` directly -- no MCP wrapper needed.
The question is whether MCP provides better reliability and structured output.

### Models Available in Agent Mode

| Model | Availability | Confidence |
|:------|:-------------|:-----------|
| Claude Sonnet 4.6 | Default for most tasks | HIGH |
| Claude Opus 4.6 | Via "Max Mode" or model picker | MEDIUM |
| GPT-4o / GPT-5.x | Available in model picker | MEDIUM |
| Gemini 2.5 Pro | Available in model picker | MEDIUM |
| Cursor Auto | Proprietary routing across models | MEDIUM |
| Cursor's custom models | Fast models for autocomplete/simple tasks | MEDIUM |

---

## 2. MCP (Model Context Protocol) Support

### Core MCP Capabilities

| Capability | Status | Confidence | Notes |
|:-----------|:-------|:-----------|:------|
| Native MCP support | YES | HIGH | Since ~v0.43 (late 2024) |
| MCP tools visible in Agent Mode | YES | HIGH | Agent auto-discovers registered tools |
| MCP tools in Normal/Chat mode | NO | HIGH | Agent Mode required for tool calling |
| stdio transport | YES | HIGH | Most common for local CLI tools |
| SSE transport | YES | HIGH | For persistent web-based servers |
| Streamable HTTP transport | YES | MEDIUM | Newer standard; transitioning from SSE |
| GUI configuration | YES | HIGH | Settings > Features > MCP |
| Project-level config | YES | HIGH | `.cursor/mcp.json` |
| Global config | YES | HIGH | `~/.cursor/mcp.json` |
| Tool limit | ~40 tools | MEDIUM | Soft/hard limit to prevent context bloat |
| Per-tool timeout | 30-60s | LOW | Not definitively documented |
| OAuth support for MCP servers | YES | MEDIUM | Added in 2025 for Jira, Slack, etc. |

### MCP Configuration Format

**Project-level:** `.cursor/mcp.json` (committable to git)
**Global:** `~/.cursor/mcp.json`

```json
{
  "mcpServers": {
    "jstack-browse": {
      "command": "npx",
      "args": ["-y", "jstack-mcp-server"],
      "env": {
        "JSTACK_BROWSE_PATH": "/usr/local/bin/browse"
      }
    },
    "remote-example": {
      "url": "https://api.example.com/mcp/sse"
    }
  }
}
```

**Key format details:**
- `command` + `args` for stdio transport (local subprocess)
- `url` for SSE/HTTP transport (remote server)
- `env` for environment variables passed to the subprocess
- Project config overrides global config on name collision

### MCP vs Claude Code Comparison

| Dimension | Cursor MCP | Claude Code MCP |
|:----------|:-----------|:----------------|
| Tool discovery | Auto from config | Auto from config |
| Tool limit | ~40 (context window concern) | Effectively unlimited (dynamic loading) |
| Transport | stdio, SSE, Streamable HTTP | stdio, SSE, Streamable HTTP |
| Config location | `.cursor/mcp.json` | `~/.claude/settings.json` or project `.mcp.json` |
| Sub-agent spawning | Limited | Full parallel sub-agents |
| Background execution | Via Background Agents (cloud) | Headless mode, Claude Max |

### Tool Limit Implications for jstack

The ~40 tool limit matters. If a user has GitHub MCP, Filesystem MCP, Docker MCP,
and other servers enabled, jstack's MCP server tools compete for slots. Design the
MCP server with **few, high-value tools** rather than exposing every browse subcommand:

- **Recommended:** 5-8 tools (goto, snapshot, click, type, screenshot, diff, assert)
- **Avoid:** 20+ granular tools that would consume half the limit

---

## 3. Rules System

### Overview

Cursor has three layers of rules, with the system evolving rapidly:

| Layer | Location | Format | Status |
|:------|:---------|:-------|:-------|
| Legacy `.cursorrules` | Project root | Plain markdown | DEPRECATED but still read |
| Project Rules | `.cursor/rules/*.mdc` | MDC (Markdown + YAML frontmatter) | CURRENT standard |
| Global Rules | Cursor Settings > General > Rules for AI | Plain text in GUI | CURRENT |
| Global `.mdc` files | `~/.cursor/rules/` | MDC | NOT natively supported |

**Critical finding:** There is NO native `~/.cursor/rules/` global directory for
.mdc files. Global rules are set via the Settings GUI only. Users wanting global
.mdc files must symlink into each project's `.cursor/rules/`. This is a friction
point jstack can solve.

### MDC Format

Files in `.cursor/rules/` use the `.mdc` extension (Markdown Context). The format:

```markdown
---
description: When to use this rule (used for AI auto-selection)
globs: src/**/*.tsx, src/hooks/*.ts
alwaysApply: false
---

# Rule Title

Instructions in markdown. The AI reads this as part of its system prompt.
Code examples, step-by-step workflows, constraints, etc.
```

### Frontmatter Fields

| Field | Type | Required | Purpose |
|:------|:-----|:---------|:--------|
| `description` | string | Recommended | AI uses this to decide relevance; enables "Agent Requested" injection |
| `globs` | string (comma-sep) | Optional | Auto-attach when editing matching files |
| `alwaysApply` | boolean | Optional | If true, injected into every interaction |

### Rule Injection Modes

Rules reach the agent through four paths (Confidence: HIGH):

1. **Always Applied** -- `alwaysApply: true` rules are in every context
2. **Auto-Attached** -- Glob patterns match current files being edited
3. **Agent Requested** -- AI reads `description` and pulls in relevant rules
4. **Manual** -- User types `@rule-name` in chat to explicitly attach

### Size and Token Considerations

| Metric | Value | Confidence |
|:-------|:------|:-----------|
| Recommended max per rule | ~500 lines / ~2,000 tokens | MEDIUM |
| Hard limit per rule | No documented hard limit | LOW |
| Active rules per prompt | AI selects 2-3 most relevant | MEDIUM |
| Token tax of heavy rules | 10-15% of 200k context window | MEDIUM (from community reports) |
| Context crowding | Known issue: middle rules get ignored | HIGH (community pain point #3) |

### Can Rules Trigger Shell Commands or MCP Tools?

**Not directly.** Rules are prompt instructions, not executable code. However:

- Rules CAN instruct the agent to use `run_terminal_command` (e.g., "Run `jstack browse` when testing")
- Rules CAN reference MCP tools by name (e.g., "Use the `browse` MCP tool to verify changes")
- Rules CANNOT execute anything themselves -- they only influence agent behavior

This is the same model as SKILL.md files in Claude Code: the document instructs,
the agent executes.

---

## 4. Extensions/Plugins

### Current State

| Capability | Status | Confidence | Notes |
|:-----------|:-------|:-----------|:------|
| VS Code extension compatibility | YES | HIGH | Cursor is a VS Code fork |
| Dedicated Cursor Marketplace | UNCERTAIN | LOW | Gemini claims "Cursor 2.5" launched one; may be hallucinated |
| OpenVSX as extension source | LIKELY | MEDIUM | Due to Microsoft licensing changes |
| Extensions can register MCP servers | UNCERTAIN | LOW | Gemini claims `vscode.cursor.mcp.registerServer()` API; unverified |
| Extensions can add AI context providers | UNCERTAIN | LOW | Plausible but not confirmed |
| Cursor Plugin CLI | UNCERTAIN | LOW | Gemini claims `@cursor/plugin-cli`; likely hallucinated |

**Honest assessment:** The extension/plugin story is the least verified area.
Cursor's rapid iteration makes it hard to pin down what's shipped vs. announced
vs. hallucinated by Gemini. For jstack's integration, we should NOT depend on
Cursor-specific extension APIs. Instead, use the two well-established integration
points: **MCP** and **.cursor/rules/**.

---

## 5. Capabilities Matrix (Summary)

| Feature | Claude Code | Cursor Agent | Codex CLI | Kiro |
|:--------|:------------|:-------------|:----------|:-----|
| Shell command execution | YES (native) | YES (tool-call) | YES (native) | YES |
| MCP tool calling | YES | YES | NO | UNKNOWN |
| Skill/rules discovery dir | `~/.claude/skills/` | `.cursor/rules/` | `~/.codex/skills/` | `~/.kiro/skills/` |
| Global skills directory | YES | NO (GUI only) | YES | YES |
| Skill format | SKILL.md (markdown) | .mdc (MD + frontmatter) | SKILL.md | SKILL.md |
| Auto-attach by file pattern | NO (always loaded) | YES (globs) | NO | NO |
| Agent-selected rules | NO | YES (description) | NO | NO |
| Background/async execution | YES (headless) | YES (cloud sandbox) | YES (background) | UNKNOWN |
| Multi-model routing | Manual | Auto mode | NO | NO |
| Persistent browser daemon | Via jstack | Via MCP or shell | Via jstack | Via jstack |

---

## 6. Integration Path Analysis

### Path A: MCP Server

Expose jstack's browse daemon as an MCP stdio server. The agent calls MCP tools
which invoke the browse binary.

**Architecture:**
```
Cursor Agent -> MCP protocol (stdio) -> jstack-mcp-server -> browse binary -> browser
```

**Implementation:**
```typescript
// jstack-mcp-server/index.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { execSync } from "child_process";

const server = new Server(
  { name: "jstack-browse", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// Register 6-8 high-value tools (under the ~40 tool budget)
const TOOLS = [
  { name: "browse_goto", description: "Navigate to URL and return page snapshot", ... },
  { name: "browse_click", description: "Click element by selector or text", ... },
  { name: "browse_type", description: "Type text into form field", ... },
  { name: "browse_screenshot", description: "Take annotated screenshot", ... },
  { name: "browse_snapshot", description: "Get accessibility tree snapshot", ... },
  { name: "browse_diff", description: "Compare before/after page state", ... },
  { name: "browse_assert", description: "Assert page state matches expectation", ... },
];
```

**User setup:**
```json
// .cursor/mcp.json (project-level, committable)
{
  "mcpServers": {
    "jstack-browse": {
      "command": "jstack",
      "args": ["mcp-serve"],
      "env": {}
    }
  }
}
```

| Dimension | Assessment |
|:----------|:-----------|
| **Feasibility** | HIGH -- MCP stdio is well-supported, SDK is mature |
| **User friction** | LOW -- 1 config file + `npm i -g jstack` or binary install |
| **Capability coverage** | MEDIUM -- Covers browse daemon well; does NOT cover skills/workflows |
| **Structured output** | HIGH -- JSON responses, typed schemas, no parsing ambiguity |
| **Error handling** | HIGH -- MCP error codes, typed error responses |
| **Maintenance burden** | MEDIUM -- Must maintain MCP server wrapper + tool schemas |
| **Tool budget** | 6-8 of ~40 slots -- acceptable |
| **Limitation** | Cannot deliver multi-step workflows (like /qa or /ship) |

### Path B: Shell Commands via .cursor/rules/

Write `.cursor/rules/` MDC files that instruct the agent to invoke `jstack` CLI
directly via `run_terminal_command`.

**Architecture:**
```
Cursor Agent -> run_terminal_command -> jstack browse <cmd> -> browser
              (instructed by .mdc rules)
```

**Example rule:**
```markdown
---
description: Use jstack browse for web testing, QA, and visual verification
globs: *
alwaysApply: false
---

# jstack Browse Integration

When you need to test, verify, or inspect a web page:

1. Use `jstack browse goto <url>` to navigate and get a page snapshot
2. Use `jstack browse click <selector>` to interact with elements  
3. Use `jstack browse screenshot` to capture visual state
4. Use `jstack browse diff` to compare before/after changes

Always verify visual changes with `jstack browse screenshot` before
telling the user changes are complete.

Do NOT use curl, fetch, or Playwright MCP for browser tasks when jstack
is available -- it maintains a persistent daemon with sub-100ms latency.
```

| Dimension | Assessment |
|:----------|:-----------|
| **Feasibility** | HIGH -- Rules are simple markdown files |
| **User friction** | VERY LOW -- Copy files into `.cursor/rules/`, done |
| **Capability coverage** | HIGH -- Can describe full multi-step workflows |
| **Structured output** | LOW -- Agent must parse terminal text output |
| **Error handling** | LOW -- Agent reads stderr, may misinterpret |
| **Maintenance burden** | LOW -- Just markdown files, no code to maintain |
| **Tool budget** | 0 slots -- uses built-in `run_terminal_command` |
| **Limitation** | Agent may hallucinate flags; output parsing is fragile |

### Path C: Prompt Templates (.cursor/rules/ as SKILL.md equivalent)

Generate `.cursor/rules/*.mdc` files containing full skill content -- the
Cursor equivalent of current SKILL.md files.

**Architecture:**
```
Cursor Agent reads .mdc rules (workflow instructions)
  -> Follows multi-step skill workflow
  -> Invokes shell commands per instructions
  -> Uses built-in tools (edit_file, grep_search, etc.)
```

**Example: qa.mdc (shortened)**
```markdown
---
description: Systematic QA testing with visual verification and bug fixing
globs: *
alwaysApply: false
---

# /qa Skill -- Systematic QA Testing

## Prerequisites
Ensure jstack is installed: `which jstack`

## Step 1: Discover Test Targets
Read the project's CLAUDE.md or package.json to find the dev server command...

## Step 2: Start Visual Testing
Run `jstack browse goto <dev-url>` and analyze the page snapshot...

## Step 3: Test Critical Paths
For each page/route, verify: layout, forms, navigation, responsive breakpoints...

## Step 4: Fix Bugs Found
For each bug, create an atomic commit with visual evidence...
```

| Dimension | Assessment |
|:----------|:-----------|
| **Feasibility** | HIGH -- Direct analogue to current SKILL.md approach |
| **User friction** | VERY LOW -- `jstack setup --cursor` copies .mdc files |
| **Capability coverage** | HIGHEST -- Full workflow skills, not just browse commands |
| **Structured output** | MEDIUM -- Text-based but workflow-structured |
| **Error handling** | MEDIUM -- Skill instructions can include error recovery steps |
| **Maintenance burden** | MEDIUM -- Must maintain .mdc templates alongside SKILL.md |
| **Tool budget** | 0 slots -- no MCP needed |
| **Limitation** | Subject to "rule ignorance" (community pain point #3); large skills may exceed recommended ~2K token limit |

### Path D: Hybrid (MCP + Rules) -- RECOMMENDED

Combine MCP for structured browse access with .mdc rules for workflow orchestration.

**Architecture:**
```
.cursor/rules/*.mdc files define workflows (qa, ship, review, etc.)
  -> Workflows reference MCP tools for browser interaction
  -> MCP server wraps browse daemon with typed schemas
  -> Rules provide strategy; MCP provides capabilities
```

| Dimension | Assessment |
|:----------|:-----------|
| **Feasibility** | HIGH |
| **User friction** | LOW -- `jstack setup --cursor` does both (copies .mdc + writes mcp.json) |
| **Capability coverage** | HIGHEST -- Full workflows + structured browser access |
| **Structured output** | HIGH for browse (via MCP); MEDIUM for other tools (via shell) |
| **Error handling** | HIGH -- MCP handles browse errors; rules handle workflow logic |
| **Maintenance burden** | MEDIUM-HIGH -- MCP server + .mdc templates + generation pipeline |
| **Tool budget** | 6-8 of ~40 slots -- acceptable |

---

## 7. Integration Path Comparison

| Criterion | A: MCP Only | B: Shell Rules | C: Prompt Templates | D: Hybrid |
|:----------|:------------|:---------------|:--------------------|:----------|
| Browse daemon access | Excellent | Good | Good | Excellent |
| Multi-step workflows | None | Basic | Full | Full |
| Install friction | Low | Very Low | Very Low | Low |
| Output reliability | High | Low | Medium | High |
| Token efficiency | Medium | High | Low (large rules) | Medium |
| Portability (other hosts) | MCP only | Cursor only | Cursor only | Both |
| Community alignment | Strong (MCP hype) | Familiar | Familiar | Strongest |
| Time to implement | 2-3 days | 1 day | 3-5 days | 4-6 days |

---

## 8. Recommendation: Path D (Hybrid)

### Rationale

1. **MCP is the right interface for the browse daemon.** Structured JSON responses
   beat terminal text parsing. The agent knows the exact tool schema and cannot
   hallucinate flags. Error handling is typed. This is the "infrastructure" play
   that aligns with jstack's positioning.

2. **.mdc rules are the right interface for skills/workflows.** They're the Cursor
   equivalent of SKILL.md files. They support glob-based auto-attachment and
   AI-driven selection via `description`. They can reference MCP tools by name.

3. **The hybrid approach solves the "rules are ignored" pain point** by keeping
   individual .mdc files small (under 2K tokens each) while delegating complex
   browser interactions to typed MCP tools instead of embedding long CLI docs in rules.

4. **Portability.** The MCP server works in any MCP-compatible host (Windsurf,
   VS Code + Continue.dev, Claude Code). The .mdc rules are Cursor-specific but
   can be generated from the same templates that produce SKILL.md files.

### Implementation Plan

**Phase 1: MCP Server (Days 1-3)**
- Create `jstack-mcp-server` package wrapping the browse binary
- 7 tools: goto, click, type, screenshot, snapshot, diff, assert
- stdio transport (local subprocess)
- Publish to npm as `jstack-mcp-server`
- Add to Smithery registry for one-click discovery

**Phase 2: .mdc Rule Generation (Days 3-5)**
- Extend `gen-skill-docs.ts` to output .mdc format alongside SKILL.md
- Each skill gets a condensed .mdc version (under 2K tokens)
- .mdc files reference MCP tools: "Use the `browse_goto` tool to navigate..."
- `jstack setup --cursor` copies .mdc files and writes `.cursor/mcp.json`

**Phase 3: Setup Command (Day 5-6)**
- `jstack setup --cursor` detects Cursor, writes config, copies rules
- `jstack setup --claude-code` (existing behavior)
- `jstack setup` auto-detects all installed hosts
- Add to platform-detect script

### Skill Path Mapping

```
~/.claude/skills/jstack/qa/SKILL.md        -> Claude Code
~/.codex/skills/jstack/qa/SKILL.md         -> Codex CLI  
~/.kiro/skills/jstack/qa/SKILL.md          -> Kiro
.cursor/rules/jstack-qa.mdc               -> Cursor (project-level)
.cursor/mcp.json                           -> Cursor MCP (browse daemon)
```

---

## 9. Gotchas and Limitations

### Verified Gotchas (HIGH confidence)

1. **Rule ignorance is real.** Community pain point #3: agents "happily ignore"
   `alwaysApply: true` rules. Keep rules short. Use MCP for structured interactions.

2. **No global .mdc directory.** `~/.cursor/rules/` is NOT natively supported.
   Skills must be copied into each project's `.cursor/rules/`. This means jstack
   needs a setup command per project, unlike Claude Code's global `~/.claude/skills/`.

3. **MCP tool limit (~40).** If users have many MCP servers, jstack's tools compete
   for slots. Keep the tool count to 6-8.

4. **Agent cannot handle interactive CLI prompts.** The browse daemon must never
   prompt for input when invoked by Cursor's agent.

5. **Terminal blocking.** If `jstack browse` hangs or takes >60s, the agent may
   time out. The daemon architecture (persistent process) helps here since commands
   return quickly.

6. **Context window pressure.** .mdc rules consume context tokens. A 2,000-line
   SKILL.md would eat 10-15% of the 200k window. Condense skills for .mdc output.

### Unverified Claims (flag for manual verification)

7. **"Cursor 2.5/2.6.x" version numbers.** Gemini confidently cited these but
   Cursor historically used 0.x versioning. The version scheme may have changed.
   Verify against cursor.com/changelog.

8. **"Agent Client Protocol (ACP)."** Gemini claims this is a real protocol for
   cross-IDE agent execution. May be hallucinated. Not load-bearing for our integration.

9. **"40-tool hard cap."** Multiple sources cite ~40 but it may be a soft recommendation
   that's been raised. Design for 6-8 tools regardless.

10. **Background Agent cloud sandbox details.** Timeout limits (4h/12h), resource
    limits (8 vCPU/16GB) are plausible but not independently verified.

11. **Cursor Plugin CLI and Marketplace.** Claims about `@cursor/plugin-cli` and a
    dedicated marketplace are likely aspirational or hallucinated. Do not build on these.

### Architecture Risks

12. **Dual-format maintenance.** Generating both SKILL.md and .mdc from the same
    templates requires careful testing. The .mdc format is more constrained (shorter,
    frontmatter required, glob-based attachment).

13. **MCP server reliability.** Cursor users report MCP servers occasionally failing
    to connect or disappearing from the tool registry. Include a "List all MCP tools"
    diagnostic in jstack's Cursor integration.

---

## 10. Version Information

All research conducted April 1, 2026. Key version markers:

- Cursor IDE: likely v0.45+ or v2.x (version scheme uncertain)
- MCP SDK: @modelcontextprotocol/sdk (stable, well-documented)
- Cursor MCP support: native since late 2024 (v0.43+)
- .mdc rules format: introduced late 2024, now standard
- Background Agents: launched mid-2025, still reported as unstable

**This document should be re-verified monthly.** Cursor ships features weekly and
the MCP ecosystem evolves rapidly. Key things to re-check:
- Tool limit (may increase)
- Global .mdc support (may be added)
- Extension API for AI tools (may stabilize)
- Background Agent reliability (may improve)

---

*Research: 9 Gemini Tier 1 queries with cross-referencing. Hallucination-prone claims
flagged with LOW confidence. Integration recommendation based on triangulated findings
and existing gstack host integration patterns.*
