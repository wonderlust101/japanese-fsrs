# Coding Standards

This file defines cross-cutting coding standards for this monorepo. Read it before making code changes.

This is one of three coordinated standards files:

- **This file:** cross-cutting principles, types and contracts, tests, monorepo hygiene, documentation, workflow.
- **[CODING_STANDARDS_BACKEND.md](CODING_STANDARDS_BACKEND.md):** server-side concerns (data, APIs, security, resilience).
- **[CODING_STANDARDS_FRONTEND.md](CODING_STANDARDS_FRONTEND.md):** client-side concerns (component correctness, UX, accessibility).

When working on a specific package, read this file first and the relevant specialized file.

The conventions here are not preferences — they're requirements. If a change you're considering would violate one of these, stop and surface it for human review rather than silently working around it.

---

## Working principles

**Read before you write.** When asked to make a change, your first move is to understand what already exists. Search the codebase for similar features, shared utilities, and existing conventions. Don't propose code until you can name the patterns this codebase uses for the relevant problem.

**Reuse before you reinvent.** If a utility, component, or helper already exists, use it. Don't create a new date formatter, slug generator, button component, or error class — find the existing one. If you can't find one, ask before adding one.

**Match the codebase's conventions.** Naming, file structure, error handling, validation patterns, test patterns — match what's already there. If conventions are inconsistent, ask which one to follow rather than picking arbitrarily.

**Surface unknowns.** If a requirement is ambiguous, a decision is unclear, or you'd be guessing — ask. Don't paper over uncertainty with plausible-looking code. A clarifying question is cheaper than the wrong implementation.

**Plan before changing many files.** For non-trivial changes, write a short plan first (what files change, what's added, what's removed) and surface it for review before sprinting through a multi-file refactor.

**Don't run destructive commands without approval.** Migrations on real databases, force-pushes, dependency removals, mass file deletions — confirm before executing.

---

## Types and shared contracts

Types are the foundation. Loose types here weaken every later check.

- **No escape-hatch types or unsafe assertions without justification.** (Examples: `any`, unsafe `as SomeType`, `@ts-ignore`, `# type: ignore`, force-casts.) Each one needs a comment explaining why the type system can't express what's actually true. Literal-preserving assertions such as `as const` are allowed when they narrow a real literal value instead of bypassing type checking.
- **Errors caught in language-typed catches are narrowed before use.** Don't access fields on a caught error without confirming the type.
- **Discriminated unions / tagged variants for state.** Independent boolean or optional flags (`{ loading, error, data }`) permit invalid combinations — replace with a discriminated form (`{ status: 'loading' } | { status: 'error', error } | { status: 'success', data }`).
- **Exhaustive handling of variants.** Every switch or match over a union ends with an exhaustiveness check (e.g., a `never` assertion, a sealed-class `else -> error`, an unreachable arm).
- **Shared types live in a shared package.** Don't duplicate type definitions across apps. Domain entities belong in `packages/shared-types` when they cross the API/frontend boundary.
- **Schemas and types are linked.** Validation schemas and type definitions derive from a single source of truth — they can't drift. (e.g., `z.infer` in Zod, type derivation from Pydantic models, OpenAPI generating both client types and server validators.)
- **Validate at trust boundaries.** Anything from the network, user input, parsed JSON, environment variables, or weakly-typed database columns gets a runtime schema check — not just a type assertion.
- **Public exports are intentional.** A package's public API is declared explicitly (e.g., `exports` field in package.json, Python `__all__`, Go uppercase exports). Don't deep-import into another package's internals.

---

## Tests

These are the universal principles. See per-package files for stack-specific patterns.

- **New code has tests.** Logic, branching, transformation, validation. Not trivial passthroughs.
- **Tests would actually fail if the code regressed.** The mutation-resistance check: if you negated a boolean, swapped operands, or skipped a guard clause, would the test catch it? If not, the test isn't testing what it appears to test.
- **No tautological tests.** Asserting on what your own mock returned tests the mock, not the code. Watch for this — it's the most common AI-generated test failure mode.
- **Cover edge cases.** Empty, null, single, two, many. Unicode. Timezone boundaries. Concurrency. Permission boundaries. Failure paths.
- **Test at the right level.** Pure logic → unit. External I/O → integration with real (or test-realistic) dependencies. Critical user flows → end-to-end. Don't unit-test what only integration can verify; don't e2e-test what unit can.
- **Isolation.** Time, randomness, network, filesystem, and database state are controlled per-test, not shared across runs.
- **Async tests are awaited.** Promise-style or coroutine-style — verify rejections happen and assertions actually run.
- **Tests describe behavior, not setup.** "returns 404 when the order does not exist", not "test getOrder".
- **No focused or unexplained skipped tests in committed code.** Both are CI hazards.

