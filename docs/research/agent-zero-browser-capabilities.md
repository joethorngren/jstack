# Agent Zero & Browser-Use Feasibility Assessment

> Research Date: April 1, 2026
> Research Method: Multi-source web research (Tier 1 x 12 queries) with direct
> repository analysis and documentation review.

## Research Question

Should jstack offer an AI-powered browser agent alongside its existing Playwright
daemon? Evaluate Agent Zero, browser-use, and alternatives for complement vs
compete fit, setup complexity, and shipping feasibility.

---

## 1. Agent Zero Assessment

### What It Is

Agent Zero (github.com/agent0ai/agent-zero, recently rehosted at agent0ai/agent-zero)
is a **general-purpose AI agent framework** — not a browser tool. It's a personal
assistant that can spawn sub-agents, execute code, browse the web, and learn over
time. Browser automation is one of many capabilities, not the focus.

- **Stars:** ~16.6k
- **Latest release:** v1.6 (March 31, 2026) — 6 releases in March alone
- **Language:** Python 52.8%, HTML 22.9%, JavaScript 20.2%
- **License:** Apache 2.0 (to be verified)
- **Architecture:** Hierarchical multi-agent with LiteLLM for provider abstraction

### Architecture

```
┌─────────────────────────────────────────────┐
│              Agent Zero Runtime              │
│  ┌────────┐  ┌────────┐  ┌──────────────┐  │
│  │ Main   │──│ Sub    │──│ Browser      │  │
│  │ Agent  │  │ Agents │  │ Agent Plugin │  │
│  └────────┘  └────────┘  └──────────────┘  │
│       │            │              │          │
│  ┌────────┐  ┌────────┐  ┌──────────────┐  │
│  │ Memory │  │ Skills │  │  Extensions  │  │
│  └────────┘  └────────┘  └──────────────┘  │
│                                             │
│  External Interfaces:                       │
│  ├── MCP Server (fastmcp, SSE + HTTP)       │
│  ├── A2A Server (fasta2a)                   │
│  └── HTTP REST API                          │
└─────────────────────────────────────────────┘
           ▲
           │  All served from single Uvicorn process
           │  via run_ui.py
```

**MCP Server:** Exposes exactly two tools: `send_message` and `finish_chat`. This
is a passthrough — you send a natural language message, Agent Zero processes it
with its full agent pipeline, and returns the result. It does NOT expose granular
browser commands.

**Browser Agent Plugin:** Uses Playwright Chromium internally. Docker images ship
the headless shell pre-installed. Local dev installs it on first use.

### Setup Complexity

| Aspect | Detail |
|--------|--------|
| Docker image | 2.3 GB download, 3-15 min depending on connection |
| Requires `privileged: true` | Yes, for Docker-in-Docker operations |
| Memory requirement | 2+ GB minimum; OOM crashes under that |
| Non-Docker option | Available via bash/PowerShell scripts, but requires Python 3.12+, uv, and manual Chromium install |
| Configuration | API keys via env vars or web UI onboarding (v1.4+) |
| First-run time | 5-15 minutes (Docker) or 10-20 minutes (local with deps) |

### LLM Provider Support

LiteLLM-based — supports OpenAI, Anthropic, Azure, Google, OpenRouter, local
models (Ollama, LM Studio), and Venice.ai. Model-agnostic by design.

### Verdict: NOT SUITABLE for jstack

**Reasons:**

1. **Wrong tool for the job.** Agent Zero is a general-purpose AI framework that
   happens to have browser capabilities. Shipping it for browser automation is
   like shipping an entire operating system to get a text editor.

2. **Massive footprint.** 2.3 GB Docker image, 2+ GB RAM, privileged Docker mode.
   A Cursor User Group member who just wants to QA-test their app does not want
   to pull a 2.3 GB container that needs privileged access.

3. **Opaque MCP interface.** Its MCP server exposes `send_message` / `finish_chat`
   — natural language in, natural language out. No granular browser control. You
   can't tell it "click the submit button" via MCP; you tell it "fill out the
   form and submit it" and hope for the best.

4. **Competes, doesn't complement.** Agent Zero would run its own Playwright
   instance, its own browser, its own agent loop. It cannot share jstack's
   existing browser daemon. This creates two parallel browser systems with no
   coordination.

5. **Experimental maturity.** Six releases in one month signals rapid iteration
   but also API instability. The review ecosystem describes it as "experimental"
   with "actively evolving" APIs.

