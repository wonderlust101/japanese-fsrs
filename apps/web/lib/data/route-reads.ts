import { cache } from "react";

import { getCardByIdAction } from "@/lib/actions/cards.actions";

import { getDeckAction } from "@/lib/actions/decks.actions";
import "server-only";

/**
 * Per-request memoized reads for Server Components that fetch the same entity in
 * both `generateMetadata` and the page body. React's `cache()` collapses the
 * duplicate calls — Supabase session read + API fetch + schema parse — to a
 * single execution per request, keyed by the argument.
 *
 * These wrap the `'use server'` actions (which can't host `cache()` themselves —
 * a 'use server' module may only export server actions) and are `server-only`,
 * so they never reach the client bundle. Client callers keep using the actions
 * directly via the TanStack Query hooks.
 */
export const getCardByIdCached = cache(getCardByIdAction);
export const getDeckCached = cache(getDeckAction);
