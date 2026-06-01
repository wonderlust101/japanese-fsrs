import type { RenderOptions, RenderResult } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import { useTopBarStore } from "@/stores/useTopBarStore";

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
		return (
			<QueryClientProvider client={queryClient}>
				<Suspense fallback={<div data-testid="suspense-fallback" />}>
					<TopBarStoreRenderer />
					{children}
				</Suspense>
			</QueryClientProvider>
		);
	}

	const result = render(ui, { wrapper: Wrapper, ...rest });

	return {
		...result,
		user: userEvent.setup(),
		queryClient,
	};
}

/**
 * Renders the top bar store's current override into the test DOM so that
 * component tests can find TopBar-level elements (back links, titles, actions)
 * set via SetTopBar without needing the full (app)/layout. Mirrors what
 * AppTopBar does in production but without the usePathname route-config layer.
 */
function TopBarStoreRenderer(): ReactElement | null {
	const override = useTopBarStore(s => s.override);
	if (!override)
		return null;
	return (
		<div data-testid="test-top-bar">
			{override.backHref !== undefined && (
				<a href={override.backHref} aria-label={override.backAriaLabel ?? "Back"}>
					←
				</a>
			)}
			{override.kanji !== undefined && override.label !== undefined && (
				<span>{override.label}</span>
			)}
			{override.actions}
		</div>
	);
}

// Re-export Testing Library so test files import everything from one place.
export * from "@testing-library/react";
