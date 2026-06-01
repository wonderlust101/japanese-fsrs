import type { User } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * Returns the authenticated user from the local Supabase session.
 * Reads from browser storage (no network call on mount) so it resolves
 * immediately and does not block layout rendering.
 *
 * - undefined  → query has not resolved yet (rare; storage read is sync)
 * - null       → no session / not signed in
 * - User       → authenticated user with metadata
 */
export function useCurrentUser(): User | null | undefined {
	const { data } = useQuery({
		queryKey: ["auth", "session-user"] as const,
		queryFn: async () => {
			const supabase = createSupabaseBrowserClient();
			const { data: { session } } = await supabase.auth.getSession();
			return session?.user ?? null;
		},
		staleTime: 5 * 60 * 1000,
	});
	return data;
}
