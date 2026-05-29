/**
 * Seeds a deterministic fixture user for Playwright end-to-end runs.
 *
 * The flow is:
 *   1. Idempotently delete any existing fixture user (by email) so re-runs are
 *      safe between Playwright suites that mutate FSRS state.
 *   2. Create the fixture user via the Supabase admin API with email_confirm
 *      pre-set so the OTP flow can be skipped in CI.
 *   3. Copy one premade deck into the new user's library via the same service
 *      function the HTTP route uses (copyPremadeDeck), so the seed exercises
 *      the real card-cloning path.
 *   4. Force `cards.due` to 24h in the past on at least 3 personal copies so
 *      the review-session E2E always has rows to drain through the queue.
 *
 * Why the FSRS-state write drops to supabaseAdmin instead of going through the
 * service layer:
 *   - `card.service.ts` does not expose a public "force due back" function;
 *     all due-date mutation lives inside `fsrs.service.processReview`, which
 *     simulates a real review. Simulating a rating chain to drive 3 cards into
 *     a due state would be slower, less deterministic, and would also write
 *     review logs that pollute downstream insights fixtures.
 *   - This script is a one-off seed harness invoked only from CI and local
 *     manual runs — it is *not* on the request hot path, so the "all FSRS
 *     state changes go through fsrs.service.ts" rule in CLAUDE.md (which is
 *     about runtime safety against concurrent reviewers) does not apply here.
 *     The integration test tier follows the same admin-write pattern for the
 *     same reason.
 *
 * Required env (loaded by Bun's auto-`.env` from apps/api/.env):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   bun --filter @fsrs-japanese/api run seed:e2e
 *
 * Exits 0 on success (prints the fixture credentials as the last line for the
 * Playwright auth-setup step to read), exits 1 with a JSON `{error}` line on
 * any failure.
 */
import { supabaseAdmin } from "../src/db/supabase.ts";
import { copyPremadeDeck } from "../src/services/premade.service.ts";

const FIXTURE_EMAIL = "e2e-fixture@tomo.test";
const FIXTURE_PASSWORD = "e2e-fixture-password-1";

// How many cards we must guarantee are due. Anchored to the review-session
// E2E expectation (≥3 ratings before the rating bar disappears).
const MIN_DUE_CARDS = 3;

// Push the due timestamps a day into the past — comfortably before any local
// timezone's "today" cutoff so the cards classify as overdue, never as new.
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function deleteExistingFixtureUser(): Promise<void> {
	// Paginate listUsers() until we find the email match. The admin SDK's
	// listUsers() doesn't take a `filter` arg, so we scan; 200 per page is the
	// SDK default. Cap at 50 pages (10k users) so a misconfigured staging env
	// can't loop forever. A scan that completes without finding the fixture
	// email is the normal "first run / already cleaned up" case — return
	// silently rather than treating that as an error.
	const PAGE_SIZE = 200;
	const MAX_PAGES = 50;
	for (let page = 1; page <= MAX_PAGES; page += 1) {
		const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
		if (error !== null) {
			throw new Error(`listUsers failed on page ${page}: ${error.message}`);
		}
		const match = data.users.find(u => u.email?.toLowerCase() === FIXTURE_EMAIL);
		if (match !== undefined) {
			const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(match.id);
			if (delErr !== null) {
				throw new Error(`deleteUser failed for ${match.id}: ${delErr.message}`);
			}
			return;
		}
		// End of the list — no match means there is no fixture user to delete.
		if (data.users.length < PAGE_SIZE)
			return;
	}
	// Reaching MAX_PAGES means we have more than 10k users on this instance
	// AND the fixture is buried past that boundary; treat it as a hard error
	// because it implies a misconfigured target environment.
	throw new Error(`exhausted ${MAX_PAGES} pages of listUsers (>${MAX_PAGES * PAGE_SIZE} users)`);
}

