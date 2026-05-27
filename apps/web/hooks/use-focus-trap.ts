import type { RefObject } from "react";
import { useEffect } from "react";

interface FocusTrapOptions {
	/** When false, the trap is inactive — no listeners, no focus moves. */
	active: boolean;
	/**
	 * Move focus to the first focusable element on activate. Off by default:
	 *  full-screen takeovers manage their own initial focus; dismissible modals
	 *  want it on.
	 */
	autoFocus?: boolean;
	/** Called when Escape is pressed inside the trap. Omit to ignore Escape. */
	onEscape?: () => void;
	/**
	 * Restore focus to the previously-focused element when the trap deactivates.
	 *  On for dismissible modals; off for route-level takeovers, where navigation
	 *  owns focus on the way out.
	 */
	restoreFocus?: boolean;
}

// Tabbable elements. Excludes [disabled] and tabindex="-1". Deliberately does
// NOT filter by visibility (offsetParent), so position:fixed descendants — which
// have no offsetParent — are still included (the session bars are fixed).
const FOCUSABLE_SELECTOR
	= "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex=\"-1\"])";

/**
 * Contains keyboard focus within `ref` while `active`. Re-implements the focus
 * management that native `<dialog>` / `showModal()` provides for free, for
 * surfaces that can't use it (portals, full-screen route overlays). Modelled on
 * the working trap in `app/(app)/_components/mobile-drawer.tsx`.
 *
 * - Tab / Shift+Tab cycle within the container, and focus is pulled back in if
 *   it escapes.
 * - `autoFocus` moves focus in on activate; `restoreFocus` returns it on deactivate.
 * - `onEscape` wires Escape-to-dismiss.
 *
 * Pass a stable `onEscape` (e.g. a prop or useCallback) — it is an effect dep.
 */
export function useFocusTrap(
	ref: RefObject<HTMLElement | null>,
	{ active, autoFocus = false, onEscape, restoreFocus = false }: FocusTrapOptions,
): void {
	useEffect(() => {
		if (!active)
			return undefined;
		const container = ref.current;
		if (container === null)
			return undefined;

		const previouslyFocused
			= restoreFocus && document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;

		const focusable = (): HTMLElement[] =>
			Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

		if (autoFocus) {
			// Focus the container itself (it carries tabIndex={-1}): the dialog label
			// is announced and Tab then proceeds into the controls. Avoids landing on
			// an arbitrary first child such as a full-bleed backdrop dismiss button.
			if (!container.hasAttribute("tabindex"))
				container.tabIndex = -1;
			container.focus();
		}

		function onKeyDown(e: KeyboardEvent): void {
			if (e.key === "Escape" && onEscape !== undefined) {
				e.preventDefault();
				onEscape();
				return;
			}
			if (e.key !== "Tab" || container === null)
				return;
			const ring = focusable();
			const first = ring[0];
			const last = ring[ring.length - 1];
			if (first === undefined || last === undefined)
				return;
			const activeEl = document.activeElement;
			// Focus escaped the container (or never entered) — pull it back.
			if (activeEl === null || !container.contains(activeEl)) {
				e.preventDefault();
				first.focus();
				return;
			}
			if (e.shiftKey && activeEl === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && activeEl === last) {
				e.preventDefault();
				first.focus();
			}
		}

		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			if (previouslyFocused !== null)
				previouslyFocused.focus();
		};
	}, [active, autoFocus, onEscape, restoreFocus, ref]);
}
