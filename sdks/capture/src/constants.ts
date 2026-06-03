export const DEFAULT_ENDPOINT = "https://api.crikket.io"
export const DEFAULT_SUBMIT_PATH = "/api/embed/bug-reports"
export const DEFAULT_Z_INDEX = 2_147_483_640
export const MAX_RECENT_EVENT_AGE_MS = 60_000
export const MAX_RECENT_EVENT_COUNT = 250
// Screenshots back-fill from the rolling pre-capture buffer. With eager
// capture the buffer fills from page load, so attach the full retained
// window (not just the last 10s) — there is no reason to discard buffered
// console/network history that we already paid to record.
export const SCREENSHOT_LOOKBACK_MS = MAX_RECENT_EVENT_AGE_MS
export const TRAILING_SLASHES_REGEX = /\/+$/

// Public keys whose embedding sites get debugger/console capture installed
// eagerly at SDK init (so the pre-capture buffer is warm before the user takes
// a screenshot). Every other site stays lazy unless it opts in via
// `init({ eagerDebugger: true })`. Self-hosted fork patch — see CHANGELOG-FORK.md.
export const EAGER_DEBUGGER_KEYS = new Set<string>([
  // coco — joinco.co (app.joinco.co, www.joinco.co, coco-23-88-48-145.nip.io)
  "crk_S0nrUVc8FQJ1dSSZWP6hQIMl",
  // coco crm — coco-crm-production.up.railway.app + gotomarketpro.de
  "crk_ubMoLnZY43VmNs5yt4PdIXo0",
])
