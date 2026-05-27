/**
 * Shared mutable mock for `supabaseAdmin.auth.getUser`.
 *
 * Both `auth-coverage.test.ts` and `auth.middleware.test.ts` mock
 * `db/supabase.ts` and (directly or transitively) load `middleware/auth.ts`.
 * Bun's module cache is process-global, so whichever suite's `mock.module`
 * factory `auth.ts` binds to FIRST wins — a per-file `getUser` stub on the
 * other suite would be silently ignored. Routing both factories through this
 * one shared `getUser` means the middleware always reads the same impl, so a
 * test can drive verification deterministically regardless of bind order.
 */
export interface MockAuthUser { id: string }
export interface GetUserResult {
	data: { user: MockAuthUser | null };
	error: { message: string } | null;
}

const INVALID = (): GetUserResult => ({ data: { user: null }, error: { message: "Invalid JWT" } });

interface SupabaseAuthMock {
	/** Per-test override: maps a bearer token to a getUser result. */
	impl: (token: string) => GetUserResult;
	/** Tokens passed to getUser, in order (assert cache hits / re-verification). */
	calls: string[];
	getUser: (token: string) => Promise<GetUserResult>;
	reset: () => void;
}

export const supabaseAuthMock: SupabaseAuthMock = {
	impl: INVALID,
	calls: [],
	getUser: async (token: string): Promise<GetUserResult> => {
		supabaseAuthMock.calls.push(token);
		return supabaseAuthMock.impl(token);
	},
	reset: (): void => {
		supabaseAuthMock.impl = INVALID;
		supabaseAuthMock.calls = [];
	},
};
