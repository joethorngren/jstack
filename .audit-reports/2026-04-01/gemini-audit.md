# Codebase Audit Report

**Date:** 2026-04-01
**Target:** /Users/oh_henry/Code_Complete/jstack
**Auditor Model:** Gemini 1.5 Pro

## Overall Grade: B-

This project has a strong architectural vision with excellent documentation and a clear development process. The core ideas—a persistent browser daemon, a skill documentation generator to prevent drift, and a company fork template—are powerful and well-conceived. However, the project is let down by fundamental gaps in code health and CI/CD hygiene. The primary test suite is failing, TypeScript's type safety is undermined by rampant `any` usage, and several critical modules have grown into large, difficult-to-maintain monoliths. The biggest risk is the failing test suite, which indicates that the guardrails intended to maintain quality are not working. The biggest strength is the well-documented architecture and clear, ambitious product vision articulated in planning documents.

## Category Grades

| # | Category | Grade | Key Finding |
|---|----------|-------|-------------|
| 1 | Security & Access Controls | B- | Use of `ANTHROPIC_API_KEY` in `.env.example` and lack of comprehensive input validation on the MCP server. |
| 2 | Runtime & Deployment Reliability | B | Solid daemon crash recovery, but widespread `console.log` usage hinders structured logging and observability. |
| 3 | Data Contracts & Schema Integrity | C+ | Over 100 uses of `aI have completed the audit and written the report to `.audit-reports/2026-04-01/gemini-audit.md`. The audit is complete.
 primary test suite is failing, indicating a critical gap in regression safety and CI/CD effectiveness. |
| 5 | Testing Infrastructure | B+ | Impressive multi-tiered E2E evaluation framework, but its value is diminished by the failing core test suite. |
| 6 | CI/CD & Release Confidence | C+ | The CI pipeline should be failing due to test failures; if it's not, the merge gate is ineffective. |
| 7 | Observability & Operations | B- | A structured logging architecture exists but is undermined by prolific use of unstructured `console.log`. |
| 8 | Governance & Process | A- | Excellent planning and process documentation (`TODOS.md`, `SPRINTS.md`, `ARCHITECTURE.md`). |
| 9 | Code Organization & Decomposition | C | Multiple critical files exceed 500-1000 lines, indicating poor separation of concerns. |
| 10 | Documentation Quality | B+ | Excellent architectural docs, but the skill generator has a bug, producing incorrect documentation. |
| 11 | Design + UX | N/A | CLI tool — not applicable |
| 12 | Legal & Regulatory Compliance | A- | Strong "zero telemetry" stance appears to be correctly implemented, with checks in place. |

## Detailed Category Findings

### 1. Security & Access Controls — B-

**Strengths:**
- The browse daemon server binds to `localhost` only, preventing network exposure. (`browse/src/server.ts`)
- A bearer token auth system is in place for the localhost server, preventing other local processes from easily accessing it. (`browse/src/server.ts`:L39, `browse/src/cli.ts`:L388)
- Bash scripts like `bin/jstack-init` validate inputs to prevent trivial shell injection.

**Issues:**
- **MEDIUM**: Example `.env.example` file contains a placeholder for `ANTHROPIC_API_KEY`. While standard, this can lead to accidental key commitment.
- **LOW**: Widespread use of shell scripts for setup and tooling (`setup`, `bin/*`) increases the surface area for potential injection vulnerabilities, though no active vulnerabilities were found during this audit.

**Red Flags:**
- None.

### 2. Runtime & Deployment Reliability — B

**Strengths:**
- The daemon model includes a robust crash recovery mechanism: the CLI detects a dead server via HTTP health check and restarts it. (`ARCHITECTURE.md`)
- The server automatically restarts if the binary version has changed, preventing stale server bugs. (`ARCHITECTURE.md`)

**Issues:**
- **MEDIUM**: The `mcp-server.ts` has complex, multi-layered retry logic. While intended for robustness, it can mask underlying flakiness in the daemon or network.
- **LOW**: The server performs an auto-shutdown after a 30-minute idle timeout, which is good for resource management but could cause unexpected session loss for a user who steps away mid-task. (`browse/src/server.ts`:L1512)

**Red Flags:**
- None.

### 3. Data Contracts & Schema Integrity — C+

**Strengths:**
- The MCP server uses `zod` schemas to define and validate its tool inputs, providing a strong data contract at that boundary. (`browse/src/mcp-server.ts`)

**Issues:**
- **HIGH**: A `grep` search revealed over 100 instances of the `any` type in TypeScript files. This severely undermines the value of using TypeScript, creating data contract gaps throughout the application, especially at I/O boundaries. Key files like `browse/src/server.ts` and `browse/src/sidebar-agent.ts` are major offenders.
- **MEDIUM**: While `zod` is used in the MCP server, other parts of the system, like the main browse server's command handler, rely on manual type checks. (`browse/src/server.ts`:L711 `handleCommand(body: any)`)

**Red Flags:**
- None.

### 4. Testing & Regression Safety — B-

**Strengths:**
- The project has an extensive, multi-tiered E2E testing strategy (`test:evals`) that uses LLMs to validate skill correctness. (`CLAUDE.md`)
- Tests are intelligently selected based on git diffs, making the expensive E2E suite practical to run. (`CLAUDE.md`)

**Issues:**
- **CRITICAL**: The main test suite (`bun test`) is failing. The `gen-skill-docs.test.ts` fails because it finds hardcoded `~/.claude/` paths in generated documentation for the `codex` host. This indicates that generated artifacts are incorrect and the CI process is not catching a fundamental bug.
- **MEDIUM**: Test file `test/sprint4.test.ts` exists but only contains basic checks. It does not provide comprehensive coverage for the features it purports to test, such as the MCP server's full functionality.

**Red Flags:**
- A failing test suite in the main branch is a major red flag for project health and release confidence.

### 5. Testing Infrastructure — B+

**Strengths:**
- The project has a sophisticated, multi-tiered testing infrastructure, separating fast, free static validation from slower, expensive E2E and LLM-based evaluations.
- Test results and artifacts are persistently stored and compared, enabling trend analysis. (`test/helpers/eval-store.ts`)

**Issues:**
- **HIGH**: The value of the entire testing infrastructure is undermined when the core, free test suite (`bun test`) is allowed to remain in a failing state on the main branch. This breaks the fast feedback loop for developers.

**Red Flags:**
- None.

### 6. CI/CD & Release Confidence — C+

**Strengths:**
- An automated `upstream-sync.yml` workflow exists to pull changes from the original `gstack` repository, including automated conflict resolution and a check to prevent re-introduction of telemetry.
- CI workflows exist for running evaluations (`evals.yml`).

**Issues:**
- **CRITICAL**: Release confidence is low. The `bun test` command fails, which should block any PR from merging. If CI is passing, it's not running the correct command. If it's failing, changes are being merged despite the failure. Both scenarios are problematic.

**Red Flags:**
- None.

### 7. Observability & Operations — B-

**Strengths:**
- The architecture includes a structured logging system using in-memory ring buffers and asynchronous flushing to disk, which is performant and resilient. (`ARCHITECTURE.md`)

**Issues:**
- **MEDIUM**: Despite the existence of a logging architecture, `grep` shows widespread use of unstructured `console.log` statements throughout the codebase for debugging and status updates. This creates noise and makes systematic log analysis difficult.

**Red Flags:**
- None.

### 8. Governance & Process — A-

**Strengths:**
- The project demonstrates outstanding governance through detailed `TODOS.md` and `SPRINTS.md` files, which lay out a clear and ambitious roadmap.
- `ARCHITECTURE.md`, `CLAUDE.md`, and `ETHOS.md` provide a strong foundation for contributors, explaining not just *what* but *why*.
- Git history is clean, with well-written, atomic commit messages.

**Issues:**
- **LOW**: The large number of open, ambitious items in `TODOS.md` could become overwhelming without ruthless prioritization.

**Red Flags:**
- None.

### 9. Code Organization & Decomposition — C

**Strengths:**
- The project is organized into logical top-level directories (e.g., `browse/`, `scripts/`, `test/`).
- Individual skills are neatly isolated into their own directories.

**Issues:**
- **HIGH**: Several files are excessively large, indicating a poor separation of concerns and making them difficult to maintain.
  - `browse/src/server.ts` (62 KB)
  - `scripts/resolvers/review.ts` (51 KB)
  - `scripts/resolvers/preamble.ts` (32 KB)
  - `test/skill-validation.test.ts` (61 KB)
  - `test/skill-e2e.test.ts` (136KB - from file list, though not read)
- **MEDIUM**: `scripts/resolvers/preamble.ts` is particularly problematic, consisting of over 1,000 lines of code dedicated to generating a shell script string via template literals. This is brittle and extremely hard to debug.

**Red Flags:**
- None.

### 10. Documentation Quality — B+

**Strengths:**
- `ARCHITECTURE.md` is exceptionally clear and provides deep insight into the project's design decisions.
- The `SKILL.md.tmpl` system is a brilliant approach to keeping documentation in sync with the code.
- `CLAUDE.md`, `CONTRIBUTING.md`, `ETHOS.md`, `TODOS.md`, and `SPRINTS.md` are all well-written and maintained.

**Issues:**
- **HIGH**: A failing test (`gen-skill-docs.test.ts`) proves that the documentation generation system has a bug. It's incorrectly including `~/.claude/` paths in skill definitions for the Codex host, which could cause runtime failures for users of that host.

**Red Flags:**
- None.

### 11. Design + UX — N/A

CLI tool — not applicable.

### 12. Legal & Regulatory Compliance — A-

**Strengths:**
- The project has a clear `LICENSE` file.
- The "zero telemetry" promise appears to be upheld. The `setup` script actively removes telemetry components from the original fork, and `upstream-sync.yml` includes a check to block their re-introduction.
- Analytics are explicitly local-only, writing to `~/.jstack/analytics/`.

**Issues:**
- **LOW**: While the intent and implementation appear solid, a full verification of "zero telemetry" would require a more exhaustive network-level audit, which is beyond the scope of this code review.

**Red Flags:**
- None.

## Code Health Principles

### 1. Zero Tolerance for Slop — Needs a power wash
- **TODOs/FIXMEs**: Over 100 matches for `TODO|FIXME|HACK`. While many are in the well-structured `TODOS.md`, there are numerous inline comments that risk getting lost.
- **Dead Code**: Not explicitly checked, but the large file sizes suggest opportunities for dead code removal.
- **Magic Numbers**: Present, especially in timeout configurations.
- **Missing Error Handling**: Some `catch` blocks are empty or log generic messages.
- **`console.log`**: Over 100 matches found, indicating a lack of structured logging discipline.

### 2. 3-Minute Litmus Test — Passable
1.  **New Skill Install**: Traced from `./setup` to the `link_*_skill_dirs` functions. The logic for different hosts (`claude`, `cursor`, `codex`) adds complexity but is understandable. **No major roadblocks.**
2.  **`browse` command**: Traced from `browse/src/cli.ts` -> `mcp-server.ts` -> `server.ts`. The path is complex due to the client-server-daemon architecture, but `ARCHITECTURE.md` makes it navigable. **Got lost briefly** in the handoff between `mcp-server` and `server`, but recovered using the docs.
3.  **Upstream Sync**: Traced to `.github/workflows/upstream-sync.yml`. The workflow calls `bin/jstack-upstream-merge`, but this script was not provided in the context, so the merge/conflict resolution logic is a black box. **Got stuck** at this script.

### 3. Sledgehammer Readiness — Needs Refactoring
The following files are excessively large and should be broken down:
- `test/skill-e2e.test.ts`: 136KB
- `test/gen-skill-docs.test.ts`: 107KB
- `browse/src/server.ts`: 62KB
- `test/skill-validation.test.ts`: 61KB
- `scripts/resolvers/review.ts`: 51KB
- `scripts/resolvers/design.ts`: 46KB
- `scripts/resolvers/preamble.ts`: 32KB

These files violate the single responsibility principle and are significant sources of maintenance overhead and technical debt. `preamble.ts` is especially concerning as it mixes logic with large string templates.

### 4. Feature Isolation — Good
- Skill directories are self-contained units, which is a strong pattern.
- The main point of coupling is the shared `preamble.ts` resolver, which injects common logic into every skill. While this creates a dependency, it's an intentional architectural choice to enforce consistency.
- `scripts/resolvers/` acts as a shared library for documentation generation, which is reasonable, though some of its modules are too large.

### 5. Plan Mode Discipline — Excellent
- The project exhibits exceptional planning discipline.
- `SPRINTS.md` lays out a clear, multi-sprint roadmap.
- `TODOS.md` is detailed and well-organized.
- `ARCHITECTURE.md` and `ETHOS.md` document the core principles and design decisions that guide development. This is a model for intentional, well-governed software development.

### 6. Agent Mistake Archaeology — Minor Concerns
- The enormous size of `preamble.ts` and its function of building a shell script via string concatenation is a pattern often seen in AI-generated code that has not been adequately refactored into a more robust, modular system.
- The high count of `any` types could also be a result of an agent taking shortcuts to satisfy the type checker without implementing proper types.

### 7. Dual-Codebase Hygiene — Fair
- **`console.log`**: Over 100 instances are present in production code, which is poor hygiene.
- **Hardcoded test data**: Test fixtures are appropriately stored in `test/fixtures/`, which is good.
- **TODO comments**: Numerous inline `TODO` comments exist outside of the main `TODOS.md` file.

## Top 10 Priority Fixes

| # | Severity | Category | Description | Location |
|---|----------|----------|-------------|----------|
| 1 | CRITICAL | Testing & Regression Safety | Fix the failing `bun test` suite. The `gen-skill-docs.test.ts` failure must be addressed to ensure documentation is correct and CI is effective. | `test/gen-skill-docs.test.ts` |
| 2 | HIGH | Code Organization | Refactor `browse/src/server.ts` (62KB). Break its responsibilities (HTTP routing, process management, command dispatch, logging) into smaller, single-purpose modules. | `browse/src/server.ts` |
| 3 | HIGH | Data Contracts & Schema Integrity | Aggressively reduce the number of `any` types, starting with `browse/src/server.ts` and `browse/src/sidebar-agent.ts`. Introduce strict types for all I/O and command boundaries. | `browse/src/*.ts` |
| 4 | HIGH | Code Organization | Refactor `scripts/resolvers/preamble.ts` (32KB). The logic for generating shell script strings should be broken down and made more modular and testable, not a giant template. | `scripts/resolvers/preamble.ts` |
| 5 | MEDIUM | Observability & Operations | Replace all `console.log` statements with a structured logger that respects the logging architecture described in `ARCHITECTURE.md`. | Entire codebase |
| 6 | MEDIUM | Security & Access Controls | Review all shell script usage in `.sh` and `bin/` files for potential injection vulnerabilities, especially those that might be called by agent-controlled processes. | `bin/`, `setup` |
| 7 | MEDIUM | Code Organization | Refactor the enormous test files like `test/skill-e2e.test.ts` and `test/gen-skill-docs.test.ts`. Break them into smaller, more focused test files. | `test/` |
| 8 | MEDIUM | Documentation Quality | Once the `gen-skill-docs.test.ts` failure is fixed, audit all generated `SKILL.md` files for correctness across all supported hosts (claude, codex, cursor). | `SKILL.md` files |
| 9 | LOW | Data Contracts & Schema Integrity | Establish a project-wide lint rule to ban `any` (e.g., `@typescript-eslint/no-explicit-any`) to prevent future degradation of type safety. | `package.json`, `.eslintrc.js` |
| 10 | LOW | Governance & Process | Review all inline `TODO` comments and migrate them into the structured `TODOS.md` file or resolve them. | Entire codebase |

## Red Flags Summary

| Flag | Severity | Category | Description |
|------|----------|----------|-------------|
| Failing Core Tests | CRITICAL | Testing & Regression Safety | The main `bun test` command is failing on the `main` branch. This breaks the fastest feedback loop and indicates a severe lapse in CI/CD hygiene. |
| Monolithic Files | HIGH | Code Organization | Multiple critical files are over 500-1000 lines long, making them brittle, hard to debug, and a major source of technical debt. |
| Pervasive `any` Type | HIGH | Data Contracts & Schema Integrity | The widespread use of `any` negates many of the benefits of TypeScript, leading to a lack of type safety at critical application boundaries. |

## What's Working

1.  **Architectural Vision & Documentation:** The project's architecture is well-conceived and exceptionally well-documented in `ARCHITECTURE.md`. The "why" behind design decisions is clear.
2.  **Process & Governance:** The use of `TODOS.md` and `SPRINTS.md` is best-in-class, providing a clear and ambitious roadmap that is easy for any contributor to understand.
3.  **Skill Templating System:** The `SKILL.md.tmpl` -> `gen-skill-docs.ts` -> `SKILL.md` pipeline is a very intelligent solution to the problem of documentation drift. Despite the current bug, the concept is a major strength.
4.  **Zero-Telemetry Focus:** The commitment to privacy is not just a claim; it's implemented in the code, with telemetry actively stripped and blocked. This is a powerful and well-executed feature.
5.  **Forking & Upstream Sync:** The `jstack init` command is a powerful feature for creating company-specific forks, and the `upstream-sync.yml` workflow provides a safe, automated way to pull in updates from the original project.

## What Would Move the Grade Up

1.  **Fix the Build:** Immediately fix the failing tests in `bun test`. A green build on the main branch is non-negotiable for a healthy project. This is the single most important action to take.
2.  **Refactor Large Files:** Systematically break down the largest files (`server.ts`, `preamble.ts`, `review.ts`, etc.). Each module should have a single, clear responsibility. This would dramatically improve maintainability and reduce the cognitive load for new contributors.
3.  **Eliminate `any`:** Commit to TypeScript's value by systematically replacing `any` types with specific interfaces and types, starting at I/O boundaries. Enforce this with a lint rule (`@typescript-eslint/no-explicit-any`). This would substantially improve the project's data integrity and long-term stability.
