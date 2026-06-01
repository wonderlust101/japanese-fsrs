import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "bun:test";
import request from "supertest";

import { describeIntegration, isIntegrationEnabled, restDelete, restSeed, signInUser } from "./_helpers";

let app: import("express").Express;
let supabaseAdmin: import("@supabase/supabase-js").SupabaseClient;

interface SeededUser { userId: string; jwt: string }

const seeded: SeededUser[] = [];
// Premade deck IDs created by the test for isolation. Cleaned up in afterAll;
// cascades remove any forked `decks` rows (and their cards) under the also-
// deleted test users, so we don't need to delete those explicitly.
const seededPremadeDeckIds: string[] = [];

async function seedUser(): Promise<SeededUser> {
	const email = `it-premade-${Date.now()}-${Math.random().toString(16).slice(2, 6)}@example.test`;
	const created = await supabaseAdmin.auth.admin.createUser({
		email,
		password: "integration-pass",
		email_confirm: true,
	});
	if (created.error !== null || created.data.user === null)
		throw new Error(`createUser failed: ${created.error?.message}`);
	const userId = created.data.user.id;

	// Mint the JWT on a dedicated auth client so supabaseAdmin stays service_role
	// (see signInUser). Signing in on the shared client leaks the user session.
	const jwt = await signInUser(email);

	return { userId, jwt };
}

interface PremadeOptions {
	isActive?: boolean;
	cardCount?: number;
}

/**
 * Creates a test-scoped premade deck (catalogue entry) plus the requested
 * number of source cards (user_id IS NULL). Source cards live in the
 * catalogue; copy_premade_deck clones them into a user-owned deck.
 *
 * Scoped per-test so version mutations / inactive flags don't pollute the
 * shared seed catalogue.
 */
async function seedPremadeDeck(opts: PremadeOptions = {}): Promise<string> {
	const id = randomUUID();
	await restSeed("premade_decks", {
		id,
		name: `Stage 4 Copy Test Deck ${Date.now()}`,
		description: "integration-test only — deleted in afterAll",
		deck_type: "vocabulary",
		jlpt_level: "N5",
		domain: null,
		is_active: opts.isActive ?? true,
	});
	seededPremadeDeckIds.push(id);

	// Seed N source cards. The copy RPC clones rows WHERE premade_deck_id =
	// <deck> AND user_id IS NULL — these are the rows that condition matches.
	const cards = Array.from({ length: opts.cardCount ?? 2 }, (_, i) => ({
		id: randomUUID(),
		user_id: null,
		deck_id: null,
		premade_deck_id: id,
		layout_type: "vocabulary" as const,
		fields_data: { word: `源-${i}`, reading: `げん${i}`, meaning: `source ${i}` },

		jlpt_level: "N5" as const,
	}));
	if (cards.length > 0) {
		await restSeed("cards", cards);
	}
	return id;
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
	for (const u of seeded) {
		await supabaseAdmin.auth.admin.deleteUser(u.userId).catch(() => undefined);
	}
	// Delete the test-scoped premade decks. cascade=SET NULL on cards →
	// premade_decks (cards stay around with premade_deck_id = NULL), so we
	// explicitly delete the source cards first.
	for (const id of seededPremadeDeckIds) {
		await restDelete("cards", `premade_deck_id=eq.${id}&user_id=is.null`);
		await restDelete("premade_decks", `id=eq.${id}`);
	}
});

