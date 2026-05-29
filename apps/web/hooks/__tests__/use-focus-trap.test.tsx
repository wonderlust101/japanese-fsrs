import { fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useFocusTrap } from "../use-focus-trap";

interface HarnessProps {
	active?: boolean;
	autoFocus?: boolean;
	onEscape?: () => void;
	restoreFocus?: boolean;
}

function Harness({ active = true, autoFocus, onEscape, restoreFocus }: HarnessProps): React.JSX.Element {
	const ref = useRef<HTMLDivElement>(null);
	useFocusTrap(ref, {
		active,
		...(autoFocus !== undefined && { autoFocus }),
		...(onEscape !== undefined && { onEscape }),
		...(restoreFocus !== undefined && { restoreFocus }),
	});
	return (
		<div ref={ref} data-testid="container">
			<button type="button">first</button>
			<button type="button">middle</button>
			<button type="button">last</button>
		</div>
	);
}

// The trap listens on `document`; dispatching on document.body bubbles up to it.
function pressTab(opts: { shiftKey?: boolean } = {}): void {
	fireEvent.keyDown(document.body, { key: "Tab", shiftKey: opts.shiftKey ?? false });
}

beforeEach(() => {
	// jsdom's activeElement persists across renders; reset so each test is isolated.
	(document.activeElement as HTMLElement | null)?.blur?.();
});

afterEach(() => {
	(document.activeElement as HTMLElement | null)?.blur?.();
});

describe("useFocusTrap", () => {
	it("does nothing when inactive (no listener installed)", () => {
		render(<Harness active={false} />);
		const first = screen.getByText("first");
		first.focus();
		pressTab();
		expect(document.activeElement).toBe(first);
	});

	it("wraps Tab from the last element back to the first", () => {
		render(<Harness />);
		screen.getByText("last").focus();
		pressTab();
		expect(document.activeElement).toBe(screen.getByText("first"));
	});

	it("wraps Shift+Tab from the first element to the last", () => {
		render(<Harness />);
		screen.getByText("first").focus();
		pressTab({ shiftKey: true });
		expect(document.activeElement).toBe(screen.getByText("last"));
	});

	it("pulls focus back to the first element when it has escaped the container", () => {
		render(<Harness />);
		// Nothing inside the container is focused → activeElement is <body>, outside it.
		pressTab();
		expect(document.activeElement).toBe(screen.getByText("first"));
	});

	it("leaves a mid-ring Tab to the browser default (no programmatic move)", () => {
		render(<Harness />);
		const middle = screen.getByText("middle");
		middle.focus();
		pressTab();
		expect(document.activeElement).toBe(middle);
	});

	it("calls onEscape when Escape is pressed", () => {
		const onEscape = vi.fn();
		render(<Harness onEscape={onEscape} />);
		screen.getByText("first").focus();
		fireEvent.keyDown(document.body, { key: "Escape" });
		expect(onEscape).toHaveBeenCalledTimes(1);
	});

	it("ignores keys other than Tab and Escape", () => {
		const onEscape = vi.fn();
		render(<Harness onEscape={onEscape} />);
		const first = screen.getByText("first");
		first.focus();
		fireEvent.keyDown(document.body, { key: "a" });
		expect(onEscape).not.toHaveBeenCalled();
		expect(document.activeElement).toBe(first);
	});

	it("autoFocus moves focus to the container on activate", () => {
		render(<Harness autoFocus />);
		expect(document.activeElement).toBe(screen.getByTestId("container"));
	});

	it("restoreFocus returns focus to the previously-focused element on deactivate", () => {
		render(<button type="button" data-testid="outside">outside</button>);
		const outside = screen.getByTestId("outside");
		outside.focus();

		const { unmount } = render(<Harness restoreFocus />);
		// Move focus inside the trap, then deactivate.
		screen.getByText("first").focus();
		unmount();

		expect(document.activeElement).toBe(outside);
	});
});
