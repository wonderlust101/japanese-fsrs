import { useRouter } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loginAction } from "@/lib/actions/auth.actions";

import { renderWithProviders, screen, waitFor, within } from "@/test/test-utils";

import LoginPage from "../page";

// The login action talks to Supabase directly via a server action. Mock the
// module so the component can resolve the import under jsdom (the action file
// imports server-only / Supabase SSR client which would otherwise blow up).
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

const mockedLoginAction = vi.mocked(loginAction);

describe("loginPage", () => {
	beforeEach(() => {
		// jsdom's `window.location` defaults to `http://localhost/`, but tests
		// poke `?next=...` paths to exercise the redirect guard. Reset before
		// each test so a redirect path from one test doesn't bleed into another.
		window.history.replaceState({}, "", "/login");
	});

	afterEach(() => {
		mockedLoginAction.mockReset();
		vi.mocked(useRouter).mockReset();
	});

	describe("renders main content", () => {
		it("renders the welcome heading", () => {
			renderWithProviders(<LoginPage />);
			expect(
				screen.getByRole("heading", { name: /welcome back\..*ready to practice\?/i }),
			).toBeInTheDocument();
		});

		it("renders Email and Password fields", () => {
			renderWithProviders(<LoginPage />);
			expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
			expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
		});

		it("renders the primary Sign in submit button", () => {
			renderWithProviders(<LoginPage />);
			expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
		});

		it("renders the Forgot password and Sign up links", () => {
			renderWithProviders(<LoginPage />);
			expect(screen.getByRole("link", { name: /forgot password/i })).toBeInTheDocument();
			expect(screen.getByRole("link", { name: /sign up/i })).toBeInTheDocument();
		});
	});

	describe("validation", () => {
		it("shows an email-shape error when the address looks malformed", async () => {
			const { user } = renderWithProviders(<LoginPage />);

			await user.type(screen.getByLabelText(/email/i), "not-an-email");
			await user.type(screen.getByLabelText(/^password$/i), "secret123");
			await user.click(screen.getByRole("button", { name: /sign in/i }));

			expect(await screen.findByText(/email address looks off/i)).toBeInTheDocument();
			// Submission must NOT have fired because validation failed first.
			expect(mockedLoginAction).not.toHaveBeenCalled();
		});

		it("requires a password when email is valid", async () => {
			const { user } = renderWithProviders(<LoginPage />);

			await user.type(screen.getByLabelText(/email/i), "user@example.com");
			await user.click(screen.getByRole("button", { name: /sign in/i }));

			expect(await screen.findByText(/please enter your password/i)).toBeInTheDocument();
			expect(mockedLoginAction).not.toHaveBeenCalled();
		});

		it("clears the email error after the user edits the field", async () => {
			const { user } = renderWithProviders(<LoginPage />);
			const emailInput = screen.getByLabelText(/email/i);

			await user.type(emailInput, "bad");
			await user.click(screen.getByRole("button", { name: /sign in/i }));
			expect(await screen.findByText(/email address looks off/i)).toBeInTheDocument();

			await user.type(emailInput, "@example.com");
			expect(screen.queryByText(/email address looks off/i)).not.toBeInTheDocument();
		});
	});

	describe("submit", () => {
		it("invokes loginAction with trimmed email and password", async () => {
			mockedLoginAction.mockResolvedValueOnce({
				accessToken: "t",
				refreshToken: "r",
				expiresIn: 3600,
			});
			const push = vi.fn();
			const refresh = vi.fn();
			vi.mocked(useRouter).mockReturnValue({
				push,
				replace: vi.fn(),
				refresh,
				back: vi.fn(),
				forward: vi.fn(),
				prefetch: vi.fn(),
			});

			const { user } = renderWithProviders(<LoginPage />);

			await user.type(screen.getByLabelText(/email/i), "user@example.com");
			await user.type(screen.getByLabelText(/^password$/i), "hunter22");
			await user.click(screen.getByRole("button", { name: /sign in/i }));

			await waitFor(() => {
				expect(mockedLoginAction).toHaveBeenCalledWith("user@example.com", "hunter22");
			});
		});

		it("pushes to /today on success when no ?next= is present", async () => {
			mockedLoginAction.mockResolvedValueOnce({
				accessToken: "t",
				refreshToken: "r",
				expiresIn: 3600,
			});
			const push = vi.fn();
			vi.mocked(useRouter).mockReturnValue({
				push,
				replace: vi.fn(),
				refresh: vi.fn(),
				back: vi.fn(),
				forward: vi.fn(),
				prefetch: vi.fn(),
			});

			const { user } = renderWithProviders(<LoginPage />);
			await user.type(screen.getByLabelText(/email/i), "user@example.com");
			await user.type(screen.getByLabelText(/^password$/i), "hunter22");
			await user.click(screen.getByRole("button", { name: /sign in/i }));

			await waitFor(() => {
				expect(push).toHaveBeenCalledWith("/today");
			});
		});

		it("surfaces a friendly form-level error for invalid credentials", async () => {
			mockedLoginAction.mockRejectedValueOnce(new Error("Invalid login credentials"));

			const { user } = renderWithProviders(<LoginPage />);
			await user.type(screen.getByLabelText(/email/i), "user@example.com");
			await user.type(screen.getByLabelText(/^password$/i), "wrong");
			await user.click(screen.getByRole("button", { name: /sign in/i }));

			const alert = await screen.findByRole("alert");
			expect(alert).toHaveTextContent(/that email and password didn't match/i);
		});

		it("shows a help-hint affordance for unrecognized errors", async () => {
			mockedLoginAction.mockRejectedValueOnce(new Error("Some weird server fault"));

			const { user } = renderWithProviders(<LoginPage />);
			await user.type(screen.getByLabelText(/email/i), "user@example.com");
			await user.type(screen.getByLabelText(/^password$/i), "hunter22");
			await user.click(screen.getByRole("button", { name: /sign in/i }));

			const alert = await screen.findByRole("alert");
			expect(alert).toHaveTextContent(/couldn't sign in/i);
			// The unrecognized-error path adds a second inline "get help" link
			// inside the alert block. The page also renders one in the footer,
			// so scope the lookup to the alert.
			expect(within(alert).getByRole("link", { name: /get help/i })).toBeInTheDocument();
		});
	});

	describe("?next= open-redirect guard", () => {
		async function submitWith(nextParam: string, expected: string): Promise<void> {
			window.history.replaceState({}, "", `/login?next=${encodeURIComponent(nextParam)}`);
			mockedLoginAction.mockResolvedValueOnce({
				accessToken: "t",
				refreshToken: "r",
				expiresIn: 3600,
			});
			const push = vi.fn();
			vi.mocked(useRouter).mockReturnValue({
				push,
				replace: vi.fn(),
				refresh: vi.fn(),
				back: vi.fn(),
				forward: vi.fn(),
				prefetch: vi.fn(),
			});

			const { user } = renderWithProviders(<LoginPage />);
			await user.type(screen.getByLabelText(/email/i), "user@example.com");
			await user.type(screen.getByLabelText(/^password$/i), "hunter22");
			await user.click(screen.getByRole("button", { name: /sign in/i }));

			await waitFor(() => {
				expect(push).toHaveBeenCalledWith(expected);
			});
		}

		it("falls back to /today for protocol-relative paths (//evil.example)", async () => {
			await submitWith("//evil.example", "/today");
		});

		it("falls back to /today for backslash-host paths (/\\evil.example)", async () => {
			await submitWith("/\\evil.example", "/today");
		});

		it("falls back to /today for absolute URLs (https://evil.example)", async () => {
			await submitWith("https://evil.example", "/today");
		});

		it("honours app-internal paths (/decks)", async () => {
			await submitWith("/decks", "/decks");
		});
	});
});
