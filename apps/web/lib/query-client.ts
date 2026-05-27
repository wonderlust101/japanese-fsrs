"use client";

import { isServer, QueryClient } from "@tanstack/react-query";

// QueryProvider is a Client Component, so this module is also evaluated during
// SSR. A module-level singleton shared on the server would leak cache across
// requests (and therefore across users) the moment any server-side prefetch is
// added. The split below — a fresh client per server render, one shared client
// per browser tab — is TanStack's official App Router SSR pattern.
function makeQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 60 * 1000,
			},
		},
	});
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
	// Server: always a brand-new client so no state survives across requests.
	if (isServer)
		return makeQueryClient();
	// Browser: reuse one client for the lifetime of the tab.
	browserQueryClient ??= makeQueryClient();
	return browserQueryClient;
}
