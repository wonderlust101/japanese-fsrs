# Supabase Configuration & Migrations

This directory contains Supabase configuration and PostgreSQL migrations for the japanese-fsrs application.

## Structure

```
supabase/
├── config.toml          # Local development configuration
├── migrations/          # SQL migration files (applied in order)
└── functions/           # Supabase Edge Functions (if using)
```

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

See the full audit in [`/home/sergei/.claude/plans/polymorphic-finding-badger.md`](../../../home/sergei/.claude/plans/polymorphic-finding-badger.md).

## Generating TypeScript Types

Generate type definitions from your schema:

```bash
# For local schema
supabase gen types typescript --local > packages/shared-types/src/database.types.ts

# For remote schema
supabase gen types typescript --project-id YOUR_PROJECT_ID > packages/shared-types/src/database.types.ts
```

Then use the helpers in `packages/shared-types/src/database.types.helpers.ts` to override JSONB and vector types:

```typescript
import type { TypedCardRow, VocabularyFieldsData } from '@fsrs-japanese/shared-types';

const card = (await supabase.from('cards').select().single()).data as TypedCardRow;
const fields = card.fields_data as VocabularyFieldsData;
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
Use `database.types.helpers.ts` to override types for NUMERIC columns (treated as `string` by Supabase for arbitrary precision). Change these to `FLOAT8` in the schema for `number` type mapping.

## References

- **Supabase CLI Docs:** https://supabase.com/docs/guides/cli
- **Migration Guide:** https://supabase.com/docs/guides/database/migrations
- **Type Generation:** https://supabase.com/docs/reference/cli/supabase-gen-types-typescript
- **Config Reference:** https://supabase.com/docs/guides/cli/config
