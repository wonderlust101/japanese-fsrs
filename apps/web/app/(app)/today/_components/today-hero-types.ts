// Public contract for the Today dashboard hero: variant/queue/deck shapes,
// the CTA descriptor + resolver, and the weak-spot probe size. Re-exported
// from ./today-hero so existing import sites keep resolving.

import type { JlptPillLevel } from "@/components/ui/Pill";

// Weak-spots probe size: 2 visible word peeks + 1 overflow detector.
// Exported so today-client can mirror the same query args; TanStack
// Query then dedups the request and the pre-review-note data is ready
// by the time HeroPreSessionNote mounts (no placeholder flash).
export const WEAK_SPOT_PEEK_LIMIT = 2;
export const WEAK_SPOT_QUERY_LIMIT = WEAK_SPOT_PEEK_LIMIT + 1;

// ── Types ────────────────────────────────────────────────────────────────────

export type HeroKind = "due" | "caught-up" | "first-time" | "resume";

export interface ResumeContextSnapshot {
	remaining: number;
}

export type HeroDeckTag
	= | { kind: "level"; level: JlptPillLevel }
		| { kind: "none" };

export interface HeroDeckPreview {
	id: string;
	title: string;
	subtitle: string;
	dueCount: number;
	newCount?: number;
	reviewCount?: number;
	tag: HeroDeckTag;
}

export interface DueQueue {
	total: number;
	newCnt: number;
	review: number;
	backlog: number;
	statusNote?: string | undefined;
	decks: HeroDeckPreview[];
	overflowDecks: number;
}

export type DashboardHeroVariant
	= | { kind: "due"; queue: DueQueue }
		| { kind: "caught-up" }
		| { kind: "first-time" }
		| { kind: "resume"; context: ResumeContextSnapshot };

/**
 * CTA descriptor for each hero variant. Used by the route-level
 * MobileStickyActionBar so the phone/tablet sticky bar always carries the
 * SAME primary action the desktop hero would show. Keep in sync with the
 * inline <HeroPrimaryAction> calls inside each variant component below.
 */
export interface HeroCta {
	href: string;
	label: string;
	tone: "primary" | "secondary";
}

export function getHeroCta(variant: DashboardHeroVariant): HeroCta {
	switch (variant.kind) {
		case "due": return { href: "/review/session", label: "Start reviews", tone: "primary" };
		case "caught-up": return { href: "/add", label: "Add Japanese", tone: "secondary" };
		case "first-time": return { href: "/decks", label: "Browse decks", tone: "primary" };
		case "resume": return { href: "/review/session", label: "Resume review", tone: "primary" };
	}
}
