# Design System Hierarchy

jstack uses a three-level design architecture. Each level can override the one
above it, so product-specific decisions always win without losing the shared
foundation underneath.

```
┌─────────────────────────────────────────────┐
│  Level 1: Toolkit (jstack defaults)         │
│  Electric blue #0066FF, spacing scale,      │
│  motion defaults, font recommendations      │
├─────────────────────────────────────────────┤
│  Level 2: Company (jstack init --company)   │
│  Brand colors, corporate typefaces,         │
│  company-wide spacing/layout conventions    │
├─────────────────────────────────────────────┤
│  Level 3: Product (DESIGN.md per project)   │
│  Product-specific palette, typography,      │
│  aesthetic direction, motion personality     │
└─────────────────────────────────────────────┘
        ▲ overrides flow upward
```

## Why three levels?

A single global config forces every project to look the same. Per-project config
with no shared base means every new project starts from zero. The three-level
cascade gives you both: shared defaults you never think about, company-wide
brand consistency across products, and per-product creative freedom where it
matters.

---

## Level 1: Toolkit defaults

**What it is:** The built-in design knowledge that ships with jstack. These are
the sensible defaults that apply when no company or product overrides exist.

**What lives here:**

| Token category | Default value | Purpose |
|----------------|---------------|---------|
| Primary color  | `#0066FF` (electric blue) | jstack's own identity color |
| Spacing base   | `4px` | Foundation for the spacing scale |
| Spacing scale  | `2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64)` | Consistent rhythm |
| Border radius  | `sm:4px, md:8px, lg:12px, full:9999px` | Hierarchical rounding |
| Motion easing  | `enter(ease-out) exit(ease-in) move(ease-in-out)` | Perceptually correct transitions |
| Motion duration | `micro(50-100ms) short(150-250ms) medium(250-400ms) long(400-700ms)` | Speed tiers |
| Font blacklist | Papyrus, Comic Sans, Lobster, Impact, etc. | Taste guardrails |
| Overused fonts | Inter, Roboto, Poppins, Montserrat, etc. | Deprioritized unless explicitly requested |

**How to customize:** You don't. These are baked into the design skills. If you
disagree with a default, override it at level 2 (company) or level 3 (product).

**Where it lives:** Encoded in the `/design-consultation` skill template. The
font recommendations, aesthetic directions, color approaches, and spacing scales
in that skill are the level 1 source of truth.

---

## Level 2: Company

**What it is:** Shared design tokens for all products under one company or
organization. Created via `jstack init --company`, which scaffolds a company-wide
configuration that all child projects inherit.

**What lives here:**

- Brand colors (primary, secondary, accent palette)
- Corporate typefaces and fallback stacks
- Company-wide spacing density preference (compact/comfortable/spacious)
- Layout conventions (max content width, grid columns)
- Motion philosophy (minimal-functional vs. expressive)
- Dark mode strategy (inverted surfaces, reduced saturation, etc.)

**Example company tokens:**

```yaml
# Company: Acme Corp
color:
  primary: "#1A1A2E"        # Acme navy
  secondary: "#E94560"      # Acme red
  neutrals: cool-gray       # Cool gray family

typography:
  display: "Cabinet Grotesk"
  body: "Instrument Sans"
  data: "Geist"
  code: "JetBrains Mono"

spacing:
  base: 8px
  density: comfortable

layout:
  max-width: 1280px
  grid: 12-column

motion:
  approach: intentional
```

**How to customize:** Edit the company configuration after running
`jstack init --company`. Every project created within this company inherits
these tokens unless the project's DESIGN.md overrides them.

---

## Level 3: Product

**What it is:** Per-project design decisions stored in `DESIGN.md` at the
repository root. This is where a product gets its own personality within the
company's brand framework.

**What lives here:**

