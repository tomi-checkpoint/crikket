import { env } from "@crikket/env/server"

/**
 * Syncs the Cloudflare Turnstile widget's allowed-domains list with the union
 * of all hostnames present across every capture key's allowedOrigins.
 *
 * Fire-and-forget: never throws. If any of the required env vars
 * (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, TURNSTILE_SITE_KEY) are
 * missing, this is a no-op — the instance is either running without
 * Turnstile or without Cloudflare API access, and key creation should
 * still succeed.
 */
export function syncTurnstileDomainsFromOrigins(
  origins: Iterable<string>
): void {
  const hostnames = extractHostnames(origins)
  if (hostnames.length === 0) return

  // Deliberately not awaited — runs in the background after the procedure
  // responds to the caller.
  void performSync(hostnames).catch((error) => {
    console.warn(
      "[turnstile-sync] failed to update widget domains:",
      error instanceof Error ? error.message : error
    )
  })
}

async function performSync(newHostnames: string[]): Promise<void> {
  const token = env.CLOUDFLARE_API_TOKEN
  const accountId = env.CLOUDFLARE_ACCOUNT_ID
  const sitekey = env.TURNSTILE_SITE_KEY

  if (!token || !accountId || !sitekey) return

  const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}/challenges/widgets/${sitekey}`
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }

  const currentResponse = await fetch(base, { headers })
  if (!currentResponse.ok) {
    throw new Error(`GET widget failed: HTTP ${currentResponse.status}`)
  }
  const current = (await currentResponse.json()) as {
    result?: {
      name?: string
      domains?: string[]
      mode?: string
      bot_fight_mode?: boolean
      region?: string
    }
  }
  const widget = current.result
  if (!widget) throw new Error("GET widget: empty result")

  const existing = new Set((widget.domains ?? []).map((d) => d.toLowerCase()))
  const before = existing.size
  for (const host of newHostnames) existing.add(host.toLowerCase())
  if (existing.size === before) return // nothing to add

  const updateResponse = await fetch(base, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      name: widget.name ?? "crikket-self-host",
      domains: [...existing],
      mode: widget.mode ?? "managed",
      bot_fight_mode: widget.bot_fight_mode ?? false,
      region: widget.region ?? "world",
    }),
  })
  if (!updateResponse.ok) {
    const body = await updateResponse.text().catch(() => "")
    throw new Error(
      `PUT widget failed: HTTP ${updateResponse.status} ${body.slice(0, 200)}`
    )
  }
}

/**
 * Turns stored origins like `https://example.com:8443` into the bare
 * hostnames Turnstile expects (`example.com`). Invalid or non-http(s)
 * entries are skipped.
 */
function extractHostnames(origins: Iterable<string>): string[] {
  const out = new Set<string>()
  for (const origin of origins) {
    try {
      const url = new URL(origin)
      if (url.protocol !== "http:" && url.protocol !== "https:") continue
      if (url.hostname) out.add(url.hostname.toLowerCase())
    } catch {
      // ignore malformed entries
    }
  }
  return [...out]
}