**Confidence: High.** Agent Zero is a fascinating project but fundamentally wrong
for this use case.

---

## 2. browser-use Assessment

### What It Is

browser-use (github.com/browser-use/browser-use) is a **purpose-built AI browser
automation library**. It turns any LLM into a browser agent that can navigate pages,
fill forms, extract data, and complete multi-step web tasks autonomously.

- **Stars:** ~85.5k (one of the fastest-growing OSS AI projects of 2025-2026)
- **Latest version:** 0.12.5 (March 25, 2026)
- **Commits:** 8,991 total
- **Language:** Python (requires >=3.11, <4.0)
- **License:** MIT
- **Author:** Gregor Zunic (gregpr07)

### Architecture

```
┌──────────────────────────────────────────────┐
│            browser-use Agent Loop            │
│  ┌─────────┐    ┌──────────┐                 │
│  │  LLM    │◄──►│  Action  │                 │
│  │ (any)   │    │  Engine  │                 │
│  └─────────┘    └──────────┘                 │
│       │              │                        │
│  ┌─────────┐    ┌──────────┐                 │
│  │ Memory  │    │  State   │                 │
│  │ Manager │    │ Extractor│                 │
│  └─────────┘    └──────────┘                 │
│                      │                        │
│              ┌──────────────┐                 │
│              │   cdp-use    │ (raw CDP)       │
│              │ SessionMgr   │                 │
│              └──────────────┘                 │
│                      │                        │
│              ┌──────────────┐                 │
│              │  Chromium    │                 │
│              │  (local/CDP/ │                 │
│              │   cloud)     │                 │
│              └──────────────┘                 │
└──────────────────────────────────────────────┘
```

**Key architectural shift (Aug 2025):** browser-use dropped Playwright entirely
in favor of raw CDP via their `cdp-use` library. Rationale: Playwright's
abstraction layer adds a Node.js relay server hop that costs latency on the
thousands of CDP calls needed for element extraction. Going raw CDP gave them
"massively faster element extraction and screenshots" plus proper cross-origin
iframe support.

**State extraction pipeline (5 parallel CDP requests):**
1. `DOM.getDocument` — DOM tree
2. `Accessibility.getFullAXTree` — accessibility data
3. `DOMSnapshot.captureSnapshot` — full snapshot
4. `Page.getLayoutMetrics` — viewport info
5. `Runtime.evaluate` — event listener detection

These merge into `EnhancedDOMTreeNode` structures optimized for LLM consumption.

### Browser Connection Modes

| Mode | How |
|------|-----|
| Local (default) | Spawns its own Chromium via `cdp-use` |
| Real Browser | `--browser real` — connects to user's existing Chrome with saved logins/cookies |
| Remote CDP | Connect to any browser via CDP WebSocket URL |
| Cloud | Connect to Browserless, Browserbase, etc. |

### MCP Server

Official MCP server is available and documented. Setup:

```bash
# Claude Code
claude mcp add browser-use

# Or run directly
uvx --from 'browser-use[cli]' browser-use --mcp
```

Exposes: navigation, clicking, typing, scrolling, tab management, content
extraction, session controls, and a fallback "autonomous agent" tool for complex
multi-step tasks.

### LLM Provider Support

- ChatBrowserUse (their own hosted model)
- OpenAI (GPT-4o, GPT-4.1, etc.)
- Anthropic (Claude)
- Google (Gemini)
- Local models via Ollama

### Performance Benchmarks (WebVoyager)

| Configuration | Task Completion |
|---------------|-----------------|
| browser-use + GPT-4.1 Vision | ~72% |
| browser-use + Claude Opus 4.6 | ~78% |
| Stagehand + Claude Sonnet 4.6 | ~75% |
| Playwright (hand-written scripts) | ~98% |

### Cost Per Operation

| Task Type | Cost (GPT-4.1 pricing) |
|-----------|----------------------|
| Simple (5 steps) | $0.02-0.08 |
| Complex (20 steps) | $0.08-0.30 |
| Playwright equivalent | $0.00 |

### Setup Complexity

```bash
pip install browser-use          # or: uv add browser-use
uvx browser-use install          # install Chromium if needed
export OPENAI_API_KEY=sk-...     # or ANTHROPIC_API_KEY
```

**Total setup time:** 2-3 minutes for someone with Python 3.11+.

### Verdict: VIABLE BUT HEAVY

**Strengths:**

1. **Purpose-built for the problem.** Unlike Agent Zero, browser-use does one
   thing well: AI-driven browser automation.

