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
| `4f3e540` → reverted | `sdks/capture/`, `packages/capture-core/`, `apps/web/public/sdk/capture.global.js` | **Console/debugger capture installs when the feedback widget opens.** The debugger page runtime monkey-patches `console.*` and wraps `fetch`/XHR. Upstream installed it lazily at capture-*session* start, so screenshots captured **~0 console logs** (the buffer was empty). `4f3e540` tried to fix that by installing **eagerly at page load** for an allow-list of keys — but wrapping `console`/`fetch` before any user action looks like a data skimmer and **hurt host-domain reputation**, so it was rolled back. Current behavior: the runtime installs the moment the user **opens the feedback widget** (launcher-button click or `open()`), never at page load. No allow-list, no `eagerDebugger` option. `SCREENSHOT_LOOKBACK_MS` back to 10s. So a screenshot includes console/network from when the widget was opened onward (reproduce the bug with the widget open to capture it). | Page-load `console`/`fetch` interception triggered skimmer-style security/reputation flags on customer domains. Installing on widget-open keeps capture working for the feedback flow without instrumenting normal page loads. |
| _(pending)_ | `sdks/capture/src/` (runtime + ui), `apps/web/public/sdk/capture.global.js` | **Console-capture session mode.** New **Capture console logs** button in the capture chooser. Clicking it starts an open-ended debugger session (console + click/input steps), closes the chooser so the user can interact with the page (the launcher stays, plus a dock with a 3:00 countdown + Cancel), and records while they reproduce the bug. Re-opening the widget and taking a screenshot finalizes console + steps + screenshot into one report — the screenshot path no longer restarts the session, so the accumulated history is preserved, and re-opening no longer resets it. A 180s timeout (`CONSOLE_SESSION_TIMEOUT_MS`) auto-stops the session if no screenshot is taken. Existing screenshot/video/upload flows unchanged. New files: `ui/capture-widget/sections/console-dock.tsx`, `ui/capture-widget/hooks/use-console-countdown.ts`. E2E-verified: the captured payload carried 5 console logs + the clicks/input as steps through to submit. | Reporters can capture the console output and exact steps that lead to a bug while reproducing it, instead of a screenshot with no surrounding context. |

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

### Shipping an SDK change to production

The served bundle at `https://crikket.gotomarketpro.de/sdk/capture.global.js` is the git-tracked file `apps/web/public/sdk/capture.global.js` that Next.js serves verbatim. As of PR #2, the SDK build **auto-copies** `dist/capture.global.js` → `apps/web/public/sdk/capture.global.js` (`sdks/capture/scripts/build.ts` → `copyFile(..., PUBLIC_GLOBAL_BUNDLE_PATH)`), and the `web` Docker build rebuilds the SDK via turbo `^build`, so a `deploy-fork web` regenerates and serves the bundle from current source. (Earlier this copy was manual — skipping it made deploys a silent no-op for SDK changes. That footgun is now fixed by the automated copy.)

So after editing `sdks/capture/src/` or `packages/capture-core/src/`:

```bash
bunx turbo run build --filter=@crikket-io/capture   # builds capture-core + SDK; auto-copies the bundle into apps/web/public/sdk/
git add sdks/capture apps/web/public/sdk/capture.global.js
~/.claude/skills/crikket/bin/crikket deploy-fork web
```

The served bundle is Railway's build of the committed source, so its bytes (md5) won't match a local build, but the behavior is identical. Customer sites load that URL directly; no SRI hash should ever be pinned against it.
