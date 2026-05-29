import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	requestPasswordResetAction,
	updatePasswordAction,
	verifyRecoveryOtpAction,
} from "@/lib/actions/auth.actions";

import { renderWithProviders, screen, waitFor, within } from "@/test/test-utils";

import ForgotPasswordPage from "../page";

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

const mockedRequest = vi.mocked(requestPasswordResetAction);
const mockedVerify = vi.mocked(verifyRecoveryOtpAction);
const mockedUpdate = vi.mocked(updatePasswordAction);

beforeEach(() => {
	mockedRequest.mockReset();
	mockedVerify.mockReset();
	mockedUpdate.mockReset();
	// Pretend reduced-motion is on so GSAP timelines short-circuit and don't
	// fight the assertions for layout state.
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
	mockedRequest.mockReset();
	mockedVerify.mockReset();
	mockedUpdate.mockReset();
});

describe("forgotPasswordPage", () => {
	describe("request view", () => {
		it("renders the reset heading and the email field", () => {
			renderWithProviders(<ForgotPasswordPage />);

			expect(screen.getByRole("heading", { name: /reset your password/i })).toBeInTheDocument();
			expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
			expect(screen.getByRole("button", { name: /send reset code/i })).toBeInTheDocument();
		});

		it("rejects malformed emails before calling the action", async () => {
			const { user } = renderWithProviders(<ForgotPasswordPage />);

			await user.type(screen.getByLabelText(/email/i), "not-an-email");
			await user.click(screen.getByRole("button", { name: /send reset code/i }));

			expect(await screen.findByText(/email address looks off/i)).toBeInTheDocument();
			expect(mockedRequest).not.toHaveBeenCalled();
		});

		it("advances to the verify view on success", async () => {
			mockedRequest.mockResolvedValueOnce(undefined);
			const { user } = renderWithProviders(<ForgotPasswordPage />);

			await user.type(screen.getByLabelText(/email/i), "user@example.com");
			await user.click(screen.getByRole("button", { name: /send reset code/i }));

			expect(await screen.findByRole("heading", { name: /check your email/i })).toBeInTheDocument();
			expect(mockedRequest).toHaveBeenCalledWith("user@example.com");
		});

		it("advances to verify even if the email isn't registered (enumeration-resistant)", async () => {
			// The action resolves on success AND on unknown-email by design; the
			// UI shouldn't branch on the action result either way.
			mockedRequest.mockResolvedValueOnce(undefined);
			const { user } = renderWithProviders(<ForgotPasswordPage />);

			await user.type(screen.getByLabelText(/email/i), "ghost@example.com");
			await user.click(screen.getByRole("button", { name: /send reset code/i }));

			expect(await screen.findByRole("heading", { name: /check your email/i })).toBeInTheDocument();
		});
	});

	describe("verify view", () => {
		async function advanceToVerify(): Promise<{ user: ReturnType<typeof renderWithProviders>["user"] }> {
			mockedRequest.mockResolvedValueOnce(undefined);
			const { user } = renderWithProviders(<ForgotPasswordPage />);
			await user.type(screen.getByLabelText(/email/i), "user@example.com");
			await user.click(screen.getByRole("button", { name: /send reset code/i }));
			await screen.findByRole("heading", { name: /check your email/i });
			return { user };
		}

		it("renders an OTP input labelled 'One-time password'", async () => {
			await advanceToVerify();
			expect(screen.getByRole("group", { name: /one-time password/i })).toBeInTheDocument();
		});

		it("calls verifyRecoveryOtpAction once the 6th digit is entered", async () => {
			mockedVerify.mockResolvedValueOnce(undefined);
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
				expect(mockedVerify).toHaveBeenCalledWith("user@example.com", "123456");
			});
		});

		it("surfaces a friendly error when the code is invalid", async () => {
			mockedVerify.mockRejectedValueOnce(new Error("Invalid token"));
			const { user } = await advanceToVerify();

			const group = screen.getByRole("group", { name: /one-time password/i });
			const digits = within(group).getAllByRole("textbox");
			for (let i = 0; i < 6; i++) {
				const el = digits[i];
				if (el === undefined)
					throw new Error("missing digit");
				await user.type(el, "0");
			}

			const alert = await screen.findByRole("alert");
			expect(alert).toHaveTextContent(/that code didn't match/i);
		});

		it("returns to the request view when the back button is clicked", async () => {
			const { user } = await advanceToVerify();

			await user.click(screen.getByRole("button", { name: /use a different email/i }));

			expect(await screen.findByRole("heading", { name: /reset your password/i })).toBeInTheDocument();
		});
	});

	describe("reset view", () => {
		async function advanceToReset(): Promise<{ user: ReturnType<typeof renderWithProviders>["user"] }> {
			mockedRequest.mockResolvedValueOnce(undefined);
			mockedVerify.mockResolvedValueOnce(undefined);
			const { user } = renderWithProviders(<ForgotPasswordPage />);
			await user.type(screen.getByLabelText(/email/i), "user@example.com");
			await user.click(screen.getByRole("button", { name: /send reset code/i }));
			await screen.findByRole("heading", { name: /check your email/i });

			const group = screen.getByRole("group", { name: /one-time password/i });
			const digits = within(group).getAllByRole("textbox");
			for (let i = 0; i < 6; i++) {
				const el = digits[i];
				if (el === undefined)
					throw new Error("missing digit");
				await user.type(el, "1");
			}
			await screen.findByRole("heading", { name: /choose a new password/i });
			return { user };
		}

		it("renders the new-password and confirm fields", async () => {
			await advanceToReset();
			expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
			expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
			expect(screen.getByRole("button", { name: /set new password/i })).toBeInTheDocument();
		});

		it("blocks submit when passwords don't match", async () => {
			const { user } = await advanceToReset();

			await user.type(screen.getByLabelText(/new password/i), "ValidPass123");
			await user.type(screen.getByLabelText(/confirm password/i), "DifferentPass");
			await user.click(screen.getByRole("button", { name: /set new password/i }));

			expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
			expect(mockedUpdate).not.toHaveBeenCalled();
		});

		it("blocks submit when the password is too short", async () => {
			const { user } = await advanceToReset();

			await user.type(screen.getByLabelText(/new password/i), "short");
			await user.type(screen.getByLabelText(/confirm password/i), "short");
			await user.click(screen.getByRole("button", { name: /set new password/i }));

			expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
			expect(mockedUpdate).not.toHaveBeenCalled();
		});

		it("calls updatePasswordAction with the new password on submit", async () => {
			mockedUpdate.mockResolvedValueOnce(undefined);
			const { user } = await advanceToReset();

			await user.type(screen.getByLabelText(/new password/i), "ValidPass123");
			await user.type(screen.getByLabelText(/confirm password/i), "ValidPass123");
			await user.click(screen.getByRole("button", { name: /set new password/i }));

			await waitFor(() => {
				expect(mockedUpdate).toHaveBeenCalledWith("ValidPass123");
			});
		});

		it("shows a form-level error when the update fails", async () => {
			mockedUpdate.mockRejectedValueOnce(new Error("Service unavailable"));
			const { user } = await advanceToReset();

			await user.type(screen.getByLabelText(/new password/i), "ValidPass123");
			await user.type(screen.getByLabelText(/confirm password/i), "ValidPass123");
			await user.click(screen.getByRole("button", { name: /set new password/i }));

			const alert = await screen.findByRole("alert");
			expect(alert).toHaveTextContent(/couldn't update your password/i);
		});
	});
});