2. **85.5k stars and MIT license.** Battle-tested, massive community, permissive
   license. This is the de facto standard for AI browser automation in Python.

3. **Official MCP server.** First-class integration path with Claude Code/Cursor.

4. **Can connect to existing browsers via CDP.** This is important — it doesn't
   necessarily need its own Chromium instance.

5. **Rich state extraction.** The 5-parallel-CDP-request pipeline produces
   high-quality page representations for LLMs.

**Weaknesses:**

1. **Python dependency.** jstack is a TypeScript/Bun project. Shipping a Python
   dependency adds friction — users need Python 3.11+, pip/uv, and a separate
   process.

2. **Cannot share jstack's Playwright browser.** browser-use migrated to raw CDP
   and removed Playwright. It cannot attach to a Playwright-managed browser
   context. It would need either its own Chromium or a CDP connection to a
   separately-launched Chrome.

3. **70-78% success rate.** Good for exploratory tasks, but unreliable for
   anything deterministic. Users will experience failures on ~1 in 4 tasks.

4. **Cost accumulates.** $0.02-0.30 per task adds up for frequent use. This is
   on top of whatever the user already pays for Claude Code.

5. **Separate process.** Runs as a Python daemon via stdio or standalone — adds
   operational complexity to the browse experience.

**Confidence: High.** browser-use is the real deal for AI browser automation, but
the Python dependency and inability to share jstack's Playwright instance are
significant friction points.

---

## 3. Other Alternatives

### Stagehand (browserbase/stagehand)

- **Stars:** ~21.8k
- **Latest:** v3.6.3 (March 31, 2026)
- **Language:** TypeScript (77%)
- **License:** MIT

**What it is:** An AI browser automation SDK that adds three primitives —
`act()`, `extract()`, and `agent()` — on top of browser control. Originally
built on Playwright, v3 moved to a CDP-native architecture with a modular driver
system.

**Key advantage for jstack:** TypeScript-native. Same language, same ecosystem.
Can run locally without Browserbase (local mode uses its own CDP engine).

**Performance:**
- Simple actions: 1-3 seconds
- Form fills: 5-15 seconds
- 10-step workflows: 15-45 seconds
- v3 is 44%+ faster than v2 across every scenario

**Cost per operation:** `act()` ~$0.002-0.01, `extract()` ~$0.005-0.02

**Setup:** `npx create-browser-app` or add as npm dependency. Requires LLM API
key + optional Browserbase credentials. Local mode works without Browserbase.

**MCP server:** Community fork exists (stagehand-mcp-local) but no official one
from Browserbase.

**Verdict:** The most architecturally aligned alternative for jstack. Same
language, local-capable, surgical AI primitives rather than full autonomous agent.
But it runs its own browser — no sharing with jstack's Playwright daemon.

### Playwright MCP (microsoft/playwright-mcp)

- **Stars:** ~30.1k
- **Language:** TypeScript
- **License:** Apache 2.0
- **Official:** Yes (Microsoft)

**What it is:** An MCP server that exposes Playwright's browser automation to
LLMs via the Model Context Protocol. Operates on **accessibility snapshots** (not
screenshots), so it doesn't need vision models.

**Key insight:** This is not an AI agent — it's an MCP bridge that lets an LLM
drive a Playwright browser. The LLM (Claude, GPT, etc.) IS the agent; Playwright
MCP just gives it browser control tools.

**Setup:** `npx @playwright/mcp@latest` — one command, zero config, ships with
GitHub Copilot built-in.

**Tools exposed:** `init-browser`, `get-interactive-snapshot`, `get-full-snapshot`,
`get-text-snapshot`, `get-screenshot`, `get-full-dom`, `execute-code`

**Critical limitation:** Launches its own Playwright browser. Cannot connect to
jstack's existing daemon. Two separate Chromium processes.

**Verdict:** Very popular, very easy to set up, but fundamentally duplicates
what jstack already does. Jstack's browse daemon already IS a Playwright browser
with commands exposed to the LLM.

### Skyvern (Skyvern-AI/skyvern)

- **Stars:** ~16.5k
- **Latest:** Active development
- **Language:** Python
- **License:** AGPL-3.0

**What it is:** AI browser automation using LLMs + computer vision. Three-phase
architecture: Planner (breaks tasks into steps) -> Actor (executes) -> Validator
(confirms success). Uses screenshots for visual element identification.

**Setup:** `pip install skyvern && skyvern quickstart` — but the "quickstart"
prompts for Docker Compose for the full setup (PostgreSQL, Redis, workers).