- Product context (what it is, who it's for, industry/space)
- Aesthetic direction (brutally minimal, editorial, playful, etc.)
- Product-specific color overrides or extensions
- Typography adjustments (a marketing site might use a display serif even if the
  company standard is a geometric sans)
- Spacing density overrides (a data dashboard might go compact even if the
  company default is comfortable)
- Motion personality
- Decisions log tracking why choices were made

**How to create it:** Run `/design-consultation`. The skill walks through product
context, optional competitive research, a complete design proposal, and writes
the final `DESIGN.md`.

**DESIGN.md structure:**

```markdown
# Design System -- [Product Name]

## Product Context
## Aesthetic Direction
## Typography
## Color
## Spacing
## Layout
## Motion
## Decisions Log
```

See the full schema in the `/design-consultation` skill (Phase 6).

---

## Token cascade

When a design skill needs a token value, it resolves through the three levels.
The first level that defines a value wins, checked from most specific to least:

```
Product DESIGN.md  -->  Company config  -->  Toolkit defaults
   (level 3)             (level 2)           (level 1)
```

### Cascade example

Suppose Acme Corp has a company config with navy `#1A1A2E` as primary and
Instrument Sans as body font. Their new dashboard product has its own DESIGN.md.

| Token | Level 1 (toolkit) | Level 2 (Acme Corp) | Level 3 (dashboard) | Resolved value |
|-------|-------------------|---------------------|---------------------|----------------|
| Primary color | `#0066FF` | `#1A1A2E` | -- | `#1A1A2E` (company) |
| Secondary color | -- | `#E94560` | `#16A34A` | `#16A34A` (product) |
| Body font | (recommends Instrument Sans, DM Sans, etc.) | Instrument Sans | -- | Instrument Sans (company) |
| Display font | (recommends Satoshi, Cabinet Grotesk, etc.) | Cabinet Grotesk | Fraunces | Fraunces (product) |
| Spacing base | `4px` | `8px` | -- | `8px` (company) |
| Spacing density | comfortable | comfortable | compact | compact (product) |
| Motion approach | minimal-functional | intentional | -- | intentional (company) |
| Border radius sm | `4px` | -- | `2px` | `2px` (product) |

The dashboard inherits Acme's navy primary and Instrument Sans body, but
overrides the display font to Fraunces (a serif that adds editorial weight to
the dashboard headers) and tightens spacing density to compact for data-heavy
views.

---

## How design skills consume the hierarchy

Three skills read and act on DESIGN.md:

### /design-consultation

Creates the level 3 DESIGN.md from scratch. Walks through product context,
competitive research, a complete design proposal (aesthetic, typography, color,
spacing, layout, motion), generates a preview, and writes `DESIGN.md` to the
repo root. Also updates `CLAUDE.md` to enforce design system adherence across
all future AI interactions.

**Hierarchy behavior:** Reads company-level tokens (if they exist) as defaults
when proposing the product design system. The user can accept company defaults
or override them per-product.

### /design-review

Audits a live site against the design system. Reads `DESIGN.md` to calibrate
its visual review -- deviations from the declared design system are flagged as
higher severity than general design issues. If no DESIGN.md exists, it uses
universal design principles and offers to create one from the inferred system.

**Hierarchy behavior:** Treats DESIGN.md as the authoritative source. Company
tokens are relevant only if DESIGN.md references them. The review compares
what's rendered in the browser against what DESIGN.md declares.

### /design-shotgun

Generates multiple AI design variants for visual exploration. Reads `DESIGN.md`
to constrain variant generation within the established design system. Tells the
user: "I'll follow your design system in DESIGN.md by default. If you want to
go off the reservation on visual direction, just say so."

**Hierarchy behavior:** Uses DESIGN.md tokens as constraints for variant
generation. If the user asks to explore outside those constraints, the skill
follows their lead. Prior approved variants (taste memory) also influence
generation.

### /design-html

Turns approved mockups into production-quality HTML/CSS. Reads `DESIGN.md`
tokens and uses them as overrides for system-level properties (brand colors,
font family, spacing scale). If no DESIGN.md exists, it offers to create one by
extracting tokens from the HTML it just built.

**Hierarchy behavior:** DESIGN.md tokens override values extracted from mockups
for system-level properties. This ensures the final HTML matches the declared
design system even if the AI mockup drifted slightly.

---

## Future: Design token distribution

Today, DESIGN.md is a human-readable reference consumed by AI design skills.
The tokens live as structured markdown and are interpreted at skill runtime.

Planned distribution formats:

### CSS custom properties

```css
:root {
  --color-primary: #1A1A2E;
  --color-secondary: #16A34A;
  --color-neutral-50: #FAFAFA;
  --color-neutral-900: #171717;
  --font-display: 'Fraunces', serif;
  --font-body: 'Instrument Sans', sans-serif;
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --radius-sm: 2px;
  --radius-md: 8px;
  --ease-enter: ease-out;
  --duration-short: 200ms;
  /* ... full scale generated from resolved cascade */
}
```

### Tailwind theme extension

```js
// tailwind.config.js — generated from DESIGN.md
module.exports = {
  theme: {
    extend: {
      colors: { primary: '#1A1A2E', secondary: '#16A34A' },
      fontFamily: { display: ['Fraunces', 'serif'], body: ['Instrument Sans', 'sans-serif'] },
      spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px' },
      borderRadius: { sm: '2px', md: '8px', lg: '12px', full: '9999px' },
    },
  },
}
```

### Figma variables (via Figma REST API)

Export DESIGN.md tokens as Figma variables so designers and engineers share a
single source of truth. The cascade still applies: company-level variables are
published to a shared Figma library; product-level variables override them in
product-specific Figma files.

### Token export command

A future `jstack tokens export` command will read the resolved cascade
(toolkit + company + product) and emit tokens in the requested format:

```bash
jstack tokens export --format css     > tokens.css
jstack tokens export --format tailwind > tailwind.tokens.js
jstack tokens export --format figma    # pushes to Figma API
jstack tokens export --format json     > tokens.json
```

This ensures the cascade resolution happens once, and every downstream consumer
gets the same resolved values.
