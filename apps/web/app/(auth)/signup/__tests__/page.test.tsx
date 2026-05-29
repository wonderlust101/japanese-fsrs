import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { verifyOtpAction } from "@/lib/actions/auth.actions";

import { useUserStore } from "@/stores/useUserStore";
import {
	mockSignupDuplicateEmail,
	mockSignupSuccess,
} from "@/test/msw/handlers/auth";

import { server } from "@/test/msw/server";

import { renderWithProviders, screen, waitFor, within } from "@/test/test-utils";

import SignupPage from "../page";

// The signup page reads NEXT_PUBLIC_API_URL via the env-validating module.
// Vitest doesn't load .env.local, so the validator would crash at import. Mock
// it with the values the app expects in local dev.
vi.mock("@/lib/env", () => ({
	env: {
		NEXT_PUBLIC_API_URL: "http://localhost:3001",
		NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
		NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-test",
		NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
	},
}));

vi.mock("@/lib/actions/auth.actions", () => ({
	loginAction: vi.fn(),
	verifyOtpAction: vi.fn(),
	resendOtpAction: vi.fn(),
	requestPasswordResetAction: vi.fn(),
	verifyRecoveryOtpAction: vi.fn(),
	updatePasswordAction: vi.fn(),
	signOutAction: vi.fn(),
	signOutEverywhereAction: vi.fn(),
	changePasswordAction: vi.fn(),
	deleteAccountAction: vi.fn(),
}));

const mockedVerifyOtpAction = vi.mocked(verifyOtpAction);

beforeEach(() => {
	mockedVerifyOtpAction.mockReset();
	// Reduced motion shortcuts the GSAP timeline so it doesn't tween away the
	// fields we want to assert against.
	if (typeof window !== "undefined") {
		Object.defineProperty(window, "matchMedia", {
			writable: true,
			value: () => ({
				matches: true,
				media: "(prefers-reduced-motion: reduce)",
				onchange: null,
				addListener: vi.fn(),
				removeListener: vi.fn(),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				dispatchEvent: vi.fn(() => true),
			}),
		});
	}
});

afterEach(() => {
	// Reset zustand stores between tests
	useUserStore.getState().actions.reset();
	mockedVerifyOtpAction.mockReset();
});