**Verdict:** Too heavy. AGPL license is restrictive. Docker Compose with
PostgreSQL and Redis is far too much infrastructure for a developer tool feature.
Better suited for enterprise RPA, not a CLI skill.

### Playwright CLI (@playwright/cli)

- **Released:** Early 2026
- **Language:** TypeScript
- **Official:** Yes (Microsoft)

**What it is:** A companion to Playwright MCP that saves everything to disk
rather than streaming accessibility trees into the LLM context. Achieves ~4x
token reduction (27k vs 114k tokens for the same task).

**Verdict:** Interesting but solves a different problem (token efficiency for AI
coding agents). jstack's daemon already handles this with its snapshot/text
commands.

---

## 4. Complement vs Compete Analysis

### The Core Question

jstack's browse daemon is **fast and dumb**: goto, click, fill, screenshot,
text — explicit commands, ~100-200ms each, near-100% reliability. The question
is whether an AI agent layer that is **slow and smart** (natural language goals,
multi-step reasoning, 70-78% success rate) adds enough value to justify the
complexity.

### What Each Tool Would Add

| Capability | jstack daemon | + browser-use | + Stagehand | + Playwright MCP |
|------------|--------------|---------------|-------------|-----------------|
| Explicit commands (goto, click, fill) | Yes, fast | Redundant | Redundant | Redundant |
| Screenshot + text extraction | Yes | Redundant | Redundant | Redundant |
| "Fill out this complex form" | No — needs step-by-step | Yes (autonomous) | Yes (act) | No (still manual) |
| "Find the pricing page and extract plan details" | No | Yes | Partial (extract) | No |
| "Complete this multi-step checkout flow" | No | Yes (20 steps) | Yes (agent) | No |
| Self-healing selectors | No | Yes | Yes (v3) | No |
| Accessibility tree analysis | Yes (snapshot) | Yes | Yes (observe) | Yes |
| Share jstack's browser | N/A | No (raw CDP) | No (own CDP) | No (own PW) |

### Browser Instance Sharing: The Deal-Breaker

**None of these tools can share jstack's existing Playwright browser instance.**

- **browser-use:** Uses raw CDP, not Playwright. Cannot attach to a Playwright context.
- **Stagehand v3:** Uses its own CDP engine. Cannot attach to a Playwright context.
- **Playwright MCP:** Launches its own Playwright instance.
- **Agent Zero:** Launches its own everything.

This means shipping any of these tools creates a **second browser process**. The
user would have two Chromiums running — jstack's daemon for fast/dumb commands,
and the AI agent's browser for slow/smart tasks. No shared cookies, no shared
session state, no shared navigation history.

**Theoretical workaround:** Launch Chrome with `--remote-debugging-port`, have
both jstack and the AI agent connect via CDP. But this requires rearchitecting
jstack's daemon away from Playwright's managed browser, which is a major change
for uncertain benefit.

### Complement Scenarios (Where AI Agent Actually Helps)

1. **Complex form filling on unknown sites.** "Go to this government portal, fill
   out the application with these details, upload this document, and submit."
   jstack's daemon can't do this without explicit selectors for every field.

2. **Exploratory testing on unfamiliar UIs.** "Find all the broken links and
   accessibility violations on this marketing site." The AI agent can reason
   about page structure.

3. **Data extraction from unstructured pages.** "Go to these 10 competitor sites
   and extract their pricing tiers." The AI can figure out where pricing lives
   even when page structures differ.

### Compete Scenarios (Where AI Agent Duplicates)

1. **QA testing on known apps.** jstack's daemon + skill templates already handle
   this faster and more reliably.

2. **Screenshot comparison.** jstack already does `diff`, `responsive`, `screenshot`.

3. **Form interaction on apps you control.** If you know the selectors (which you
   do for your own app), explicit commands are 100x faster and 100% reliable.

---

## 5. Feasibility for jstack

### Setup Complexity Assessment

| Criterion | browser-use | Stagehand | Agent Zero |
|-----------|------------|-----------|------------|
| Install time (<5 min for CUG member) | Marginal (needs Python 3.11+) | Yes (npm) | No (Docker, 2.3GB) |
| Runtime dependency | Python daemon | Node process | Docker container |
| Additional API keys needed | Yes (LLM key) | Yes (LLM key) | Yes (LLM key) |
| Docker required? | No | No | Effectively yes |
| Works on macOS/Linux/Windows? | Yes/Yes/Yes | Yes/Yes/Yes | Yes/Yes/Yes |
| Second Chromium process? | Yes | Yes | Yes |