async function createFixtureUser(): Promise<string> {
	const { data, error } = await supabaseAdmin.auth.admin.createUser({
		email: FIXTURE_EMAIL,
		password: FIXTURE_PASSWORD,
		// Confirm in-band so the user can sign in immediately without the OTP
		// round-trip. The on_auth_user_created trigger backfills profiles in
		// the same INSERT transaction (see auth.service.ts).
		email_confirm: true,
		user_metadata: { display_name: "Tomo E2E" },
	});
	if (error !== null || data.user === null) {
		throw new Error(`createUser failed: ${error?.message ?? "no user returned"}`);
	}
	return data.user.id;
}

async function pickFirstActivePremadeDeck(): Promise<string> {
	// `copyPremadeDeck` requires an existing active source. The catalog ID
	// list is deterministic (see scripts/generate-premade-seed.ts), but we
	// don't hard-code a UUID here — the script stays self-healing if the
	// seed migration changes IDs.
	const { data, error } = await supabaseAdmin
		.from("premade_decks")
		.select("id")
		.eq("is_active", true)
		.order("name", { ascending: true })
		.limit(1)
		.maybeSingle();
	if (error !== null || data === null) {
		throw new Error(`no active premade deck found: ${error?.message ?? "empty result"}`);
	}
	return data.id;
}

async function forceCardsDue(userId: string, userDeckId: string): Promise<number> {
	// Pick the first MIN_DUE_CARDS personal-copy rows in the freshly-copied
	// deck and rewind their `due` by 1 day. After copyPremadeDeck() the rows
	// carry user_id = <new user> and premade_deck_id = NULL; we filter on
	// both deck_id and user_id so we can never accidentally pick up the
	// shared source rows (user_id IS NULL) — those are the catalogue copies
	// and must never be mutated (CLAUDE.md "Premade deck cards have
	// user_id = NULL.").
	const { data: cards, error: listErr } = await supabaseAdmin
		.from("cards")
		.select("id")
		.eq("deck_id", userDeckId)
		.eq("user_id", userId)
		.eq("is_suspended", false)
		.order("created_at", { ascending: true })
		.limit(MIN_DUE_CARDS);
	if (listErr !== null) {
		throw new Error(`list copied cards failed: ${listErr.message}`);
	}
	if (cards === null || cards.length < MIN_DUE_CARDS) {
		throw new Error(
			`expected at least ${MIN_DUE_CARDS} personal cards in deck ${userDeckId}, got ${cards?.length ?? 0}`,
		);
	}

	const past = new Date(Date.now() - ONE_DAY_MS).toISOString();
	const ids = cards.map(row => row.id);
	const { error: updateErr } = await supabaseAdmin
		.from("cards")
		.update({ due: past })
		// Belt + braces: scope the UPDATE by user_id again so a future regression
		// in this script can't write across users even if the SELECT above
		// changes shape.
		.in("id", ids)
		.eq("user_id", userId);
	if (updateErr !== null) {
		throw new Error(`update cards.due failed: ${updateErr.message}`);
	}
	return ids.length;
}

async function main(): Promise<void> {
	await deleteExistingFixtureUser();
	const userId = await createFixtureUser();
	const premadeDeckId = await pickFirstActivePremadeDeck();
	const { deckId, cardCount } = await copyPremadeDeck(userId, premadeDeckId);
	if (cardCount < MIN_DUE_CARDS) {
		throw new Error(
			`source premade deck only has ${cardCount} cards; need at least ${MIN_DUE_CARDS}`,
		);
	}
	const dueCount = await forceCardsDue(userId, deckId);

	// Last line is parseable JSON so the auth.setup step can grep it out if
	// ever needed. Preserving plain text on the prior lines keeps the human
	// debug story readable.
	console.log(`seeded user ${FIXTURE_EMAIL} (id=${userId})`);
	console.log(`copied deck ${deckId} (${cardCount} cards) from premade ${premadeDeckId}`);
	console.log(`forced ${dueCount} cards to due=yesterday`);
	console.log(JSON.stringify({ email: FIXTURE_EMAIL, password: FIXTURE_PASSWORD, userId, deckId }));
}

try {
	await main();
	process.exit(0);
} catch (err) {
	console.error(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
	process.exit(1);
}
