# jstack

**Turn your AI coding agent into a virtual engineering team.**

jstack is a privacy-first AI engineering toolkit. One repo, one install — you get a headless browser, 35+ workflow skills, and a curated agent roster that covers the full development lifecycle: brainstorm, plan, implement, test, review, ship, and monitor.

Works with **Claude Code**, **Cursor** (via MCP), **Codex CLI**, and **Gemini CLI**.

Based on [gstack](https://github.com/garrytan/gstack) by Garry Tan. Zero telemetry. No phone-home. Your code stays on your machine.

---

## Install (30 seconds)

### Claude Code

```bash
git clone https://github.com/joethorngren/jstack ~/.claude/skills/jstack
cd ~/.claude/skills/jstack && ./setup
```

### Cursor

```bash
git clone https://github.com/joethorngren/jstack ~/jstack
cd ~/jstack && ./setup --host cursor
```

This generates `.cursor/rules/jstack-*.mdc` skill rules and `.cursor/mcp.json` with the browse MCP server (10 tools for headless browser automation).

To use in a project, copy the `.cursor/` directory to your project root.

### Codex CLI

```bash
git clone https://github.com/joethorngren/jstack ~/.codex/skills/jstack
cd ~/.codex/skills/jstack && ./setup --host codex
```

---

## The Agent Roster

Every agent has a name, a role, and a voice. They're not generic — they're opinionated colleagues.

| Agent | Role | What they do |
|-------|------|-------------|
| **Caleb** | Sprint Master | Sprint planning, backlog grooming, ceremony facilitation, velocity tracking |
| **Reza** | Architect & Reviewer | PR reviews, system design, trade-off analysis, SOLID enforcement |
| **Chi** | UX/Design Expert | Design reviews, accessibility audits, user journey analysis |
| **Adam** | Edge Case Hunter | Testing, coverage gaps, boundary conditions, QA |
| **Mr. Robot** | Security Auditor | OWASP Top 10, STRIDE, secrets archaeology, dependency audit |
| **Michael** | Docs Maestro | Sprint reports, changelogs, README audits, API documentation |
| **ViNish** | Developer | Feature implementation, refactoring, bug fixes, sprint work |
| **Legal Panel** | Compliance Auditor | Multi-model legal audit (GDPR, HIPAA, CCPA, COPPA) |

In Claude Code, agents are invoked as sub-processes with full persona. In Cursor, agent personas are available as `.mdc` rules.

---

## Workflow Skills

The full development lifecycle, automated:

### Plan
| Skill | What it does |
|-------|-------------|
| `/brainstorm` | Six forcing questions to validate your idea before you build |
| `/plan-ceo-review` | Product review — scope, wedge, demand validation |
| `/plan-eng-review` | Architecture review — data flow, edge cases, test strategy |
| `/plan-design-review` | Design review — hierarchy, spacing, accessibility |

### Build
| Skill | What it does |
|-------|-------------|
| `/qa` | Test a web app like a real user, fix bugs, produce before/after evidence |
| `/qa-only` | Same testing, report only (no fixes) |
| `/review` | Pre-landing PR review — SQL safety, auth bypass, conditional side effects |
| `/war-room` | Multi-model consensus review (Claude + Codex + Gemini) |

### Ship
| Skill | What it does |
|-------|-------------|
| `/ship` | Merge base, run tests, review diff, bump version, push, create PR |
| `/land-and-deploy` | Merge PR, wait for CI, verify production health |
| `/canary` | Post-deploy monitoring — console errors, perf regression, page failures |

### Design
| Skill | What it does |
|-------|-------------|
| `/design-consultation` | Create a design system from scratch (colors, typography, spacing) |
| `/design-review` | Visual QA — find and fix spacing, hierarchy, AI slop patterns |
| `/design-shotgun` | Generate multiple design variants, compare, iterate |

### Safety
| Skill | What it does |
|-------|-------------|
| `/careful` | Warn before destructive commands (rm -rf, DROP TABLE, force-push) |
| `/freeze` | Restrict edits to a single directory |
| `/guard` | Both `/careful` + `/freeze` combined |
| `/cso` | Full OWASP Top 10 + STRIDE security audit |
| `/black-hat` | Adversarial security — actively attempt exploitation |

### Meta
| Skill | What it does |
|-------|-------------|
| `/investigate` | Systematic root-cause debugging (investigate, analyze, hypothesize, fix) |
| `/retro` | Weekly engineering retrospective with trend tracking |
| `/document-release` | Post-ship documentation update |
| `/legal-audit` | Multi-model compliance audit (Claude + Codex + Gemini) |
| `/testing-philosophy` | Enforce testing principles during code review |

---

## Browse Daemon

jstack includes a persistent headless browser (Playwright-based) that AI agents use to test, QA, and interact with web applications.

**In Claude Code / Codex:** Available as `$B` shell commands (`$B goto`, `$B click`, `$B snapshot`, etc.)

**In Cursor:** Available as 10 MCP tools via the `jstack-browse` MCP server:

| Tool | What it does |
|------|-------------|
| `browse_goto` | Navigate to a URL |
| `browse_click` | Click an element by selector or @ref |
| `browse_type` | Type into the focused element |
| `browse_fill` | Fill an input field |
| `browse_screenshot` | Take a screenshot |
| `browse_snapshot` | Get the accessibility tree with interactive @refs |
| `browse_assert` | Check element state (visible, hidden, enabled, etc.) |
| `browse_wait` | Wait for element, network idle, or page load |
| `browse_scroll` | Scroll element into view |
| `browse_press` | Press a key (Enter, Tab, Escape, etc.) |

---

## Fork It

Create a company-specific fork with your branding:

```bash
jstack init --company acme-corp
```

This forks the repo, renames everything (`jstack` → `acme-corp-stack`), generates a starter DESIGN.md, and sets up upstream tracking so you can pull improvements from jstack.

---

## Multi-Model Power

jstack's best results come from using multiple frontier models together. The `/war-room` and `/legal-audit` skills run parallel reviews across Claude, Codex, and Gemini, then synthesize consensus findings. Each model catches things the others miss.

**Minimum:** Cursor alone gives you the browse MCP server + skill rules.
**Recommended:** Claude Code + Codex CLI + Gemini CLI for the full multi-model experience.

---

## Credits

jstack is a fork of [gstack](https://github.com/garrytan/gstack) by [Garry Tan](https://github.com/garrytan). The original vision of "turn Claude Code into a full engineering team" is Garry's — jstack extends it with Cursor support, multi-model consensus, and a curated agent roster.

Licensed under MIT. See [LICENSE](LICENSE) for details.
