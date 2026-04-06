# Design: `/teardown` Skill — Competitive UX Teardown

**Status:** Backlog (jstack v0.3.0 candidate)
**Author:** Joe + Claude
**Date:** 2026-04-06

## Problem

Competitive UX teardowns are one of the highest-value research activities before building a product, but the process is manual, tedious, and inconsistent. For Word Freak, Joe manually tore down 5+ competing apps (Scrabble GO, WWF, Wordscapes, Woogles, NYT Crossplay) across multiple sessions. The output was excellent but the process was ad-hoc — no repeatable workflow, no standardized report format, no automated discovery.

A `/teardown` skill would make this a one-command operation for any product category.

## User Story

```
/teardown "word games like Scrabble"
```

The skill discovers competing apps, scrapes their public-facing UX, builds feature matrices, and produces a structured teardown report — all saved to a Research topic folder.

## Workflow

### Phase 1: Discovery (automated)

Given a topic/app description, the skill:

1. **App Store search** — Browse Apple App Store and Google Play Store for the category. Extract: app name, developer, rating, review count, price/IAP model, screenshots.
2. **Web search** — Find web-based competitors, review articles ("best X apps 2026"), Reddit threads, Product Hunt listings.
3. **Deduplication** — Merge results, identify the top 5-10 competitors by relevance + popularity.
4. **User confirmation** — Present the discovered list. User can add/remove before proceeding.

### Phase 2: Scrape (browse daemon)

For each competitor:

1. **App store listing** — Full screenshot gallery, description, version history, review highlights.
2. **Marketing site** — Browse the product's website. Screenshot hero, pricing, feature pages.
3. **Web app** (if available) — Navigate the actual product. Screenshot key flows:
   - Onboarding / first-time experience
   - Core gameplay / interaction loop
   - Settings / customization
   - Social / multiplayer features
   - Monetization touchpoints (paywall, ads, IAP prompts)
4. **Mobile app** (stretch goal) — If the app has a mobile web version, browse it in mobile viewport. If native-only, rely on app store screenshots + review videos.

### Phase 3: Analysis (agent team)

Spawn 3 research agents in parallel:

1. **Feature Matrix Agent** — Build a structured comparison table across all competitors. Columns: app name. Rows: every feature discovered. Values: yes/no/partial + notes.
2. **UX Pattern Agent** — Identify recurring UX patterns across competitors (onboarding flows, tutorial styles, reward loops, social hooks). Flag anti-patterns.
3. **Differentiation Agent** — Given the user's product concept, identify: (a) table-stakes features everyone has, (b) differentiators no one is doing well, (c) "steal this" moments worth copying, (d) "avoid this" anti-patterns.

### Phase 4: Synthesis

Merge the three reports into a README.md with:

- TL;DR decision matrix (table format)
- Ranked competitor list with 1-line summaries
- Feature matrix (the big table)
- UX pattern catalog with annotated screenshots
- "Steal List" — specific things to copy with source attribution
- "Avoid List" — specific things competitors do poorly
- Differentiation opportunities
- Links to individual agent reports

### Phase 5: Output

Save everything to a Research topic folder:

```
Research/
  {topic}-ux-teardown/
    README.md                    # Synthesis
    report-feature-matrix.md     # Feature comparison table
    report-ux-patterns.md        # Pattern catalog
    report-differentiation.md    # Opportunities analysis
    screenshots/                 # Organized by competitor
      scrabble-go/
        onboarding-1.png
        gameplay-1.png
        monetization-1.png
      words-with-friends/
        ...
    competitors.json             # Structured data for all discovered competitors
```

## Technical Dependencies

- **Browse daemon** (jstack/browse) — for web scraping and screenshots
- **Deep researcher agents** — for Phase 1 discovery and Phase 3 analysis
- **App Store scraping** — needs browse daemon with anti-bot stealth (already in jstack v0.2.0)
- **Screenshot annotation** — stretch goal, could use Excalidraw MCP or simple labels

## Key Design Decisions

### Mobile-first or web-first?

Start web-first. Mobile app teardowns require either:
- A physical device + Appium (complex, fragile)
- App store screenshots + review videos (good enough for v1)
- Mobile web viewport in the browse daemon (covers responsive web apps)

v1 should focus on what the browse daemon can already do — web apps and mobile web viewports. Native app teardowns via screenshots + reviews. True mobile automation is a v2 feature.

### How much user interaction?

Minimal. The skill should run mostly autonomously after the initial topic input and competitor confirmation. The user reviews the final output, not every intermediate step.

### How does this relate to existing research?

The skill should check for existing research in the Research folder and offer to update/extend rather than starting from scratch. If `word-freak-game-ux-teardowns/` already exists, the skill should read it and identify what's stale or missing.

## Scope for v1

- Discovery via web search (not direct app store scraping)
- Web-based competitor scraping via browse daemon
- Feature matrix generation
- UX pattern identification
- Synthesis README
- Screenshot capture and organization

## Stretch Goals (v2+)

- Direct App Store / Google Play API scraping
- Mobile viewport screenshots for responsive apps
- Video recording of user flows (browse daemon screen capture)
- Automated re-runs to detect competitor changes over time
- Integration with the `/brainstorm` skill for product strategy sessions
- Price tracking / monetization model analysis

## Prior Art

- The manual teardown at `Research/word-freak-game-ux-teardowns/` is the gold standard for output quality. The skill should produce equivalent or better output.
- jstack's `/qa` skill demonstrates the browse-screenshot-analyze loop pattern.
- jstack's `/design-review` skill demonstrates the iterative visual analysis pattern.

## Effort Estimate

| Phase | Human Team | CC + jstack | Compression |
|-------|-----------|-------------|-------------|
| Skill template + discovery | 2 days | 30 min | ~100x |
| Browse integration + scraping | 3 days | 2 hours | ~12x |
| Analysis agent prompts | 1 day | 30 min | ~50x |
| Synthesis + output formatting | 1 day | 30 min | ~50x |
| Testing + polish | 2 days | 1 hour | ~16x |
| **Total** | **~9 days** | **~4.5 hours** | **~16x** |
