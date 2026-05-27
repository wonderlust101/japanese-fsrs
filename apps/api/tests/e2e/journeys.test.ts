import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "bun:test";
import request from "supertest";

import { describeIntegration, isIntegrationEnabled, restDelete, restSeed, restSelect, signInUser } from "../integration/_helpers";

// ─── API end-to-end journeys (Phase 3) ───────────────────────────────────────
//
// Multi-endpoint user flows against the real stack (Supabase + Upstash shim),
// gated like the integration tier. Where integration tests pin ONE endpoint's
// contract, these assert the HANDOFF between endpoints — state written by one
// call and read/reverted by another.
//
// Tokens are minted through the public POST /auth/login (not
// supabaseAdmin.signInWithPassword) and every journey uses a SINGLE user, so
// the shared-client session that login sets is always that user's own identity
// (harmless) and the sign-in is breaker-wrapped (no volume burst — see the
// parked signInUser note in integration/_helpers.ts).

let app: import("express").Express;
let supabaseAdmin: import("@supabase/supabase-js").SupabaseClient;

const createdUserIds: string[] = [];

interface JourneyUser { userId: string; token: string; deckId: string }

/** Create a confirmed user, log in via the API for a real JWT, and open a deck. */
async function setupUser(): Promise<JourneyUser> {
	const email = `e2e-${Date.now()}-${Math.random().toString(16).slice(2, 6)}@example.test`;
	const password = "e2e-pass-1234";

	const created = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
	if (created.error !== null || created.data.user === null) {
		throw new Error(`createUser failed: ${created.error?.message ?? "no user"}`);
	}
	const userId = created.data.user.id;
	createdUserIds.push(userId);

	// Mint the JWT on a dedicated auth client (NOT POST /auth/login). The app's
	// login signs in on the shared supabaseAdmin, leaking a user session that
	// would make the app's internal service_role queries (e.g. the rollback
	// affordance's review-log lookup) run as the user and hit RLS. A dedicated
	// client keeps supabaseAdmin as service_role; at 3 journeys the sign-in
	// volume is far below what destabilizes the full integration suite.
	const token = await signInUser(email, password);

	const deckRes = await request(app)
		.post("/api/v1/decks")
		.set("Authorization", `Bearer ${token}`)
		.set("Idempotency-Key", randomUUID())
		.send({ name: "E2E Journey Deck", deckType: "vocabulary" });
	if (deckRes.status !== 201)
		throw new Error(`createDeck failed: ${deckRes.status} ${JSON.stringify(deckRes.body)}`);

	return { userId, token, deckId: deckRes.body.id };
}

/** Create a manual vocabulary card in the journey user's deck; returns it. */
async function addCard(u: JourneyUser, fieldsData: Record<string, unknown>): Promise<{ id: string; state: number; version: number }> {
	const res = await request(app)
		.post(`/api/v1/decks/${u.deckId}/cards`)
		.set("Authorization", `Bearer ${u.token}`)
		.set("Idempotency-Key", randomUUID())
		.send({ mode: "manual", fieldsData, layoutType: "vocabulary" });
	if (res.status !== 201)
		throw new Error(`addCard failed: ${res.status} ${JSON.stringify(res.body)}`);
	return res.body;
}

beforeAll(async () => {
	if (!isIntegrationEnabled()) {
		return
		;
	}({ app } = await import("../../src/app"))
	;({ supabaseAdmin } = await import("../../src/db/supabase"));
});

afterAll(async () => {
	if (!isIntegrationEnabled())
		return;
	for (const id of createdUserIds) {
		await supabaseAdmin.auth.admin.deleteUser(id).catch(() => undefined);
	}
});

// ─── Journey 1: review advances FSRS state; rollback restores it ──────────────

describeIntegration("E2E — review → rollback lifecycle", () => {
	it("adds a card, sees it due, reviews it off New, then rolls the review back to New", async () => {
		const u = await setupUser();

		const card = await addCard(u, { word: "本", reading: "ほん", meaning: "book" });
		expect(card.state).toBe(0); // New

		// The new card surfaces in the due queue.
		const dueRes = await request(app).get("/api/v1/reviews/due").set("Authorization", `Bearer ${u.token}`);
		expect(dueRes.status).toBe(200);
		const dueIds = (dueRes.body.items as Array<{ id: string }>).map(c => c.id);
		expect(dueIds).toContain(card.id);

		// A "good" review moves it off New with positive stability.
		const submit = await request(app)
			.post("/api/v1/reviews/submit")
			.set("Authorization", `Bearer ${u.token}`)
			.set("Idempotency-Key", randomUUID())
			.send({ cardId: card.id, rating: "good" });
		expect(submit.status).toBe(200);
		expect(submit.body.id).toBe(card.id);
		expect(submit.body.state).toBeGreaterThan(0);
		expect(submit.body.stability).toBeGreaterThan(0);

		// process_review RETURNS the inserted log id (migration 20260706000000),
		// so the submit response carries `reviewLogId` directly — this is what
		// powers the summary page's per-card rollback affordance. (Previously this
		// came back null; the journey had to re-find the id with a DB SELECT.)
		expect(typeof submit.body.reviewLogId).toBe("string");
		const reviewLogId: string = submit.body.reviewLogId;

		// Rollback restores the card to its pre-review (New) state — the handoff
		// that proves the review log written by submit is found + reversed.
		const rollback = await request(app)
			.post(`/api/v1/reviews/${reviewLogId}/rollback`)
			.set("Authorization", `Bearer ${u.token}`)
			.set("Idempotency-Key", randomUUID()); // rollback is a retryable mutating POST
		expect(rollback.status).toBe(200);
		expect(rollback.body.id).toBe(card.id);
		expect(rollback.body.state).toBe(0);

		// And a fresh GET confirms the persisted state really reverted.
		const after = await request(app)
			.get(`/api/v1/decks/${u.deckId}/cards/${card.id}`)
			.set("Authorization", `Bearer ${u.token}`);
		expect(after.status).toBe(200);
		expect(after.body.state).toBe(0);
	});
});

