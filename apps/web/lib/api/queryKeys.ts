export const queryKeys = {
	decks: {
		all: () => ["decks"] as const,
		list: () => [...queryKeys.decks.all(), "list"] as const,
		detail: (id: string) => [...queryKeys.decks.all(), "detail", id] as const,
	},
	cards: {
		all: () => ["cards"] as const,
		byDeck: (deckId: string) => [...queryKeys.cards.all(), "deck", deckId] as const,
		detail: (id: string) => [...queryKeys.cards.all(), "detail", id] as const,
		similar: (id: string) => [...queryKeys.cards.all(), "similar", id] as const,
		// Cross-deck browser. The filter object is part of the key so each
		// (deck, status, jlpt, search, missingField, sort) combination caches
		// independently — matches the weak-spots list pattern.
		crossDeck: (filters: object) => [...queryKeys.cards.all(), "crossDeck", filters] as const,
		qualityIssues: () => [...queryKeys.cards.all(), "qualityIssues"] as const,
	},
	reviews: {
		due: () => ["reviews", "due"] as const,
		forecast: () => ["reviews", "forecast"] as const,
		summary: (id: string) => ["reviews", "summary", id] as const,
		preview: (cardId: string) => ["reviews", "preview", cardId] as const,
		// Session-scoped post-session day reflection. The backend keys cache
		// by the day's session-IDs fingerprint, so a new same-day session
		// naturally bypasses the previous response. Using sessionId in the
		// client key is correct because the URL path is sessionId-scoped.
		dayReflection: (sessionId: string) =>
			["reviews", "day-reflection", sessionId] as const,
	},
	analytics: {
		dashboard: () => ["analytics", "dashboard"] as const,
	},
	insights: {
		// The Stage 9 maturity-history endpoint accepts `days` ∈ {90, 180, 365};
		// the window is part of the cache key so each window caches independently
		// (a learner who toggles between 90/365 day views doesn't refetch the
		// same row twice for the same window).
		maturityHistory: (days: "90" | "180" | "365") =>
			["insights", "maturity-history", days] as const,
		// Bundled rating/interval/stability/difficulty distributions for
		// the Statistics page. One round-trip, one cache entry.
		distributions: () => ["insights", "distributions"] as const,
	},
	weakSpots: {
		all: () => ["weakSpots"] as const,
		// The filter object is included in the cache key so each (status, deck,
		// jlpt, diagnosis, sort) combination is fetched and cached
		// independently. Matches the doc's "query keys must include every filter
		// dimension" requirement.
		list: (filters: object) => [...queryKeys.weakSpots.all(), "list", filters] as const,
		detail: (id: string) => [...queryKeys.weakSpots.all(), "detail", id] as const,
		// Drill session cache key family — scoped under weakSpots.all() so the
		// existing namespace-wide invalidation in resolve/reopen/diagnose
		// sweeps drill caches too. A drill session that targets a weakSpot that
		// has just been resolved should refetch on next mount, not serve a
		// stale snapshot.
		drillSession: (id: string) => [...queryKeys.weakSpots.all(), "drillSession", id] as const,
	},
	premadeDecks: {
		all: () => ["premade-decks"] as const,
		list: () => [...queryKeys.premadeDecks.all(), "list"] as const,
		detail: (id: string) => [...queryKeys.premadeDecks.all(), "detail", id] as const,
		// `subscriptions` key removed in Backend Completion Plan Stage 4 (copy
		// model) — the subscription concept no longer exists. "Decks I started
		// from a premade" is now a client-side filter on `queryKeys.decks.list()`
		// by `sourcePremadeId IS NOT NULL`.
	},
	profile: {
		me: () => ["profile", "me"] as const,
	},
	tomo: {
		// Day-scoped key. The backend serves one note per learner per day; the
		// dateKey segment prevents yesterday's cached note from masking today's
		// when a tab survives midnight.
		note: (dateKey: string) => ["tomo", "note", dateKey] as const,
	},
} as const;
