import type { authClient } from "@crikket/auth/client"
import { env } from "@crikket/env/web"
import { headers } from "next/headers"
import { cache } from "react"

type SessionPayload = Awaited<
  ReturnType<typeof authClient.getSession>
>["data"]

type Organization = typeof authClient.$Infer.Organization

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

  const sessionData = (sessionResponse?.ok
    ? await sessionResponse.json().catch(() => null)
    : null) as SessionPayload

  if (!sessionData?.session) {
    return { organizations: [] as Organization[], session: null }
  }

  const organizationsResponse = await fetch(
    `${SSR_SERVER_URL}/api/auth/organization/list`,
    fetchInit
  ).catch(() => null)

  const organizationsRaw = organizationsResponse?.ok
    ? await organizationsResponse.json().catch(() => [])
    : []

  const organizations = (
    Array.isArray(organizationsRaw) ? organizationsRaw : []
  ) as Organization[]

  return {
    organizations,
    session: sessionData,
  }
})
