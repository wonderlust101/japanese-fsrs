# Implementation Status

This is the current status index. Detailed implementation evidence is split by area under [status/](status/).

Refreshed by code inspection on 2026-05-14 (Stage 3: drill session creation). This records current implementation evidence, not product intent. Product truth lives in [PRODUCT.md](PRODUCT.md), design truth in [DESIGN.md](DESIGN.md), database truth in [DATABASE.md](DATABASE.md), and active tasks in [KANBAN_BOARD.md](KANBAN_BOARD.md).

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
| Backend and Data | 18 | 4 | 4 | 1 | 0 |
| AI and Japanese Content | 6 | 2 | 2 | 0 | 0 |
| Frontend | 7 | 7 | 2 | 0 | 0 |
| Testing | 3 | 0 | 0 | 1 | 1 |

## Archive

Release snapshots belong in [status/archive/](status/archive/). When a release ships, copy the current status index and area files into that archive with the release label before refreshing status for the next active scope.