describe("signupPage", () => {
	describe("renders main content", () => {
		it("renders the create-account heading", () => {
			renderWithProviders(<SignupPage />);
			expect(screen.getByRole("heading", { name: /create your account/i })).toBeInTheDocument();
		});

		it("renders Email, Display name, Password and Confirm password fields", () => {
			renderWithProviders(<SignupPage />);
			expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
			expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
			expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
			expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
		});

		it("renders the Create account submit button", () => {
			renderWithProviders(<SignupPage />);
			expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
		});
	});

	describe("validation", () => {
		it("flags a malformed email and blocks submission", async () => {
			const { user } = renderWithProviders(<SignupPage />);

			await user.type(screen.getByLabelText(/email/i), "bad");
			await user.type(screen.getByLabelText(/display name/i), "Test User");
			await user.type(screen.getByLabelText(/^password/i), "Hunter2222");
			await user.type(screen.getByLabelText(/confirm password/i), "Hunter2222");
			await user.click(screen.getByRole("button", { name: /create account/i }));

			expect(await screen.findByText(/email address looks off/i)).toBeInTheDocument();
		});

		it("flags non-matching confirm password", async () => {
			const { user } = renderWithProviders(<SignupPage />);

			await user.type(screen.getByLabelText(/email/i), "user@example.com");
			await user.type(screen.getByLabelText(/display name/i), "Test User");
			await user.type(screen.getByLabelText(/^password/i), "Hunter2222");
			await user.type(screen.getByLabelText(/confirm password/i), "Different222");
			await user.click(screen.getByRole("button", { name: /create account/i }));

			expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
		});

		it("flags an empty confirm password", async () => {
			const { user } = renderWithProviders(<SignupPage />);

			await user.type(screen.getByLabelText(/email/i), "user@example.com");
			await user.type(screen.getByLabelText(/display name/i), "Test User");
			await user.type(screen.getByLabelText(/^password/i), "Hunter2222");
			await user.click(screen.getByRole("button", { name: /create account/i }));

			expect(await screen.findByText(/please confirm your password/i)).toBeInTheDocument();
		});
	});

	describe("submit", () => {
		it("advances to the verify view on success", async () => {
			server.use(mockSignupSuccess("user@example.com"));
			const { user } = renderWithProviders(<SignupPage />);

			await user.type(screen.getByLabelText(/email/i), "user@example.com");
			await user.type(screen.getByLabelText(/display name/i), "Test User");
			await user.type(screen.getByLabelText(/^password/i), "Hunter2222");
			await user.type(screen.getByLabelText(/confirm password/i), "Hunter2222");
			await user.click(screen.getByRole("button", { name: /create account/i }));

			expect(await screen.findByRole("heading", { name: /quick check/i })).toBeInTheDocument();
		});

		it("renders the SAME success UI for a duplicate-email response (no enumeration)", async () => {
			server.use(mockSignupDuplicateEmail("exists@example.com"));
			const { user } = renderWithProviders(<SignupPage />);

			await user.type(screen.getByLabelText(/email/i), "exists@example.com");
			await user.type(screen.getByLabelText(/display name/i), "Test User");
			await user.type(screen.getByLabelText(/^password/i), "Hunter2222");
			await user.type(screen.getByLabelText(/confirm password/i), "Hunter2222");
			await user.click(screen.getByRole("button", { name: /create account/i }));

			// Same Quick check heading — UI must not branch on the duplicate path.
			expect(await screen.findByRole("heading", { name: /quick check/i })).toBeInTheDocument();
			// No error indicator at the form level.
			expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		});

		it("shows a form-level error when the API rejects", async () => {
			server.use(
				http.post("*/api/v1/auth/signup", () => HttpResponse.json(
					{ error: "Too many requests" },
					{ status: 429 },
				)),
			);
			const { user } = renderWithProviders(<SignupPage />);

			await user.type(screen.getByLabelText(/email/i), "user@example.com");
			await user.type(screen.getByLabelText(/display name/i), "Test User");
			await user.type(screen.getByLabelText(/^password/i), "Hunter2222");
			await user.type(screen.getByLabelText(/confirm password/i), "Hunter2222");
			await user.click(screen.getByRole("button", { name: /create account/i }));

			const alert = await screen.findByRole("alert");
			expect(alert).toHaveTextContent(/lots of attempts in a row/i);
		});
	});

	describe("verify view", () => {
		async function advanceToVerify(): Promise<{ user: ReturnType<typeof renderWithProviders>["user"] }> {
			server.use(mockSignupSuccess("user@example.com"));
			const { user } = renderWithProviders(<SignupPage />);
			await user.type(screen.getByLabelText(/email/i), "user@example.com");
			await user.type(screen.getByLabelText(/display name/i), "Test User");
			await user.type(screen.getByLabelText(/^password/i), "Hunter2222");
			await user.type(screen.getByLabelText(/confirm password/i), "Hunter2222");
			await user.click(screen.getByRole("button", { name: /create account/i }));
			await screen.findByRole("heading", { name: /quick check/i });
			return { user };
		}

		it("calls verifyOtpAction once the 6th digit is entered", async () => {
			mockedVerifyOtpAction.mockResolvedValueOnce(undefined);
			const { user } = await advanceToVerify();

			const group = screen.getByRole("group", { name: /one-time password/i });
			const digits = within(group).getAllByRole("textbox");
			for (let i = 0; i < 6; i++) {
				const el = digits[i];
				if (el === undefined)
					throw new Error("missing digit");
				await user.type(el, String(i + 1));
			}

			await waitFor(() => {
				expect(mockedVerifyOtpAction).toHaveBeenCalledWith("user@example.com", "123456");
			});
		});

		it("returns to the form view when the back button is clicked", async () => {
			// The back path POSTs to /cancel-signup; intercept with a 204 so the
			// request doesn't error in MSW's "onUnhandledRequest" mode.
			server.use(
				http.post("*/api/v1/auth/cancel-signup", () => new HttpResponse(null, { status: 204 })),
			);
			const { user } = await advanceToVerify();

			await user.click(screen.getByRole("button", { name: /use a different email/i }));

			expect(
				await screen.findByRole("heading", { name: /create your account/i }),
			).toBeInTheDocument();
		});
	});
});
