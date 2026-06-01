# Supabase Configuration & Migrations

This directory contains Supabase configuration and PostgreSQL migrations for the japanese-fsrs application.

## Structure

```
supabase/
├── config.toml          # Local development configuration
├── templates/           # Branded Auth email templates (HTML)
└── migrations/          # SQL migration files (applied in order)
```

## Auth Email

Auth emails (signup confirmation, password reset, email change) are sent by
Supabase Auth (GoTrue) through custom **Resend SMTP**, using the branded
templates in `templates/`. These are wired in `config.toml` under
`[auth.email.smtp]` and `[auth.email.template.*]`, with the SMTP secret read from
the gitignored project-root `.env` via `env(SUPABASE_AUTH_SMTP_PASS)`. The flows
are **OTP-based** — templates surface the 6-digit `{{ .Token }}`, not a link.
Setup, plain-text copy, and the deliverability checklist live in
[../docs/EMAIL.md](../docs/EMAIL.md). Locally, sent mail is captured by Inbucket
at <http://localhost:54324>.

## Local Development Setup

### Prerequisites
- Supabase CLI installed (`npm install -g supabase`)
- Docker running (for `supabase start`)
- PostgreSQL 15+ (or use Docker via the CLI)

### Initial Setup

1. **Start the local Supabase stack:**
   ```bash
   supabase start
   ```
   This spins up a local PostgreSQL database, Auth service, and Realtime.

2. **Apply migrations:**
   ```bash
   supabase migration list       # See all migrations
   supabase db reset             # Reset and re-apply all migrations
   ```

3. **Verify the setup:**
   ```bash
   supabase status               # Check services are running
   ```

### Configuration

Edit `config.toml` to customize:
- **PostgreSQL port** — Change from 5432 if you have a local Postgres instance
- **JWT secret** — Generate a random token for local auth
- **Auth settings** — Disable email confirmation for faster local testing
- **Extensions** — pgvector is enabled (required for semantic similarity)

## Migrations

All migrations are in `migrations/` directory, numbered chronologically.

### Running Migrations

**Local:**
```bash
supabase db reset                # Re-apply all migrations from scratch
supabase db push                 # Push local migration changes to remote
```

**Remote (Hosted Supabase):**
```bash
supabase db push --remote        # Deploy migrations to production
supabase migration list          # See applied migrations on remote
```

### Creating New Migrations

```bash
supabase migration new <name>    # Creates migrations/TIMESTAMP_<name>.sql
```

Then edit the file and deploy:
```bash
supabase db push                 # Dry-run by default; approve when prompted
```

## Important Migrations (Recent History)

| Migration | Date | Purpose |
|---|---|---|
| `20260504000009` | 2026-05-04 | Security hardening: auth.uid() guards on SECURITY DEFINER RPCs |
| `20260505000000` | 2026-05-05 | Type fix: daily_pace NUMERIC → FLOAT8 for TypeScript alignment |
| `20260505000001` | 2026-05-05 | Clarify grammar_patterns design: user_id NOT NULL constraint |
| `20260520000000` | 2026-05-20 | Remove unused grammar-pattern feature: drop `grammar_patterns` table, JLPT Grammar premade deck (with seed cards), and `deck_type='grammar'` enum value. User forks of the grammar deck migrated to `deck_type='vocabulary'`. |
| `20260529000000` | 2026-05-29 | Learner-timezone review buckets for due-card caps, heatmap data, forecast windows, and bundled dashboard data. |
| `20260530000000` | 2026-05-30 | Split review forecast rows into backlog, scheduled review, and actual new-card inventory counts. |

## Generating TypeScript Types

The generated Supabase `Database` type is API-local:

```text
apps/api/src/db/database.types.ts
```

Do not generate raw database types into `packages/shared-types`. That package is
for API/web contracts, validation schemas, and domain payload shapes. The web app
intentionally uses Supabase only for auth and should not import the raw database
schema.

Generate types with the existing scripts:

```bash
# Hosted project configured in the root package script
bun run db:types

# Linked local Supabase project from the API workspace
bun run --filter @fsrs-japanese/api gen:types
```

After generation, review and commit changes to `apps/api/src/db/database.types.ts`.
API services should import the generated type from `apps/api/src/db/database.types.ts`.
Shared request/response types should continue to come from
`@fsrs-japanese/shared-types`.

For JSONB fields, narrow through shared schemas/helpers instead of widening the
generated database type:

```typescript
import { getVocabularyFields } from '@fsrs-japanese/shared-types'

const fields = getVocabularyFields(apiCard)
```

## Troubleshooting

### "Migration XXX not applied"
```bash
supabase migration list          # Check which migrations exist locally vs remote
supabase db push                 # Push missing migrations
```

### "PostgreSQL error: cannot change return type of existing function"
This happens when using `CREATE OR REPLACE FUNCTION ... RETURNS TABLE(...)` to change column types. Solution: `DROP FUNCTION` first, then `CREATE`.

### "Cannot connect to local PostgreSQL"
```bash
supabase stop
supabase start
```

### Type generation shows `string` for NUMERIC fields
Supabase emits PostgreSQL `NUMERIC` columns as `string` for arbitrary precision. If
the application treats the value as a JavaScript `number`, prefer changing the
schema to `FLOAT8` through a migration so generated types match runtime usage.
For JSONB or vector columns that still need local narrowing/casting, keep that
cast close to the service boundary that reads or writes the field.

## References

- **Supabase CLI Docs:** https://supabase.com/docs/guides/cli
- **Migration Guide:** https://supabase.com/docs/guides/database/migrations
- **Type Generation:** https://supabase.com/docs/reference/cli/supabase-gen-types-typescript
- **Config Reference:** https://supabase.com/docs/guides/cli/config
