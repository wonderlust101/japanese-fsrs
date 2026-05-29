import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Server-action harness ─────────────────────────────────────────────────────
//
// The `lib/actions/*` modules are "use server" and import `server-only` plus the
// cookie-backed Supabase server client. Neither runs in jsdom, so we neutralize
// `server-only` and stub the server client with a fixed session. The real action
// + real `lib/api/client.ts` (apiCall / apiCallSafe) then execute against MSW,
// which gives us coverage of BOTH the action and the shared fetch helper.

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
	env: {
		NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
		NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
		NEXT_PUBLIC_API_URL: "http://localhost:3001",
		NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
	},
}));
vi.mock("@/lib/supabase/server", () => ({
	createSupabaseServerClient: async () => ({
		auth: {
			getSession: async () => ({
				data: { session: { access_token: "test-token" } },
				error: null,
			}),
		},
	}),
}));

const { http, HttpResponse } = await import("msw");
const { server } = await import("../../../test/msw/server");
const { makeCard, makeCrossDeckCardListItem } = await import("../../../test/factories/card");
const { makeReviewLog } = await import("../../../test/factories/review");
const actions = await import("../cards.actions");

const DECK = "deck-1";
const CARD = "card-1";
// makeReviewLog's default reviewLogId fails Zod's strict .uuid() (bad variant
// nibble); ApiReviewedCardSchema validates it, so supply a real v4 UUID.
const REVIEW_LOG_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
	server.resetHandlers();
});

afterEach(() => {
	vi.clearAllMocks();
});

describe("cards.actions — reads (apiCallSafe)", () => {
	it("listCardsAction returns the deck page (default handler)", async () => {
		const res = await actions.listCardsAction(DECK, { limit: 10, status: "review", cursor: "c1" });
		expect(res.items).toHaveLength(1);
		expect(res.items[0]).toMatchObject({ id: expect.any(String) });
	});

	it("listCardsAction passes through the 'all' status branch (no status param)", async () => {
		const res = await actions.listCardsAction(DECK, { status: "all" });
		expect(res.items).toHaveLength(1);
	});

	it("getCardByIdAction returns the card (flat mount)", async () => {
		const res = await actions.getCardByIdAction(CARD);
		expect(res?.id).toBe(CARD);
	});

	it("getCardAction returns the card (deck-scoped mount)", async () => {
		server.use(http.get("*/api/v1/decks/:deckId/cards/:cardId", () => HttpResponse.json(makeCard({ id: CARD }))));
		const res = await actions.getCardAction(DECK, CARD);
		expect(res?.id).toBe(CARD);
	});

	it("getCardByIdAction returns the null fallback on a 404", async () => {
		server.use(http.get("*/api/v1/cards/:id", () => HttpResponse.json({ error: "nope" }, { status: 404 })));
		expect(await actions.getCardByIdAction(CARD)).toBeNull();
	});
});

describe("cards.actions — cross-deck list (param building + safe fallback)", () => {
	it("builds every query param when all options are set", async () => {
		let seen: URL | null = null;
		server.use(http.get("*/api/v1/cards/cross-deck", ({ request }) => {
			seen = new URL(request.url);
			return HttpResponse.json({ items: [makeCrossDeckCardListItem()], hasMore: false, totalCount: 1 });
		}));

		const res = await actions.listCardsCrossDeckAction({
			limit: 50,
			offset: 20,
			search: "ねこ",
			deckId: DECK,
			jlptLevel: "N3",
			status: "review",
			missingField: "reading",
			presentField: "picture",
			pitchPattern: "heiban",
			sort: "recent",
			sortDir: "asc",
		});

		expect(res.totalCount).toBe(1);
		const p = seen!.searchParams;
		expect(p.get("offset")).toBe("20");
		expect(p.get("search")).toBe("ねこ");
		expect(p.get("jlptLevel")).toBe("N3");
		expect(p.get("sortDir")).toBe("asc");
	});

	it("omits the optional params on the default/'all' branches", async () => {
		let seen: URL | null = null;
		server.use(http.get("*/api/v1/cards/cross-deck", ({ request }) => {
			seen = new URL(request.url);
			return HttpResponse.json({ items: [], hasMore: false, totalCount: 0 });
		}));

		await actions.listCardsCrossDeckAction({ offset: 0, search: "", jlptLevel: "all", status: "all" });

		const p = seen!.searchParams;
		expect(p.has("offset")).toBe(false); // offset 0 is omitted
		expect(p.has("search")).toBe(false); // empty search omitted
		expect(p.has("jlptLevel")).toBe(false); // "all" omitted
		expect(p.has("status")).toBe(false);
	});

	it("returns the empty page fallback when the API errors", async () => {
		server.use(http.get("*/api/v1/cards/cross-deck", () => HttpResponse.json({ error: "boom" }, { status: 500 })));
		const res = await actions.listCardsCrossDeckAction();
		expect(res).toEqual({ items: [], hasMore: false, totalCount: 0 });
	});
});