// Backend Completion Plan Stage 4 (copy model). The route renamed from
// /:id/subscribe to /:id/copy. Subscriptions and version surfacing are gone.
// Tests pin the four acceptance criteria from the plan:
//   (a) fresh copy
//   (b) duplicate copy → two independent decks
//   (c) copy → delete → copy again → third independent deck
//   (d) copy of an inactive deck → 404
describeIntegration("premade copy route — Stage 4 acceptance", () => {
	it("POST /premade-decks/:id/copy creates a new owned deck with fresh FSRS state", async () => {
		const u = await seedUser(); seeded.push(u);
		const premadeId = await seedPremadeDeck({ cardCount: 2 });

		const copyRes = await request(app)
			.post(`/api/v1/premade-decks/${premadeId}/copy`)
			.set("Authorization", `Bearer ${u.jwt}`)
			.set("Idempotency-Key", randomUUID());
		expect(copyRes.status).toBe(201);
		expect(copyRes.headers.location).toBe(`/api/v1/decks/${copyRes.body.deckId}`);
		expect(typeof copyRes.body.deckId).toBe("string");
		expect(copyRes.body.cardCount).toBe(2);

		// The new deck is fetchable via /api/v1/decks/:id with the same wire
		// shape every user-created deck has. After Stage 4 there is no special
		// path through deleteDeck; every deck is identical.
		const deckRes = await request(app)
			.get(`/api/v1/decks/${copyRes.body.deckId}`)
			.set("Authorization", `Bearer ${u.jwt}`);
		expect(deckRes.status).toBe(200);
		expect(deckRes.body.sourcePremadeId).toBe(premadeId);
		expect(deckRes.body.newCount).toBe(2);
		expect(deckRes.body.lastReviewedAt).toBeNull();
	});

	it("two consecutive copies of the same premade deck produce two independent decks", async () => {
		const u = await seedUser(); seeded.push(u);
		const premadeId = await seedPremadeDeck({ cardCount: 1 });

		const first = await request(app)
			.post(`/api/v1/premade-decks/${premadeId}/copy`)
			.set("Authorization", `Bearer ${u.jwt}`)
			.set("Idempotency-Key", randomUUID());
		expect(first.status).toBe(201);

		const second = await request(app)
			.post(`/api/v1/premade-decks/${premadeId}/copy`)
			.set("Authorization", `Bearer ${u.jwt}`)
		// Distinct idempotency key — the copy model deliberately allows
		// duplicate copies. Same key would replay the original 201.
			.set("Idempotency-Key", randomUUID());
		expect(second.status).toBe(201);

		expect(first.body.deckId).not.toBe(second.body.deckId);
	});

	it("copy → delete → copy again produces a third independent deck (no subscription junction in the way)", async () => {
		const u = await seedUser(); seeded.push(u);
		const premadeId = await seedPremadeDeck({ cardCount: 1 });

		const first = await request(app)
			.post(`/api/v1/premade-decks/${premadeId}/copy`)
			.set("Authorization", `Bearer ${u.jwt}`)
			.set("Idempotency-Key", randomUUID());
		expect(first.status).toBe(201);

		// Deleting the copied deck uses the SAME path as deleting any other
		// user-owned deck. No `is_premade_fork` branch, no unsubscribe RPC.
		const del = await request(app)
			.delete(`/api/v1/decks/${first.body.deckId}`)
			.set("Authorization", `Bearer ${u.jwt}`);
		expect(del.status).toBe(204);

		const third = await request(app)
			.post(`/api/v1/premade-decks/${premadeId}/copy`)
			.set("Authorization", `Bearer ${u.jwt}`)
			.set("Idempotency-Key", randomUUID());
		expect(third.status).toBe(201);
		expect(third.body.deckId).not.toBe(first.body.deckId);
	});

	it("copy of an inactive premade deck returns 404 with PREMADE_DECK_NOT_FOUND", async () => {
		const u = await seedUser(); seeded.push(u);
		const premadeId = await seedPremadeDeck({ isActive: false, cardCount: 1 });

		const res = await request(app)
			.post(`/api/v1/premade-decks/${premadeId}/copy`)
			.set("Authorization", `Bearer ${u.jwt}`)
			.set("Idempotency-Key", randomUUID());
		expect(res.status).toBe(404);
		expect(res.body.code).toBe("PREMADE_DECK_NOT_FOUND");
	});
});