---

## Monorepo hygiene

- **No deep imports across packages.** Import other packages by their public name, never by relative path traversing into their source. Use `@fsrs-japanese/shared-types`, never `../../../packages/shared-types/src/...`.
- **No circular dependencies between packages.** And no file-level cycles within a package.
- **Reuse shared utilities.** Before adding a date formatter, slug generator, validation helper, error class, etc., search the workspace. The most likely place is in a shared utilities, types, or domain package.
- **Single version of shared deps.** The framework, Supabase clients, validator, type-checker, and shared build tools use one version across the workspace. Mismatched versions cause runtime errors and bundle bloat.
- **Declare every import.** Each package's manifest lists every imported dependency. No phantom deps relying on hoisting from siblings or root.
- **Workspace protocol for internal deps.** Use Bun workspaces with `workspace:*` for internal packages, never registry-style versions.
- **Configs extend shared bases.** Type-checker config, linter config, formatter config — extend a workspace base, don't fork.
- **Generated code is regenerated and committed (or gitignored consistently).** API clients, schema types, ORM clients. CI verifies no drift.

---

## Documentation and migration notes

- **Public APIs in shared packages have doc comments.** Brief description, non-obvious params, return semantics, errors thrown.
- **Comments explain why, not what.** Don't restate what the code already says. Do explain non-obvious choices, workarounds (with bug links), and constraints not visible in the code.
- **No commented-out code.** Version control preserves it.
- **TODOs have context.** Owner or ticket reference, severity. No anonymous TODOs.
- **Breaking changes are flagged and documented.** Removed export, renamed symbol, narrowed type, changed default behavior, changed response shape — all need:
  - A changelog entry marking it BREAKING.
  - A migration note describing how to update.
  - A deprecation cycle when possible (mark deprecated, document replacement, set removal version, then remove).
- **Deprecation tags on deprecated APIs**, with replacement noted (e.g., `@deprecated` in JSDoc, `DeprecationWarning` in Python, `@Deprecated` in Java/Kotlin).
- **README reflects the current API.** Examples that wouldn't run against current code are worse than no examples.
- **Documentation must not lag behind code.** When a change affects routes/API behavior, architecture, schema/migrations/RPC/persistence, testing approach, active scope/status, or coding standards, update the owning non-brand docs in the same change.
- **Product and design guides are protected.** `docs/PRODUCT.md` and `docs/DESIGN.md` guide the product, brand, and visual direction. Read them when relevant, but do not edit them unless explicitly asked. If code changes create product, brand, or design documentation impact, report the impact and ask before changing those files.

---

## Workflow

When given a task:

1. **Read the relevant code.** Understand existing patterns before proposing changes.
2. **Surface uncertainty.** If anything is ambiguous, ask before coding.
3. **Plan multi-file changes.** A short plan first, confirmed before sprinting.
4. **Make the change.** Match conventions, reuse utilities, follow the rules above and in the per-package files.
5. **Check documentation impact.** Update non-brand docs that would otherwise become stale. Never edit `docs/PRODUCT.md` or `docs/DESIGN.md` unless explicitly asked.
6. **Self-verify before claiming done.**
   - Lint, type-check, and build pass locally.
   - The change does what was requested — no more, no less.
   - No commented-out code, debug logs, focused tests, unused imports.
   - Public APIs have doc comments; breaking changes have a changelog entry.
   - For multi-file changes: do all files line up coherently?
   - Documentation impact was handled or explicitly reported.
7. **Run the test suite.** Don't just trust that tests pass — actually run them and surface the result. If tests fail, investigate and fix before considering the task done. If a test failure is unrelated to your change, surface it explicitly rather than ignoring it.
8. **Ask before committing.** Once tests pass, summarize what changed and ask whether to commit. Don't commit silently. The user decides commit boundaries and messages.

---

## Things to never do without explicit approval

- Run database migrations against production or shared environments.
- Delete files outside the immediate scope of the task.
- Add new top-level dependencies — especially large ones.
- Disable lint rules, suppress type errors, or add escape-hatch annotations to make a problem go away.
- Modify CI config, deploy config, or secret-handling code.
- Force-push, rebase shared branches, or rewrite version control history.
- Introduce a new pattern when an existing one would do.
- Skip the auth check on a route because "this endpoint is internal".
- Hand-edit generated code.
- Commit secrets, credentials, real environment files, or fixtures with real production data.
- Commit changes without asking — always summarize and confirm first.
