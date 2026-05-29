/**
 * MSW handlers for `/api/v1/auth/*` and `/api/v1/profile`.
 *
 * The default export covers the happy path for every endpoint so tests
 * that touch auth indirectly (e.g. profile-gated screens) don't have to
 * register their own. Named helpers return one-off handlers tests pass
 * to `server.use(...)` to model failure modes — e.g.
 * `mockLoginInvalidCredentials()` for the 401 path.
 *
 * The profile endpoint lives at `/api/v1/profile` (there is no
 * `/api/v1/auth/me`); a `mockProfileSuccess` helper is exported here
 * because the profile is the auth-derived "current user" surface.
 */

import type { HttpHandler } from "msw";

import { http, HttpResponse } from "msw";

import { makeProfile } from "../../factories/user";

const ACCESS_TOKEN = "test-access-token";
const REFRESH_TOKEN = "test-refresh-token";

function tokens(): { accessToken: string; refreshToken: string; expiresIn: number } {
	return {
		accessToken: ACCESS_TOKEN,
		refreshToken: REFRESH_TOKEN,
		expiresIn: 3600,
	};
}

// ─── Happy-path defaults ────────────────────────────────────────────────────

const authHandlers: HttpHandler[] = [
	http.post("*/api/v1/auth/login", () => HttpResponse.json(tokens())),

	http.post("*/api/v1/auth/signup", () => HttpResponse.json(
		{
			email: "new@example.com",
			userId: "user-new",
			cancellationToken: "00000000-0000-0000-0000-000000000001",
		},
		{ status: 201 },
	)),

	http.post("*/api/v1/auth/verify-otp", () => HttpResponse.json(tokens())),

	http.post("*/api/v1/auth/resend-otp", () => new HttpResponse(null, { status: 204 })),

	http.post("*/api/v1/auth/refresh", () => HttpResponse.json(tokens())),

	http.post("*/api/v1/auth/change-password", () => new HttpResponse(null, { status: 204 })),

	http.post("*/api/v1/auth/logout", () => new HttpResponse(null, { status: 204 })),

	http.delete("*/api/v1/auth/account", () => new HttpResponse(null, { status: 204 })),

	// Profile = the closest analogue to "current user". Hangs on a separate
	// route under /api/v1/profile, but stays in this file because it's the
	// auth-derived me-endpoint.
	http.get("*/api/v1/profile", () => HttpResponse.json(makeProfile())),
];

export default authHandlers;

// ─── Named per-test helpers ─────────────────────────────────────────────────

export function mockLoginSuccess(): HttpHandler {
	return http.post("*/api/v1/auth/login", () => HttpResponse.json(tokens()));
}

export function mockLoginInvalidCredentials(): HttpHandler {
	return http.post("*/api/v1/auth/login", () => HttpResponse.json(
		{ error: "Invalid email or password", code: "AUTH_INVALID_CREDENTIALS" },
		{ status: 401 },
	));
}

export function mockSignupSuccess(email = "new@example.com"): HttpHandler {
	return http.post("*/api/v1/auth/signup", () => HttpResponse.json(
		{
			email,
			userId: "user-new",
			cancellationToken: "00000000-0000-0000-0000-000000000001",
		},
		{ status: 201 },
	));
}

export function mockSignupDuplicateEmail(email = "exists@example.com"): HttpHandler {
	// Duplicate-email path: 201 with userId/cancellationToken=null. This is
	// deliberate enumeration-resistance — see CLAUDE.md §API.
	return http.post("*/api/v1/auth/signup", () => HttpResponse.json(
		{ email, userId: null, cancellationToken: null },
		{ status: 201 },
	));
}

export function mockVerifyOtpSuccess(): HttpHandler {
	return http.post("*/api/v1/auth/verify-otp", () => HttpResponse.json(tokens()));
}

export function mockVerifyOtpInvalid(): HttpHandler {
	return http.post("*/api/v1/auth/verify-otp", () => HttpResponse.json(
		{ error: "Invalid or expired code", code: "AUTH_OTP_INVALID" },
		{ status: 400 },
	));
}

export function mockResendOtpSuccess(): HttpHandler {
	return http.post("*/api/v1/auth/resend-otp", () => new HttpResponse(null, { status: 204 }));
}

export function mockChangePasswordSuccess(): HttpHandler {
	return http.post("*/api/v1/auth/change-password", () => new HttpResponse(null, { status: 204 }));
}

export function mockChangePasswordWrongCurrent(): HttpHandler {
	return http.post("*/api/v1/auth/change-password", () => HttpResponse.json(
		{ error: "Current password is incorrect", code: "AUTH_PASSWORD_INVALID" },
		{ status: 401 },
	));
}

export function mockLogoutSuccess(): HttpHandler {
	return http.post("*/api/v1/auth/logout", () => new HttpResponse(null, { status: 204 }));
}

export function mockDeleteAccountSuccess(): HttpHandler {
	return http.delete("*/api/v1/auth/account", () => new HttpResponse(null, { status: 204 }));
}

export function mockProfileSuccess(profile = makeProfile()): HttpHandler {
	return http.get("*/api/v1/profile", () => HttpResponse.json(profile));
}

export function mockProfileUnauthorized(): HttpHandler {
	return http.get("*/api/v1/profile", () => HttpResponse.json(
		{ error: "Unauthorized", code: "AUTH_TOKEN_INVALID" },
		{ status: 401 },
	));
}
