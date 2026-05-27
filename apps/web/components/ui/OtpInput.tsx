"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OTPInputProps {
	/** Called automatically as soon as all 6 digits are present. */
	onComplete: (otp: string) => void;
	/**
	 * When truthy the component plays the shake animation and shows error borders.
	 * The parent must remount this component (via a changed `key`) each time a
	 * new error should trigger a shake — that resets digits and restarts the
	 * animation with no JS timers or internal useEffect needed.
	 */
	error?: string | null;
	/** Dims the inputs and disables interaction while an API call is in-flight. */
	isLoading?: boolean;
	/**
	 * id of the parent-rendered error message. When `error` is set, the digit
	 * boxes point `aria-describedby` here so the message is programmatically
	 * tied to the controls, not just announced once via the parent's `role="alert"`.
	 */
	errorId?: string;
	/**
	 * Monotonic counter the parent bumps on each verification failure. Drives the
	 * shake + refocus without remounting the component, so the entered digits
	 * survive a wrong code — the user fixes a digit instead of re-typing all six.
	 */
	errorNonce?: number;
	className?: string;
}

// ── OTPInput ──────────────────────────────────────────────────────────────────

export function OTPInput({ onComplete, error, isLoading = false, errorId, errorNonce = 0, className }: OTPInputProps): React.JSX.Element {
	const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
	const [shaking, setShaking] = useState(false);
	const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

	// Focus the first box on mount so the user can type the code straight away
	// without clicking.
	useEffect(() => {
		inputRefs.current[0]?.focus();
	}, []);

	// React to a verification failure: replay the shake and refocus the first box,
	// but keep the entered digits intact. The shake is retriggered by toggling the
	// animation class off then on across a frame (the off→on flip re-fires the CSS
	// animation without remounting the inputs, which would wipe the digits). Skips
	// the initial render (errorNonce starts at 0).
	const firstNonceRef = useRef(true);
	useEffect(() => {
		if (firstNonceRef.current) { firstNonceRef.current = false; return; }
		setShaking(false);
		const raf = requestAnimationFrame(() => setShaking(true));
		inputRefs.current[0]?.focus();
		return () => cancelAnimationFrame(raf);
	}, [errorNonce]);

	function updateDigit(index: number, raw: string) {
		const digit = raw.replace(/\D/g, "").slice(-1);
		const next = digits.slice();
		next[index] = digit;

		setDigits(next);

		if (digit && index < 5) {
			inputRefs.current[index + 1]?.focus();
		}

		if (next.every(d => d !== "")) {
			onComplete(next.join(""));
		}
	}

	function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === "Backspace" && digits[index] === "" && index > 0) {
			inputRefs.current[index - 1]?.focus();
			return;
		}
		if (
			e.key.length === 1
			&& !/\d/.test(e.key)
			&& !e.metaKey
			&& !e.ctrlKey
		) {
			e.preventDefault();
		}
	}

	function handlePaste(e: React.ClipboardEvent) {
		e.preventDefault();
		const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
		if (!pasted)
			return;

		const next = Array<string>(6).fill("").map((_, i) => pasted[i] ?? "");
		setDigits(next);

		inputRefs.current[Math.min(pasted.length, 5)]?.focus();

		if (pasted.length === 6) {
			onComplete(pasted);
		}
	}

	const hasError = !!error;

	return (
		<div
			role="group"
			aria-label="One-time password"
			className={cn(
				"flex items-center gap-1.5 sm:gap-2",
				// Shake is retriggered via the errorNonce effect above, not on mount.
				shaking && "animate-otp-shake",
				className,
			)}
		>
			{digits.map((digit, i) => (
				<input
					key={i}
					ref={(el) => {
						inputRefs.current[i] = el;
					}}
					type="text"
					inputMode="numeric"
					autoComplete={i === 0 ? "one-time-code" : "off"}
					maxLength={1}
					value={digit}
					disabled={isLoading}
					aria-label={`Digit ${i + 1} of 6`}
					aria-invalid={hasError || undefined}
					aria-describedby={hasError && errorId ? errorId : undefined}
					onChange={e => updateDigit(i, e.target.value)}
					onKeyDown={e => handleKeyDown(i, e)}
					onPaste={handlePaste}
					className={cn(
						// Fluid width: the six boxes divide the row equally (flex-1) and
						// cap at 52px, so they reach the original fixed size on sm+ while
						// shrinking to fit narrow phones (down to 320px) instead of being
						// clipped by the card's overflow-hidden. min-w-0 permits the shrink.
						"flex-1 min-w-0 max-w-[52px] h-14 sm:h-[60px]",
						"font-mono text-2xl font-semibold text-center text-sumi-ink",
						"bg-cream-inset rounded-xs",
						"ui-motion-colors",
						// Match the system input focus treatment (Input.tsx): a 1px sumi-ink
						// outline, not a 3px vermillion ring.
						"focus:outline focus:outline-1 focus:outline-offset-2 focus:outline-sumi-ink",
						hasError
							? "border-2 border-error"
							: "border border-soft-hairline",
						isLoading && "opacity-40 cursor-not-allowed",
						i === 2 && "mr-2 sm:mr-4",
					)}
				/>
			))}
		</div>
	);
}
