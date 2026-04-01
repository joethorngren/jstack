# Sprint 5 -- Polish + Ship v0.1.0

**Dates:** 2026-04-01 to 2026-04-08
**Theme:** Make it bulletproof, make it beautiful, put it in people's hands.
**Status:** Kickoff -- 2026-04-01

---

## Context

Sprints 0-4 built the engine: 38 skills, 8 agents, MCP server, Cursor integration,
upstream sync, README, design system. Sprint 5 is the last mile — verify everything
works end-to-end, record a demo, write the launch post, and tag v0.1.0.

The audience is the Arity Cursor User Group (internal MS Teams channel). These are
Android developers who use Cursor daily but have never used Claude Code, Codex CLI,
or Gemini CLI. The install and first-run experience must be frictionless for
Cursor-only users.

### Carry-Forward from Sprint 4

**Integrated (must-fix):**
- CF-01: Address remaining 6 medium code review findings (from 90eca37)

**Deferred (not blocking v0.1.0):**
- 7 low-severity code review findings — cosmetic, no user impact
- 32 non-critical test gaps identified by Adam — Sprint 6+ work

---

## Tickets

### Testing Track

| ID | Title | Size | AC |
|----|-------|------|----|
| JS-050 | End-to-End Testing | L | All 38 skills load without error; browse daemon starts and responds in both CC and Cursor; /war-room runs with 2+ models; `jstack init --company test-co` produces a working fork; /brainstorm completes without YC references |
| CF-01 | Medium Code Review Findings | S | 6 medium findings from Sprint 4 review addressed; no new findings introduced |

### Launch Track

| ID | Title | Size | AC |
|----|-------|------|----|
| JS-051 | Record Demo Video | M | Screen recording <3 minutes showing: install jstack in Cursor, run /qa on a sample project, browse daemon finding real bugs, /war-room multi-model consensus, agent roster; hosted on a shareable URL |
| JS-052 | Cursor User Group Post | M | Post written in jstack's warm/electric-blue tone; includes: what it is, why it exists, install instructions, demo video link, GitHub repo link; reviewed before posting |
| JS-053 | Tag v0.1.0 Release | S | `git tag v0.1.0`; GitHub release with notes covering Sprints 0-5; CHANGELOG updated; VERSION bumped; clean working tree |

---

## Dependencies

```
CF-01 ──► JS-050 (fix findings before E2E)
              │
              ├──► JS-051 (demo uses verified build)
              │        │
              │        └──► JS-052 (post includes demo video)
              │
              └──► JS-053 (tag after all tests pass)
                       │
                  JS-052 ◄┘ (post links to release)
```

**Execution order:**
1. CF-01 (punch list fixes)
2. JS-050 (E2E testing)
3. JS-051 + JS-053 can overlap (demo recording while preparing release)
4. JS-052 last (needs demo video + release tag)

**Parallelization:** JS-051 and JS-053 can be done in parallel after JS-050 passes.

---

## Exit Criteria

1. All 38 skills load without error in both Claude Code and Cursor
2. Browse daemon starts, accepts commands, and returns screenshots
3. /war-room runs with at least 2 models and produces consensus report
4. `jstack init --company test-co` produces a working fork
5. Demo video recorded, hosted, and under 3 minutes
6. Cursor User Group post written, reviewed, and ready to publish
7. v0.1.0 tagged on GitHub with release notes
8. `bun test` passes
9. No critical or high findings open

---

## Risk Notes

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| /war-room flaky with Codex/Gemini CLI | Medium | Medium | Test with 2-model fallback; graceful degradation already built |
| Demo video scope creep | Medium | Low | Strict 3-minute cap; script the recording beforehand |
| Cursor User Group post falls flat | Low | Medium | Get Andrew/Chi to review before posting; include concrete before/after |
| `jstack init --company` edge cases | Medium | High | Test on a fresh machine if possible; document known limitations |
