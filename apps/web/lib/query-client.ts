'use client'

import { QueryClient } from '@tanstack/react-query'

// One shared QueryClient instance — created lazily on first use so it is
// never instantiated on the server (server components don't need it).
let client: QueryClient | null = null

export function getQueryClient(): QueryClient {
  if (client === null) {
    client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000,
        },
      },
    })
  }
  return client
}