### Cost Impact

Users already pay for Claude Code (or bring their own API key). An AI browser
agent adds $0.02-0.30 per task on top of that. For casual use this is negligible.
For heavy use (100 tasks/day) it's $2-30/day — significant.

### Reliability Assessment

| Tool | Success Rate | Maturity |
|------|-------------|----------|
| jstack browse daemon | ~99%+ (deterministic) | Production |
| browser-use | ~72-78% (WebVoyager benchmark) | Production (0.12.x) |
| Stagehand | ~75% (WebVoyager benchmark) | Production (v3.x) |
| Agent Zero browser | Unknown (no benchmark) | Experimental |

### Would `/agent-browse` Make jstack More Compelling?

**Arguments for:**
- Differentiator: no other developer CLI tool offers both fast/dumb and slow/smart
  browser automation
- Addresses a real gap: complex multi-step tasks on unknown sites
- Market validation: browser-use (85k stars) proves massive demand

**Arguments against:**
- Two Chromium processes is confusing and resource-heavy
- 70-78% success rate means 1 in 4 tasks fail — bad user experience
- Python dependency fractures jstack's "one binary, zero deps" story
- The existing daemon + Claude Code's own reasoning already handles 95% of use cases
  (Claude reads the snapshot, decides what to click, issues explicit commands)
- Adding cost ($0.02-0.30/task) for marginal capability improvement

---

## 6. Recommendation: DEFER

### Rationale

The AI browser agent space is moving fast but hasn't converged. Browser-use just
rewrote its architecture (Playwright to CDP, Aug 2025). Stagehand just rewrote
its architecture (Playwright to CDP, v3 2025). The industry is in a transitional
period where the abstractions haven't stabilized.

More critically: **jstack's existing architecture already provides 90% of the
value.** Here's why:

```
Current flow (jstack + Claude Code):
1. Claude reads the page (snapshot/text/accessibility)
2. Claude reasons about what to do
3. Claude issues explicit commands (click, fill, type)
4. Claude verifies the result (screenshot/text)

This IS an AI browser agent — Claude is the agent, jstack is the executor.
```

The missing 10% is autonomous multi-step execution without Claude Code in the
loop (e.g., "go do this 20-step task and come back when done"). But that's
exactly what Claude Code's tool-use loop already does — it just does it
synchronously rather than as a background task.

### What Would Change This to "Ship It"

1. **Browser instance sharing.** If browser-use or Stagehand could attach to
   jstack's existing Playwright browser (or if jstack switched to CDP-first),
   the dual-process problem goes away. This is the single biggest blocker.

2. **95%+ success rates.** At 70-78%, too many tasks fail. When this reaches
   95%+, the value proposition becomes much stronger.

3. **TypeScript-native option matures.** Stagehand is closest (TypeScript,
   MIT, local mode), but its MCP story is community-maintained and it still
   can't share a browser. If Stagehand ships an official MCP server that can
   connect to an existing CDP endpoint, it becomes very interesting.

4. **Playwright MCP bridge mode.** If Microsoft's Playwright MCP adds a mode
   to connect to an existing Playwright server (rather than launching its own),
   jstack could expose its daemon as an MCP server and let Playwright MCP
   handle the AI layer. This would be zero additional dependencies.

### What to Do Now

1. **Monitor Stagehand v3.x.** It's the most architecturally aligned (TypeScript,
   local-capable, surgical primitives). Watch for an official MCP server and
   CDP connection mode.

2. **Monitor Playwright MCP.** 30k stars, Microsoft-backed, already ships with
   Copilot. If it adds "connect to existing browser" mode, it's a natural fit.

3. **Consider exposing jstack's daemon as an MCP server.** This is the highest-
   leverage move. Instead of adding an AI agent, make jstack's browse daemon
   available as an MCP server so ANY AI tool (Claude Code, Cursor, Copilot) can
   use it directly. The LLM itself becomes the "smart" layer.

4. **Revisit in Q3 2026.** The CDP-first migration wave (browser-use, Stagehand)
   should stabilize by then. Success rates should improve with better models.
   The MCP ecosystem should mature with more "connect to existing" patterns.

### Proposed Architecture (When Ready)

When the ecosystem matures, the ideal architecture is:

