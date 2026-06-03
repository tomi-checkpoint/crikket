# Fork CHANGELOG — Checkpoint self-host

Patches that live in this fork (`tomi-checkpoint/crikket`, branch `master`) but are not in upstream `redpangilinan/crikket`. Read this before deploying the fork so you know which behaviors differ from a stock Crikket install.

Production deploy: `crikket.gotomarketpro.de` (web) + `api.crikket.gotomarketpro.de` (server), via the `crikket` skill at `~/.claude/skills/crikket/`.

## Shipped (committed)

| Commit | Area | What changed | Why |
|--------|------|--------------|-----|
| `a72f497` | `sdks/capture/`, `packages/capture-core/` | Mobile capture fallback: when `getDisplayMedia` is unavailable (iOS Safari, mobile Chrome, insecure contexts), the chooser hides "Record Video", shows an "Upload Image" button, and falls back to `html2canvas-pro` for the screenshot path. | The upstream SDK throws "This browser does not support screen capture" on mobile, which kills feedback on every embedded customer site. Without this, the SDK was useless on iOS. |
| `35aa9b6` | `packages/bug-reports/src/lib/turnstile-sync.ts` | Auto-sync `allowed_origins` from `capture_public_key` saves into Cloudflare R2 bucket CORS. | Onboarding a new customer site previously required a separate `wrangler` step. Now: paste the URL into `/settings/keys`, R2 + Turnstile are configured in the same transaction. |
| `303202a` | `packages/bug-reports/src/lib/turnstile-sync.ts` | Same as above but for Cloudflare Turnstile widget domains. | See above. |
| `d81d850` | `packages/auth/src/client.ts`, `apps/web/src/utils/orpc.ts` | Route SSR-time fetches from `web` → `server` over the Railway *internal* hostname, not the public TLS endpoint. | Railway intercepts public-URL fetches from the same project and rewrites them in a way that breaks Better-Auth's cookie forwarding. SSR auth would fail with "Unable to connect" + TLS errors until this was patched. |
| `f585d63` | `packages/auth/src/client.ts` | Tighten types on the SSR-fetch overrides introduced in `d81d850`. | TS noise after the prior patch. |
| `49de5bf` | `apps/web/src/app/(protected)/_lib/get-protected-auth-data.ts` | Direct `fetch()` with manually forwarded cookies for the protected-route hydration path, bypassing Railway's public-URL interception entirely. | Companion to `d81d850` — different code path, same root cause. |
| `4f3e540` | `sdks/capture/`, `packages/capture-core/`, `apps/web/public/sdk/capture.global.js` | **Eager console/debugger capture.** The debugger page runtime (which monkey-patches `console.*` + network/actions) used to install lazily — only when a capture *session* started — so the `recentEvents` pre-capture buffer was empty at screenshot time and screenshots captured **~0 console logs** (confirmed: 7/7 recent joinco.co screenshot reports had `logs:0`). Now it installs eagerly at `init()` for an allow-list of keys (`EAGER_DEBUGGER_KEYS` — coco/joinco.co + coco crm), and for any site via a new `init({ eagerDebugger: true })` option (pass `false` to opt an allow-listed key out). `SCREENSHOT_LOOKBACK_MS` widened from 10s → the full 60s buffer. The server sink (R2 → `bug_report_log` → CLI `export` `console.md`) already worked; the gap was 100% SDK-side. **Limitation:** eager-from-page-load only applies to the global IIFE build (`capture.global.js`); the npm/ESM lazy build only buffers once its runtime loads on launcher open. | Console logs are the headline input to "export bugs for AI to fix"; they were silently never captured for screenshots (the dominant capture type). |

## Uncommitted (working tree on `master`, May 2026)

The bug-reports dashboard adds two features on top of upstream. Diff lives in the working tree; will be committed in the next ship.

| File | Change |
|------|--------|
| `packages/bug-reports/src/procedures/list-bug-reports.ts` | New `capturePublicKeyIds?: string[]` input. Filters bug reports by origin-prefix matching against the selected keys' `allowed_origins`. |
| `packages/bug-reports/src/procedures/capture-keys.ts` | New `listCaptureKeyLabels` procedure — returns `{id, label, status}` for org members (vs. admin-only `listCaptureKeys`). Used by the filter dropdown. |
| `packages/api/src/routers/capture-key.ts` | Exposes `captureKey.listLabels`. |
| `apps/web/src/app/(protected)/(dashboard)/_components/bug-reports/filters.ts` | Extends `DashboardFilters` with `capturePublicKeyIds`. |
| `apps/web/src/app/(protected)/(dashboard)/_components/bug-reports/bug-reports-toolbar.tsx` | New "Capture Key" group inside the Filters dropdown, fed by `captureKey.listLabels`. Pills for the active selection. |
| `apps/web/src/app/(protected)/(dashboard)/_components/bug-reports/bug-reports-list.tsx` | "Select all visible (N)" / "Clear selection" toggles above the grid. |
| `apps/web/src/app/(protected)/(dashboard)/_components/bug-reports/bug-reports-bulk-actions.tsx` | New "Set status" dropdown for one-click mass status changes (Open / In Progress / Resolved / Closed) — no dialog required. The existing multi-field bulk-edit dialog stays for tag/visibility/priority updates. |
| `apps/web/src/app/(protected)/(dashboard)/_hooks/use-bug-reports-filters.ts` | URL state + clear/reset for the new filter. |
| `apps/web/src/app/(protected)/(dashboard)/_hooks/use-bug-reports-data.ts` | Threads `capturePublicKeyIds` into `bugReport.list` input. |
| `apps/web/src/app/(protected)/(dashboard)/_hooks/use-bug-reports-actions.ts` | New `applyBulkStatus`, `selectAllVisible` helpers. |

### Filter-by-key edge case

Matching is origin-prefix on `bug_report.url`. There is **no FK** from `bug_report` to `capture_public_key`; the SDK doesn't record the key id at submit time. If a key's `allowed_origins` are later edited and no longer match a previously-submitted bug's URL, that bug won't surface under the key. Cost of the no-migration shortcut. Will swap to a stored `capture_public_key_id` column on `bug_report` if this bites.

## Deploy

Both server and web are pushed via the `crikket` skill:

```bash
~/.claude/skills/crikket/bin/crikket deploy-fork server
~/.claude/skills/crikket/bin/crikket deploy-fork web
```

### Shipping an SDK change to production (read this — it has a footgun)

The served bundle at `https://crikket.gotomarketpro.de/sdk/capture.global.js` is **not** built from `sdks/capture/dist/` at deploy time. It is a git-tracked static file at `apps/web/public/sdk/capture.global.js` that Next.js serves verbatim. **Nothing** — not `next build`, not `crikket deploy-fork web` — copies `dist/` into `public/sdk/`. (`deploy-fork web` runs `railway up`, which uploads the working tree; the served file is whatever is in `public/sdk/`.)

So after editing `sdks/capture/src/` or `packages/capture-core/src/`:

```bash
bunx turbo run build --filter=@crikket-io/capture          # builds capture-core then the SDK
cp sdks/capture/dist/capture.global.js apps/web/public/sdk/capture.global.js
git add apps/web/public/sdk/capture.global.js              # commit the regenerated bundle
~/.claude/skills/crikket/bin/crikket deploy-fork web
```

Skip the `cp` and production keeps serving the old bundle (the deploy is a silent no-op for SDK changes). Customer sites load that URL directly; no SRI hash should ever be pinned against it.
