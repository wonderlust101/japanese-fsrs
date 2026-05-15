# Implementation Status

This is the current status index. Detailed implementation evidence is split by area under [status/](status/).

Refreshed by code inspection on 2026-05-14 (Stage 8 + docs cleanup: removed duplicate "AI leech diagnosis" Partial row already covered by the Stage 7 Implemented row, and the "Dashboard weekly summary API" Missing row — superseded by heatmap-derived seven-day activity, no surface needs the endpoint).

Re-touched 2026-05-14 to record the IA import: new canonical IA lives under [information_architecture/](information_architecture/README.md). The current frontend lags the IA on route names, missing surfaces (review setup, problem-card repair, add-flow, library hierarchy, insights split), Settings sections (Display, Data & sync, Review behavior), and unresolved terminology (Leech vs Problem Card, Listening modality coverage). Active reconciliation tasks tracked in [KANBAN_BOARD.md](KANBAN_BOARD.md) under the "IA wireframe doc cleanup", "Reconcile IA card types", "Resolve Problem Card vs Leech", and "Settings IA: missing sections" cards.

Re-touched 2026-05-14 for the **App Router → IA rename** (phase 1 of the migration): `/dashboard`→`/today`, `/analytics`→`/insights`, `/decks/browse` removed, `/profile` folded into `/settings`, card detail hoisted to `/cards/[cardId]`, review staging moved under `/review/setup`; stubs scaffolded for `/add`, `/add/review`, `/cards`, `/cards/[cardId]/repair`, `/decks/[id]/preview`, `/insights/{mistakes,progress,forecast,statistics}`. Stubs render a page title + outgoing IA links only — implementation work is tracked per-surface in [status/FRONTEND.md](status/FRONTEND.md).

This records current implementation evidence, not product intent. Product truth lives in [PRODUCT.md](PRODUCT.md), design truth in [DESIGN.md](DESIGN.md), database truth in [DATABASE.md](DATABASE.md), and active tasks in [KANBAN_BOARD.md](KANBAN_BOARD.md).

`bun run typecheck` was executed for this refresh. No runtime flows were exercised.

## Status Legend

- `Implemented`: code paths exist for the core behavior.
- `Partial`: meaningful code exists, but the product requirement is incomplete, placeholder-backed, or missing a major workflow.
- `Missing`: no active implementation path was found.
- `Unknown`: not enough evidence from static inspection.
- `Manual`: documented process or manual validation only; no automated checker was found.

## Current Status Files

- [Backend and Data](status/BACKEND.md)
- [AI and Japanese Content](status/AI_AND_JAPANESE.md)
- [Frontend](status/FRONTEND.md)
- [Testing](status/TESTING.md)

## Current Summary

| Area | Implemented | Partial | Missing | Unknown | Manual |
|---|---:|---:|---:|---:|---:|
| Backend and Data | 22 | 2 | 1 | 0 | 0 |
| AI and Japanese Content | 6 | 2 | 2 | 0 | 0 |
| Frontend | 7 | 7 | 3 | 0 | 0 |
| Testing | 3 | 0 | 0 | 1 | 1 |

## Archive

Release snapshots belong in [status/archive/](status/archive/). When a release ships, copy the current status index and area files into that archive with the release label before refreshing status for the next active scope.
