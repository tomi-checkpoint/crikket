import { env } from "@crikket/env/server"

/**
 * Syncs both the Cloudflare Turnstile widget's allowed-domains list and the
 * R2 bucket's CORS origins with the hostnames/origins stored on the given
 * capture key.
 *
 * Fire-and-forget: never throws, never blocks. Each downstream sync is
 * independent — failures in one don't cancel the other.
 */
export function syncTurnstileDomainsFromOrigins(
  origins: Iterable<string>
): void {
  const originList = [...origins]
  const hostnames = extractHostnames(originList)
  const normalizedOrigins = normalizeOrigins(originList)

  if (hostnames.length > 0) {
    void syncTurnstile(hostnames).catch((error) => {
      console.warn(
        "[turnstile-sync] failed to update widget domains:",
        error instanceof Error ? error.message : error
      )
    })
  }

  if (normalizedOrigins.length > 0) {
    void syncR2Cors(normalizedOrigins).catch((error) => {
      console.warn(
        "[turnstile-sync] failed to update R2 bucket CORS:",
        error instanceof Error ? error.message : error
      )
    })
  }
}

async function syncTurnstile(newHostnames: string[]): Promise<void> {
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
  if (existing.size === before) return

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

interface R2CorsRule {
  allowed: {
    origins: string[]
    methods: string[]
    headers?: string[]
  }
  exposeHeaders?: string[]
  maxAgeSeconds?: number
}

async function syncR2Cors(newOrigins: string[]): Promise<void> {
  const token = env.CLOUDFLARE_API_TOKEN
  const accountId = env.CLOUDFLARE_ACCOUNT_ID
  const bucket = env.STORAGE_BUCKET

  if (!token || !accountId || !bucket) return

  const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${encodeURIComponent(bucket)}/cors`
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }

  const currentResponse = await fetch(base, { headers })
  if (!currentResponse.ok) {
    throw new Error(`GET R2 CORS failed: HTTP ${currentResponse.status}`)
  }
  const current = (await currentResponse.json()) as {
    result?: { rules?: R2CorsRule[] }
  }
  const rules = current.result?.rules ?? []

  // Find the first rule whose methods include PUT — that's the direct-upload
  // rule we manage. If none exists, seed a new one.
  let managed = rules.find((rule) =>
    rule.allowed?.methods?.some((m) => m.toUpperCase() === "PUT")
  )
  const others = managed ? rules.filter((r) => r !== managed) : rules

  if (!managed) {
    managed = {
      allowed: {
        origins: [],
        methods: ["GET", "HEAD", "PUT"],
        headers: ["Content-Type", "Authorization"],
      },
      exposeHeaders: ["ETag"],
      maxAgeSeconds: 3600,
    }
  }

  const existing = new Set(
    (managed.allowed.origins ?? []).map((o) => o.toLowerCase())
  )
  const before = existing.size
  for (const origin of newOrigins) existing.add(origin.toLowerCase())
  if (existing.size === before) return

  const nextRule: R2CorsRule = {
    allowed: {
      origins: [...existing],
      methods: managed.allowed.methods?.length
        ? managed.allowed.methods
        : ["GET", "HEAD", "PUT"],
      headers: managed.allowed.headers?.length
        ? managed.allowed.headers
        : ["Content-Type", "Authorization"],
    },
    exposeHeaders: managed.exposeHeaders?.length
      ? managed.exposeHeaders
      : ["ETag"],
    maxAgeSeconds: managed.maxAgeSeconds ?? 3600,
  }

  const updateResponse = await fetch(base, {
    method: "PUT",
    headers,
    body: JSON.stringify({ rules: [...others, nextRule] }),
  })
  if (!updateResponse.ok) {
    const body = await updateResponse.text().catch(() => "")
    throw new Error(
      `PUT R2 CORS failed: HTTP ${updateResponse.status} ${body.slice(0, 200)}`
    )
  }
}

/**
 * `https://example.com:8443/foo` → `example.com`. Skips non-http(s) and
 * malformed entries. Turnstile wants bare hostnames.
 */
function extractHostnames(origins: Iterable<string>): string[] {
  const out = new Set<string>()
  for (const origin of origins) {
    try {
      const url = new URL(origin)
      if (url.protocol !== "http:" && url.protocol !== "https:") continue
      if (url.hostname) out.add(url.hostname.toLowerCase())
    } catch {}
  }
  return [...out]
}

/**
 * `https://example.com:8443/foo` → `https://example.com:8443`. R2 CORS
 * wants scheme+host (+port), no path.
 */
function normalizeOrigins(origins: Iterable<string>): string[] {
  const out = new Set<string>()
  for (const origin of origins) {
    try {
      const url = new URL(origin)
      if (url.protocol !== "http:" && url.protocol !== "https:") continue
      out.add(
        `${url.protocol.toLowerCase()}//${url.host.toLowerCase()}`
      )
    } catch {}
  }
  return [...out]
}
