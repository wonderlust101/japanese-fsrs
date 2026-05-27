"use server";

import type { ApiAuthTokens } from "@fsrs-japanese/shared-types";
import { voidResponseSchema } from "@fsrs-japanese/shared-types";

import { apiCall } from "@/lib/api/client";
import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// ─── Sensitive actions ────────────────────────────────────────────────────────
// changePasswordAction and deleteAccountAction now require the user's current
// password as a step-up gate (security audit FIND-001). signOutEverywhereAction
// (FIND-004) revokes refresh tokens across every active session.

export async function loginAction(email: string, password: string): Promise<ApiAuthTokens> {
	const supabase = await createSupabaseServerClient();
	const { data, error } = await supabase.auth.signInWithPassword({ email, password });

	if (error !== null || data.session === null) {
		throw new Error(error?.message ?? "Invalid email or password");
	}

	return {
		accessToken: data.session.access_token,
		refreshToken: data.session.refresh_token,
		expiresIn: data.session.expires_in,
	};
}

export async function verifyOtpAction(email: string, token: string): Promise<void> {
	const supabase = await createSupabaseServerClient();
	const { error } = await supabase.auth.verifyOtp({ email, token, type: "signup" });

	if (error !== null) {
		throw new Error(error.message);
	}
}

export async function resendOtpAction(email: string): Promise<void> {
	const supabase = await createSupabaseServerClient();
	const { error } = await supabase.auth.resend({ type: "signup", email });

	if (error !== null) {
		throw new Error(error.message ?? "Failed to resend code");
	}
}

// ─── Password reset (recovery OTP flow) ───────────────────────────────────────
// Mirrors the signup → verify → done shape: request a code, verify it (which
// establishes a recovery session), then set the new password. All three use the
// SSR client directly, like loginAction/verifyOtpAction, so no Express round-trip.

/**
 * Sends a password-reset email carrying a 6-digit recovery code.
 *
 * Resolves regardless of whether the address is registered — Supabase's
 * `resetPasswordForEmail` does not reveal account existence, and neither does
 * this action. The caller always advances to the code-entry step (account-
 * enumeration policy, same stance as signup).
 */
export async function requestPasswordResetAction(email: string): Promise<void> {
	const supabase = await createSupabaseServerClient();
	// `redirectTo` only matters for the link variant of the email; the code (OTP)
	// path ignores it. Pointed at the reset surface for completeness.
	await supabase.auth.resetPasswordForEmail(email, {
		redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/forgot-password`,
	});
}

/**
 * Verifies the 6-digit recovery code. On success the SSR client persists a
 * recovery session via its cookie handlers, so the subsequent
 * `updatePasswordAction` is authenticated.
 */
export async function verifyRecoveryOtpAction(email: string, token: string): Promise<void> {
	const supabase = await createSupabaseServerClient();
	const { error } = await supabase.auth.verifyOtp({ email, token, type: "recovery" });

	if (error !== null) {
		throw new Error(error.message);
	}
}

/**
 * Sets a new password for the user authenticated by the recovery session
 * established in `verifyRecoveryOtpAction`.
 */
export async function updatePasswordAction(newPassword: string): Promise<void> {
	const supabase = await createSupabaseServerClient();
	const { error } = await supabase.auth.updateUser({ password: newPassword });

	if (error !== null) {
		throw new Error(error.message ?? "Failed to update password");
	}
}

export async function signOutAction(): Promise<void> {
	const supabase = await createSupabaseServerClient();
	await supabase.auth.signOut();
}

export async function signOutEverywhereAction(): Promise<void> {
	const supabase = await createSupabaseServerClient();
	// 'global' revokes every refresh token issued for this user, including the
	// current session. Already-issued access tokens stay valid until their
	// ~1h expiry; that residual window is acceptable given the user has
	// explicitly fired the "I think I'm compromised" trigger.
	await supabase.auth.signOut({ scope: "global" });
}

export async function changePasswordAction(currentPassword: string, newPassword: string): Promise<void> {
	await apiCall<unknown>(
		"/api/v1/auth/change-password",
		voidResponseSchema,
		{
			method: "POST",
			body: JSON.stringify({ currentPassword, newPassword }),
		},
		"Failed to change password",
	);
}

export async function deleteAccountAction(currentPassword: string): Promise<void> {
	await apiCall<unknown>(
		"/api/v1/auth/account",
		voidResponseSchema,
		{
			method: "DELETE",
			body: JSON.stringify({ currentPassword }),
		},
		"Failed to delete account",
	);
	const supabase = await createSupabaseServerClient();
	await supabase.auth.signOut();
}
