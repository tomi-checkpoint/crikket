import { env } from "@crikket/env/web"
import { headers } from "next/headers"
import { cache } from "react"

const SSR_SERVER_URL =
  process.env.SSR_SERVER_URL?.replace(/\/$/, "") ||
  env.NEXT_PUBLIC_SERVER_URL.replace(/\/$/, "")

export const getProtectedAuthData = cache(async () => {
  const cookieHeader = (await headers()).get("cookie") ?? ""

  const fetchInit = {
    headers: { cookie: cookieHeader },
    cache: "no-store" as const,
  }

  const sessionResponse = await fetch(
    `${SSR_SERVER_URL}/api/auth/get-session`,
    fetchInit
  ).catch(() => null)

  const sessionData = sessionResponse?.ok
    ? await sessionResponse.json().catch(() => null)
    : null

  if (!sessionData?.session) {
    return { organizations: [], session: null }
  }

  const organizationsResponse = await fetch(
    `${SSR_SERVER_URL}/api/auth/organization/list`,
    fetchInit
  ).catch(() => null)

  const organizations = organizationsResponse?.ok
    ? ((await organizationsResponse.json().catch(() => [])) as unknown[])
    : []

  return {
    organizations: Array.isArray(organizations) ? organizations : [],
    session: sessionData,
  }
})