describe("cards.actions — mutations (apiCall)", () => {
	it("saveCardAction POSTs with an Idempotency-Key and returns the new card", async () => {
		let hadKey = false;
		server.use(http.post("*/api/v1/decks/:deckId/cards", ({ request }) => {
			hadKey = request.headers.has("Idempotency-Key");
			return HttpResponse.json(makeCard({ id: "card-new" }), { status: 201 });
		}));
		const res = await actions.saveCardAction(DECK, { fieldsData: { word: "本", reading: "ほん", meaning: "book" }, layoutType: "vocabulary" } as never);
		expect(res.id).toBe("card-new");
		expect(hadKey).toBe(true);
	});

	it("updateCardAction sends If-Match with the version", async () => {
		let ifMatch: string | null = null;
		server.use(http.patch("*/api/v1/cards/:id", ({ request }) => {
			ifMatch = request.headers.get("If-Match");
			return HttpResponse.json(makeCard({ id: CARD, version: 3 }));
		}));
		const res = await actions.updateCardAction(CARD, 2, { fieldsData: { word: "x", reading: "x", meaning: "x" } } as never);
		expect(res.version).toBe(3);
		expect(ifMatch).toBe("2");
	});

	it("deleteCardAction resolves on 204", async () => {
		await expect(actions.deleteCardAction(CARD)).resolves.toBeUndefined();
	});

	it("deleteCardAction throws ApiHttpError on a non-2xx status", async () => {
		server.use(http.delete("*/api/v1/cards/:id", () => HttpResponse.json({ error: "Card not found" }, { status: 404 })));
		await expect(actions.deleteCardAction(CARD)).rejects.toThrow(/Card not found/);
	});

	it.each([
		["moveCardAction", () => actions.moveCardAction(CARD, "deck-2"), "move"],
		["copyCardAction", () => actions.copyCardAction(CARD, "deck-2"), "copy"],
		["suspendCardAction", () => actions.suspendCardAction(CARD), "suspend"],
		["unsuspendCardAction", () => actions.unsuspendCardAction(CARD), "unsuspend"],
	] as const)("%s POSTs and returns the card", async (_name, run, segment) => {
		server.use(http.post(`*/api/v1/cards/:id/${segment}`, () => HttpResponse.json(makeCard({ id: CARD }))));
		const res = await run();
		expect(res.id).toBe(CARD);
	});

	it("forgetCardAction includes resetCount only when requested", async () => {
		let body: unknown = null;
		server.use(http.post("*/api/v1/cards/:id/forget", async ({ request }) => {
			body = await request.json();
			return HttpResponse.json(makeReviewLog({ id: CARD, reviewLogId: REVIEW_LOG_ID }));
		}));
		await actions.forgetCardAction(CARD, { resetCount: true });
		expect(body).toEqual({ resetCount: true });

		await actions.forgetCardAction(CARD); // default — empty body
		expect(body).toEqual({});
	});

	it("rescheduleCardAction returns the reviewed card", async () => {
		server.use(http.post("*/api/v1/cards/:id/reschedule", () => HttpResponse.json(makeReviewLog({ id: CARD, reviewLogId: REVIEW_LOG_ID }))));
		const res = await actions.rescheduleCardAction(CARD);
		expect(res.id).toBe(CARD);
	});
});