// Read-only catalogue preview. GET /premade-decks/:id/cards lists a premade
// deck's *source* cards (user_id IS NULL, premade_deck_id = :id) so a learner
// can browse before copying. The cross-deck browser can't reach these rows —
// it joins the caller's own decks — so this is a distinct read path.
describeIntegration("premade preview route — GET /premade-decks/:id/cards", () => {
	it("lists source cards with the read-only cross-deck shape", async () => {
		const u = await seedUser(); seeded.push(u);
		const premadeId = await seedPremadeDeck({ cardCount: 3 });

		const res = await request(app)
			.get(`/api/v1/premade-decks/${premadeId}/cards`)
			.set("Authorization", `Bearer ${u.jwt}`);

		expect(res.status).toBe(200);
		expect(res.body.totalCount).toBe(3);
		expect(res.body.hasMore).toBe(false);
		expect(res.body.items).toHaveLength(3);

		const item = res.body.items[0];
		// deckId/deckName carry the premade deck's identity (source cards have no
		// owning `decks` row), and the personal-state fields are never surfaced.
		expect(item.deckId).toBe(premadeId);
		expect(typeof item.deckName).toBe("string");
		expect(item.fieldsData).toBeDefined();
		expect(item.version).toBeUndefined();
		expect(item.userId).toBeUndefined();
	});

	it("paginates with limit/offset and reports hasMore + totalCount", async () => {
		const u = await seedUser(); seeded.push(u);
		const premadeId = await seedPremadeDeck({ cardCount: 3 });

		const first = await request(app)
			.get(`/api/v1/premade-decks/${premadeId}/cards?limit=2`)
			.set("Authorization", `Bearer ${u.jwt}`);
		expect(first.status).toBe(200);
		expect(first.body.items).toHaveLength(2);
		expect(first.body.hasMore).toBe(true);
		expect(first.body.totalCount).toBe(3);

		const second = await request(app)
			.get(`/api/v1/premade-decks/${premadeId}/cards?limit=2&offset=2`)
			.set("Authorization", `Bearer ${u.jwt}`);
		expect(second.status).toBe(200);
		expect(second.body.items).toHaveLength(1);
		expect(second.body.hasMore).toBe(false);
	});

	it("filters by a case-insensitive substring across word/reading/meaning", async () => {
		const u = await seedUser(); seeded.push(u);
		// Seeded cards carry meaning "source 0/1/2" and reading "げん0/1/2".
		const premadeId = await seedPremadeDeck({ cardCount: 3 });

		const byMeaning = await request(app)
			.get(`/api/v1/premade-decks/${premadeId}/cards?search=source%202`)
			.set("Authorization", `Bearer ${u.jwt}`);
		expect(byMeaning.status).toBe(200);
		expect(byMeaning.body.totalCount).toBe(1);
		expect(byMeaning.body.items[0].fieldsData.meaning).toBe("source 2");

		const byReading = await request(app)
			.get(`/api/v1/premade-decks/${premadeId}/cards?search=${encodeURIComponent("げん1")}`)
			.set("Authorization", `Bearer ${u.jwt}`);
		expect(byReading.status).toBe(200);
		expect(byReading.body.totalCount).toBe(1);
	});

	it("accepts the recent/due/lapses sort axes (aligned with the cross-deck browser)", async () => {
		const u = await seedUser(); seeded.push(u);
		const premadeId = await seedPremadeDeck({ cardCount: 3 });

		// Source cards are pristine (state 0, due now, 0 lapses) so sort *order*
		// isn't deterministic here; we assert the axes are accepted and return the
		// full set rather than pinning an order the data can't distinguish.
		for (const sort of ["recent", "due", "lapses"]) {
			const res = await request(app)
				.get(`/api/v1/premade-decks/${premadeId}/cards?sort=${sort}&sortDir=desc`)
				.set("Authorization", `Bearer ${u.jwt}`);
			expect(res.status).toBe(200);
			expect(res.body.totalCount).toBe(3);
		}
	});

	it("filters by FSRS status — all source cards are New", async () => {
		const u = await seedUser(); seeded.push(u);
		const premadeId = await seedPremadeDeck({ cardCount: 3 });

		const asNew = await request(app)
			.get(`/api/v1/premade-decks/${premadeId}/cards?status=new`)
			.set("Authorization", `Bearer ${u.jwt}`);
		expect(asNew.status).toBe(200);
		expect(asNew.body.totalCount).toBe(3);

		// No reviewed cards exist on a premade source deck, so review/suspended
		// narrow to zero — the filter is wired even though it's a near-no-op here.
		const asReview = await request(app)
			.get(`/api/v1/premade-decks/${premadeId}/cards?status=review`)
			.set("Authorization", `Bearer ${u.jwt}`);
		expect(asReview.status).toBe(200);
		expect(asReview.body.totalCount).toBe(0);
	});

	it("rejects an unknown sort field (strict schema)", async () => {
		const u = await seedUser(); seeded.push(u);
		const premadeId = await seedPremadeDeck({ cardCount: 1 });

		const res = await request(app)
			.get(`/api/v1/premade-decks/${premadeId}/cards?sort=word`)
			.set("Authorization", `Bearer ${u.jwt}`);
		// `word` is not a valid sort axis (the preview uses recent/due/lapses).
		expect(res.status).toBe(400);
	});

	it("returns 404 for an inactive premade deck", async () => {
		const u = await seedUser(); seeded.push(u);
		const premadeId = await seedPremadeDeck({ isActive: false, cardCount: 2 });

		const res = await request(app)
			.get(`/api/v1/premade-decks/${premadeId}/cards`)
			.set("Authorization", `Bearer ${u.jwt}`);
		expect(res.status).toBe(404);
		expect(res.body.code).toBe("PREMADE_DECK_NOT_FOUND");
	});
});