// ─── Journey 2: premade copy creates personal cards; never mutates the source ─

describeIntegration("E2E — premade copy isolation", () => {
	it("copies a premade deck into fresh personal cards and leaves the source untouched", async () => {
		const u = await setupUser();

		// Seed a premade catalogue deck + 2 source cards (system rows, user_id NULL)
		// via raw PostgREST as service_role.
		const premadeId = randomUUID();
		await restSeed("premade_decks", {
			id: premadeId,
			name: `E2E Premade ${Date.now()}`,
			description: null,
			deck_type: "vocabulary",
			jlpt_level: "N5",
			domain: null,
			is_active: true,
		});
		const sourceIds = [randomUUID(), randomUUID()];
		await restSeed("cards", sourceIds.map((id, i) => ({
			id,
			user_id: null,
			deck_id: null,
			premade_deck_id: premadeId,
			layout_type: "vocabulary",
			fields_data: { word: `源${i}`, reading: `げん${i}`, meaning: `source ${i}` },
			jlpt_level: "N5",
		})));

		try {
			const copy = await request(app)
				.post(`/api/v1/premade-decks/${premadeId}/copy`)
				.set("Authorization", `Bearer ${u.token}`)
				.set("Idempotency-Key", randomUUID());
			expect(copy.status).toBe(201);
			expect(copy.body.cardCount).toBe(2);
			const newDeckId = copy.body.deckId;

			// The copied cards are personal + start fresh (state New).
			const list = await request(app)
				.get(`/api/v1/decks/${newDeckId}/cards`)
				.set("Authorization", `Bearer ${u.token}`);
			expect(list.status).toBe(200);
			expect(list.body.items).toHaveLength(2);
			expect((list.body.items as Array<{ state: number }>).every(c => c.state === 0)).toBe(true);

			// The SOURCE premade cards are byte-for-byte untouched: still user_id NULL,
			// deck_id NULL, same ids. The copy must clone, never mutate the shared source.
			const sources = await restSelect<{ id: string; user_id: string | null; deck_id: string | null }>(
				"cards",
				`premade_deck_id=eq.${premadeId}&user_id=is.null&select=id,user_id,deck_id`,
			);
			expect(sources).toHaveLength(2);
			expect(sources.map(c => c.id).sort()).toEqual([...sourceIds].sort());
			expect(sources.every(c => c.user_id === null && c.deck_id === null)).toBe(true);
		} finally {
			await restDelete("cards", `premade_deck_id=eq.${premadeId}&user_id=is.null`);
			await restDelete("premade_decks", `id=eq.${premadeId}`);
		}
	});
});

// ─── Journey 3: idempotent offline replay does not double-advance ─────────────

describeIntegration("E2E — idempotent review replay", () => {
	it("replays the same Idempotency-Key without advancing FSRS twice, and 422s on a changed body", async () => {
		const u = await setupUser();
		const card = await addCard(u, { word: "光", reading: "ひかり", meaning: "light" });
		const key = randomUUID();

		const first = await request(app)
			.post("/api/v1/reviews/submit")
			.set("Authorization", `Bearer ${u.token}`)
			.set("Idempotency-Key", key)
			.send({ cardId: card.id, rating: "good" });
		expect(first.status).toBe(200);

		// Same key + same body → byte-identical replay (no re-execution).
		const replay = await request(app)
			.post("/api/v1/reviews/submit")
			.set("Authorization", `Bearer ${u.token}`)
			.set("Idempotency-Key", key)
			.send({ cardId: card.id, rating: "good" });
		expect(replay.status).toBe(200);
		expect(replay.body).toEqual(first.body);

		// Same key + different body → 422 conflict.
		const conflict = await request(app)
			.post("/api/v1/reviews/submit")
			.set("Authorization", `Bearer ${u.token}`)
			.set("Idempotency-Key", key)
			.send({ cardId: card.id, rating: "easy" });
		expect(conflict.status).toBe(422);

		// The card advanced exactly ONCE — an independent GET matches the first
		// review's state, proving the replay didn't double-apply.
		const after = await request(app)
			.get(`/api/v1/decks/${u.deckId}/cards/${card.id}`)
			.set("Authorization", `Bearer ${u.token}`);
		expect(after.status).toBe(200);
		expect(after.body.state).toBe(first.body.state);
	});
});