```
┌─────────────────────────────────────────────┐
│              Claude Code / Cursor            │
│         (the AI agent — reasoning layer)     │
└─────────┬───────────────────────┬───────────┘
          │ MCP                   │ MCP
          ▼                       ▼
┌─────────────────┐    ┌─────────────────────┐
│  jstack browse   │    │  Stagehand (opt)    │
│  daemon (MCP)    │    │  for extract/act    │
│  ┌─────────────┐ │    │  primitives         │
│  │ Playwright  │ │    └─────────────────────┘
│  │ Chromium    │ │             │
│  └─────────────┘ │             │ CDP
│       │ CDP      │             ▼
│       ▼          │    ┌─────────────────────┐
│  ┌─────────────┐ │    │  Shared Chrome      │
│  │ CDP Session │ │    │  (--remote-debugging │
│  └─────────────┘ │    │   -port)            │
└─────────────────┘    └─────────────────────┘

Phase 1 (now):  jstack daemon only, Claude reasons + commands
Phase 2 (Q3):   jstack daemon as MCP server
Phase 3 (Q4+):  Optional Stagehand for extract/act on shared CDP
```

**Phase 1** is what exists today and handles 90% of cases.
**Phase 2** makes jstack's daemon a first-class MCP citizen — any AI tool can use it.
**Phase 3** adds surgical AI primitives (extract structured data, act on natural
language instructions) via Stagehand, sharing a browser with jstack via CDP.

---

## 7. Summary Table

| Tool | Stars | Language | Shares jstack Browser? | Setup <5 min? | Success Rate | Verdict |
|------|-------|----------|----------------------|---------------|-------------|---------|
| Agent Zero | 16.6k | Python | No | No (2.3GB Docker) | Unknown | Skip |
| browser-use | 85.5k | Python | No (raw CDP) | Marginal (needs Python 3.11) | 72-78% | Defer |
| Stagehand | 21.8k | TypeScript | No (own CDP) | Yes (npm) | ~75% | Watch closely |
| Playwright MCP | 30.1k | TypeScript | No (own PW) | Yes (npx) | N/A (not an agent) | Watch closely |
| Skyvern | 16.5k | Python | No | No (Docker Compose) | Unknown | Skip |
| jstack daemon | — | TypeScript | N/A | Already installed | ~99% | Keep shipping |

---

## Sources

- [Agent Zero GitHub](https://github.com/agent0ai/agent-zero)
- [Agent Zero Architecture](https://www.agent-zero.ai/p/architecture/)
- [Agent Zero MCP Deep Dive](https://skywork.ai/skypage/en/A-Deep-Dive-into-AgentZero's-MCP-Server:-Architecture,-Implementation,-and-Use-Cases-for-AI-Engineers/1972190057898020864)
- [Agent Zero External Interfaces](https://deepwiki.com/frdel/agent-zero/8-task-scheduling-and-automation)
- [Agent Zero Review 2026](https://vibecoding.app/blog/agent-zero-review)
- [browser-use GitHub](https://github.com/browser-use/browser-use)
- [browser-use PyPI](https://pypi.org/project/browser-use/)
- [browser-use MCP Server Docs](https://docs.browser-use.com/open-source/customize/integrations/mcp-server)
- [browser-use: Leaving Playwright for CDP](https://browser-use.com/posts/playwright-to-cdp)
- [browser-use cdp-use](https://github.com/browser-use/cdp-use)
- [Stagehand GitHub](https://github.com/browserbase/stagehand)
- [Stagehand v3 Announcement](https://www.browserbase.com/blog/stagehand-v3)
- [Stagehand MCP Local](https://github.com/weijiafu14/stagehand-mcp-local)
- [Stagehand vs Browser Use vs Playwright (NxCode)](https://www.nxcode.io/resources/news/stagehand-vs-browser-use-vs-playwright-ai-browser-automation-2026)
- [Playwright MCP GitHub](https://github.com/microsoft/playwright-mcp)
- [Playwright MCP Field Guide](https://medium.com/@adnanmasood/playwright-and-playwright-mcp-a-field-guide-for-agentic-browser-automation-f11b9daa3627)
- [Top 5 MCP Servers for Browser Automation](https://www.webfuse.com/blog/the-top-5-best-mcp-servers-for-ai-agent-browser-automation)
- [Skyvern GitHub](https://github.com/Skyvern-AI/skyvern)
- [Stagehand Moving Beyond Playwright](https://www.browserbase.com/blog/stagehand-playwright-evolution-browser-automation)
- [MCP + CLI Tools for AI Test Automation](https://qtrl.ai/blog/mcp-cli-tools-ai-test-automation)
