import type { RenderOptions, RenderResult } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Render helper that wires the minimum provider set every component test needs
 * (right now just TanStack Query).
 *
 * Each call creates a fresh `QueryClient` with `retry: false` so failed-fetch
 * tests don't have to wait for retry backoff. `gcTime: 0` prevents one test's
 * cache from leaking into the next.
 */
function makeQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: 0, staleTime: 0 },
			mutations: { retry: false },
		},
	});
}

interface RenderWithProvidersResult extends RenderResult {
	user: UserEvent;
	queryClient: QueryClient;
}

interface RenderWithProvidersOptions extends Omit<RenderOptions, "wrapper"> {
	queryClient?: QueryClient;
}

export function renderWithProviders(
	ui: ReactElement,
	options: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
	const { queryClient = makeQueryClient(), ...rest } = options;

	function Wrapper({ children }: { children: ReactNode }): ReactElement {
		return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
	}

	const result = render(ui, { wrapper: Wrapper, ...rest });

	return {
		...result,
		user: userEvent.setup(),
		queryClient,
	};
}

// Re-export Testing Library so test files import everything from one place.
export * from "@testing-library/react";
