import type { AppRouterClient } from "@crikket/api/routers/index"

import { env } from "@crikket/env/web"
import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import { createTanstackQueryUtils } from "@orpc/tanstack-query"
import { QueryCache, QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      toast.error(`Error: ${error.message}`, {
        action: {
          label: "retry",
          onClick: query.invalidate,
        },
      })
    },
  }),
})

const orpcBaseURL =
  typeof window === "undefined" && process.env.SSR_SERVER_URL
    ? process.env.SSR_SERVER_URL
    : env.NEXT_PUBLIC_SERVER_URL

export const link = new RPCLink({
  url: `${orpcBaseURL}/rpc`,
  fetch(url, options) {
    return fetch(url, {
      ...options,
      credentials: "include",
    })
  },
  headers: async () => {
    if (typeof window !== "undefined") {
      return {}
    }

    const { headers } = await import("next/headers")
    return Object.fromEntries(await headers())
  },
})

export const client: AppRouterClient = createORPCClient(link)

export const orpc = createTanstackQueryUtils(client)
