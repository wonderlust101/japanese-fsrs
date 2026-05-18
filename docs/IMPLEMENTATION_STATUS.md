# Implementation Status

This is the current status index. Detailed implementation evidence is split by area under [status/](status/).

`bun run typecheck` was executed for this refresh. No runtime flows were exercised.

Summary counts below cover the five legend statuses only. Two ad-hoc statuses appear on individual rows in the underlying files and are excluded from the totals:
- `N/A`: row no longer applies to the product (e.g. the removed paid/free tier model).
- `Removed from scope`: feature explicitly retired (e.g. premade deck merge/sync).

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
| Backend and Data | 28 | 1 | 0 | 0 | 0 |
| AI and Japanese Content | 10 | 0 | 1 | 0 | 0 |
| Frontend | 10 | 10 | 2 | 0 | 0 |
| Testing | 3 | 0 | 1 | 0 | 1 |

## Archive

Release snapshots belong in [status/archive/](status/archive/). When a release ships, copy the current status index and area files into that archive with the release label before refreshing status for the next active scope.
