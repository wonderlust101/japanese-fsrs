"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
	IconChevronRight,
	IconFlag,
	IconHelp,
	IconSettings,
	IconSignOut,
} from "@/components/icons/chrome-marks";
import { MenuItem } from "@/components/ui/MenuItem";
import { useCurrentUser } from "@/hooks/use-current-user";
import { signOutAction } from "@/lib/actions/auth.actions";
import { getUserDisplayName } from "@/lib/supabase/user-metadata";
import { useHelpDialogActions } from "@/stores/useHelpDialogStore";

interface Props {
	/**
	 * Optional callback fired after the user picks any item or signs out.
	 *  The MobileDrawer passes its `close` action so the drawer collapses
	 *  before the route change takes effect.
	 */
	onItemSelect?: () => void;
}

function NOOP(): void {}

/**
 * The account-strip control that lives at the bottom of every chrome surface
 * (Sidebar and MobileDrawer). The trigger button shows the user's initial
 * badge and display name; tapping it opens a popover with Settings, Report
 * a bug, and Sign out. Click outside or Escape closes.
 *
 * The legacy "Profile" entry was retired: profile-style identity fields
 * (email, display name, native language, timezone, study goal) live as the
 * Account tab inside /settings, and the IA's "no duplicate Profile and
 * Settings destinations" rule meant the menu shortcut was redundant.
 *
 * Icons are the geometric ink-stroke set from `@/components/icons`, sized at
 * 16px in the popover so they read as quiet leading marks beside the labels.
 * On the trigger row the avatar disc replaces a leading icon — the initial
 * carries identity at this position.
 */
export function UserMenu({ onItemSelect = NOOP }: Props): React.JSX.Element {
	const user = useCurrentUser() ?? null;
	const router = useRouter();
	const queryClient = useQueryClient();
	const wrapperRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const [isOpen, setIsOpen] = useState(false);
	const { openHelp } = useHelpDialogActions();

	// Click outside closes the menu.
	useEffect(() => {
		if (!isOpen)
			return;
		function handlePointerDown(e: MouseEvent | TouchEvent): void {
			const wrapper = wrapperRef.current;
			if (wrapper === null)
				return;
			if (!wrapper.contains(e.target as Node))
				setIsOpen(false);
		}
		document.addEventListener("mousedown", handlePointerDown);
		document.addEventListener("touchstart", handlePointerDown);
		return () => {
			document.removeEventListener("mousedown", handlePointerDown);
			document.removeEventListener("touchstart", handlePointerDown);
		};
	}, [isOpen]);

	// Escape closes the menu.
	useEffect(() => {
		if (!isOpen)
			return;
		function handleKey(e: KeyboardEvent): void {
			if (e.key === "Escape") {
				e.preventDefault();
				setIsOpen(false);
				triggerRef.current?.focus();
			}
		}
		document.addEventListener("keydown", handleKey);
		return () => document.removeEventListener("keydown", handleKey);
	}, [isOpen]);

	// On open, move focus into the first menu item (APG menu-button pattern).
	useEffect(() => {
		if (!isOpen)
			return;
		const id = window.setTimeout(() => {
			menuRef.current
				?.querySelector<HTMLElement>("[role=\"menuitem\"]:not([disabled])")
				?.focus();
		}, 0);
		return () => window.clearTimeout(id);
	}, [isOpen]);

	// Roving arrow-key / Home / End navigation across the menu items, matching
	// the DecksMenu reference so every role="menu" in the app behaves the same.
	function onMenuKeyDown(e: React.KeyboardEvent): void {
		const items = Array.from(
			menuRef.current?.querySelectorAll<HTMLElement>("[role=\"menuitem\"]:not([disabled])") ?? [],
		);
		if (items.length === 0)
			return;
		const current = items.indexOf(document.activeElement as HTMLElement);
		if (e.key === "ArrowDown") {
			e.preventDefault();
			items[(current + 1) % items.length]?.focus();
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			items[(current - 1 + items.length) % items.length]?.focus();
		} else if (e.key === "Home") {
			e.preventDefault();
			items[0]?.focus();
		} else if (e.key === "End") {
			e.preventDefault();
			items[items.length - 1]?.focus();
		}
	}

	const displayLabel = getUserDisplayName(user) ?? user?.email ?? "User";
	const initial = displayLabel[0]?.toUpperCase() ?? "?";

	function handleItemClick(): void {
		setIsOpen(false);
		onItemSelect();
	}

	async function handleSignOut(): Promise<void> {
		setIsOpen(false);
		onItemSelect();
		await signOutAction();
		queryClient.clear();
		router.push("/login");
		router.refresh();
	}

	return (
		<div ref={wrapperRef} className="relative">
			<button
				ref={triggerRef}
				type="button"
				onClick={() => setIsOpen(v => !v)}
				onKeyDown={(e) => {
					if (e.key === "ArrowDown") {
						e.preventDefault();
						setIsOpen(true);
					}
				}}
				aria-haspopup="menu"
				aria-expanded={isOpen}
				aria-label="Account menu"
				className="w-full flex items-center gap-2 px-3 py-2 min-h-11 rounded-xs text-base font-medium text-sumi-ink hover:bg-cream-inset focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2 transition-colors"
			>
				<span
					aria-hidden="true"
					className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-vermillion-wash text-xs font-semibold text-inari-vermillion"
				>
					{initial}
				</span>
				<span className="truncate flex-1 text-left">{displayLabel}</span>
				<IconChevronRight
					aria-hidden="true"
					className={`shrink-0 w-4 h-4 text-faded-sumi transition-transform duration-200 ease-out ${
						isOpen ? "rotate-90" : ""
					}`}
				/>
			</button>

			{isOpen && (
				<div
					ref={menuRef}
					role="menu"
					aria-label="Account options"
					aria-orientation="vertical"
					onKeyDown={onMenuKeyDown}
					className="absolute bottom-full left-0 right-0 mb-2 bg-warm-paper-raised rounded-xs border border-soft-hairline shadow-card p-1 flex flex-col animate-page-enter"
				>
					<MenuItem.Link
						href="/settings"
						density="spacious"
						leading={<IconSettings className="w-4 h-4" />}
						onClick={handleItemClick}
					>
						Settings
					</MenuItem.Link>
					<MenuItem
						density="spacious"
						leading={<IconHelp className="w-4 h-4" />}
						onClick={() => { handleItemClick(); openHelp(); }}
					>
						Help
					</MenuItem>
					<MenuItem.Link
						href="/report-bug"
						density="spacious"
						leading={<IconFlag className="w-4 h-4" />}
						onClick={handleItemClick}
					>
						Report a bug
					</MenuItem.Link>
					<MenuItem.Separator />
					<MenuItem
						density="spacious"
						danger
						leading={<IconSignOut className="w-4 h-4" />}
						onClick={handleSignOut}
					>
						Sign out
					</MenuItem>
				</div>
			)}
		</div>
	);
}
