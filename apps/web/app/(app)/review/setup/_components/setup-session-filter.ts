import type { ApiDeck, ApiDueCard } from "@fsrs-japanese/shared-types";
import type { SessionTuning } from "@/stores/useSessionTuningStore";
import { classifyCard, priorityForKind } from "@/lib/review/queue-classify";

/**
 * Applies the session tuning to the due-card pool, producing the exact ordered
 * list a session would start with. Pure — used both for the live "Start" action
 * and the setup preview, so the count the user sees is the queue they get.
 */
export function filterCardsForSession(
	items: ReadonlyArray<ApiDueCard>,
	tuning: SessionTuning,
	ctx: {
		todayKey: string;
		timeZone: string;
		decks: ReadonlyArray<ApiDeck>;
		shuffleSeed: number;
	},
): ApiDueCard[] {
	const allowedDeckIds = tuning.includedDeckIds === null
		? new Set<string>(ctx.decks.map(d => d.id))
		: new Set<string>(tuning.includedDeckIds);

	const FSRS_NEW = 0;
	let pool: ApiDueCard[] = items.filter(c => c.deckId !== null && allowedDeckIds.has(c.deckId));

	if (!tuning.includeNewCards) {
		pool = pool.filter(c => c.state !== FSRS_NEW);
	}

	if (tuning.overdueFirst) {
		pool = pool.filter(c => classifyCard(c, ctx.todayKey, ctx.timeZone) === "backlog");
	}

	if (tuning.reviewOrder === "shuffle") {
		pool = shuffle(pool, ctx.shuffleSeed);
	} else {
		pool = [...pool].sort((a, b) => {
			const ka = classifyCard(a, ctx.todayKey, ctx.timeZone);
			const kb = classifyCard(b, ctx.todayKey, ctx.timeZone);
			return priorityForKind(ka) - priorityForKind(kb);
		});
	}

	if (tuning.newCardOrder === "shuffle" && tuning.includeNewCards) {
		const news = pool.filter(c => c.state === FSRS_NEW);
		const nonNews = pool.filter(c => c.state !== FSRS_NEW);
		// Offset seed so the new-card shuffle doesn't echo the review shuffle.
		pool = [...nonNews, ...shuffle(news, ctx.shuffleSeed ^ 0x9E3779B1)];
	}

	if (tuning.sessionSize > 0) {
		pool = pool.slice(0, tuning.sessionSize);
	}

	if (tuning.timeboxMinutes !== null) {
		const budgetSecs = tuning.timeboxMinutes * 60;
		const result: ApiDueCard[] = [];
		let used = 0;
		for (const c of pool) {
			const cost = c.state === FSRS_NEW ? 25 : 15;
			if (used + cost > budgetSecs)
				break;
			result.push(c);
			used += cost;
		}
		pool = result;
	}

	return pool;
}

// Mulberry32: a tiny seeded PRNG. Deterministic for a given seed so the
// shuffle preview stays stable across unrelated tuning recomputes; the
// caller varies the seed only when a fresh randomization is intended.
function mulberry32(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6D2B79F5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function shuffle<T>(arr: ReadonlyArray<T>, seed: number): T[] {
	const result = [...arr];
	const rand = mulberry32(seed);
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1))
    ;[result[i], result[j]] = [result[j] as T, result[i] as T];
	}
	return result;
}
