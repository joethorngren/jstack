# Upstream Rename Map

Maps gstack paths to jstack equivalents for cherry-picking upstream fixes.

| gstack (upstream) | jstack (this repo) | Notes |
|---|---|---|
| `bin/gstack-*` | `bin/jstack-*` | All 19 shell scripts renamed |
| `bin/gstack-global-discover.ts` | `bin/jstack-global-discover.ts` | TypeScript source |
| `~/.gstack/` | `~/.jstack/` | Config/state directory |
| `$GSTACK_ROOT` | `$JSTACK_ROOT` | Environment variable |
| `$GSTACK_BIN` | `$JSTACK_BIN` | Environment variable |
| `$GSTACK_BROWSE` | `$JSTACK_BROWSE` | Environment variable |
| `$GSTACK_DESIGN` | `$JSTACK_DESIGN` | Environment variable |
| `office-hours/` | `brainstorm/` | Skill directory renamed |
| `garrytan/gstack` | `joethorngren/jstack` | GitHub repo |
| `supabase/` | (deleted) | Telemetry infrastructure removed |
| `bin/gstack-telemetry-*` | (deleted) | Telemetry scripts removed |
| `bin/gstack-analytics` | (deleted) | Analytics script removed |
| `bin/gstack-community-dashboard` | (deleted) | Community dashboard removed |
| `test/telemetry.test.ts` | (deleted) | Telemetry tests removed |
| `supabase/config.sh` | (deleted) | Supabase config removed |
