# Database Scaling Guide

This document outlines the growth trajectory of the Japanese FSRS database and actions to take at specific scale thresholds to maintain performance and stability.

---

## Current Scale Estimates (May 2026)

| Table | Estimated Rows (at launch) | Avg Row Size | Growth Driver |
|---|---|---|---|
| `profiles` | 1–10 | ~500 B | 1 row per user |
| `decks` | 10–50 | ~300 B | ~5 decks per user |
| `cards` | 1,000–5,000 | ~2 KB | ~500–5,000 cards per user |
| `review_logs` | 100–1,000 | ~500 B | ~10–100 reviews per user |
| `leeches` | 0–100 | ~200 B | 1–2% of cards become leeches |
| `premade_decks` | 20–50 | ~1 KB | Static system data |
| `user_premade_subscriptions` | 50–500 | ~200 B | ~5–50 per user |
| `grammar_patterns` | 0–500 | ~1 KB | User-created or premade |

**Estimated total storage: 2–10 GB** (at launch with 100–1000 active users)

---

## Growth Projections

Assume:
- **5–10 active users** in Week 1
- **100–500 active users** by Month 3
- **1,000+ active users** by Month 6

Per active user, typical behavior:
- **Reviews per day**: 5–50 (depending on study intensity)
- **Cards per user**: 500–5,000
- **Average review_logs per user**: 5–10 per day

### Projections by Milestone

| Milestone | Users | Total review_logs | Total cards | Key Action |
|---|---|---|---|---|
| Launch (May 2026) | 10 | 100–500 | 1,000–5,000 | Monitor baselines |
| Month 1 | 50 | 5K–25K | 10K–50K | No action needed |
| Month 3 | 200 | 100K–500K | 50K–250K | Begin caching analytics |
| Month 6 | 500 | 500K–2.5M | 250K–1.25M | Implement partitioning plan |
| Year 1 | 1,000+ | 1M–5M | 500K–2.5M | Active monitoring + tuning |

---

## Scaling Thresholds & Actions

### Threshold 1: 1 Million Review Logs

**When**: ~6–9 months (at 500+ active users)

**Issue**: Analytics RPCs (`get_heatmap_data`, `get_jlpt_gap`, `get_milestone_forecast`) will take 2–5 seconds for power users with >100k reviews each.

**Action**:
1. Implement **materialized view** for daily aggregations:
   ```sql
   CREATE MATERIALIZED VIEW user_daily_stats AS
   SELECT user_id, 
          DATE(reviewed_at AT TIME ZONE 'UTC') AS date,
          COUNT(*) as review_count,
          SUM(CASE WHEN rating IN ('good', 'easy') THEN 1 ELSE 0 END) as learned_count
   FROM review_logs
   GROUP BY user_id, DATE(reviewed_at AT TIME ZONE 'UTC');
   
   CREATE INDEX ON user_daily_stats(user_id, date DESC);
   ```

2. Update `get_heatmap_data()` RPC to read from materialized view instead of aggregating `review_logs` directly.

3. Refresh materialized view nightly (11 PM UTC) or on-demand after review submission:
   ```sql
   REFRESH MATERIALIZED VIEW CONCURRENTLY user_daily_stats;
   ```

4. Monitor view refresh time — if > 5 minutes, move to incremental trigger-based updates.

**Expected improvement**: Analytics queries drop from 2–5s to <100ms.

---

### Threshold 2: 50 Million Review Logs (Partitioning)

**When**: ~18–24 months (at 1,000+ active users with high engagement)

**Issue**: Index bloat on `review_logs` causes slower writes; VACUUM time increases.

**Action**: Implement **list partitioning by user_id** or **range partitioning by reviewed_at**:

**Option A: List Partition by user_id** (recommended for analytics isolation)
```sql
-- Create partitioned table
CREATE TABLE review_logs_partitioned (
  id UUID,
  user_id UUID,
  card_id UUID,
  rating review_rating,
  reviewed_at TIMESTAMPTZ,
  -- ... other columns ...
  PARTITION BY LIST (user_id)
);

-- Create partitions for active users; default for others
CREATE TABLE review_logs_p_user_001 PARTITION OF review_logs_partitioned
  FOR VALUES IN ('uuid-of-user-1', 'uuid-of-user-2', ...);

CREATE TABLE review_logs_p_default PARTITION OF review_logs_partitioned DEFAULT;

-- Migrate data (in batches):
INSERT INTO review_logs_partitioned SELECT * FROM review_logs
  ON CONFLICT DO NOTHING;

-- Swap tables
ALTER TABLE review_logs RENAME TO review_logs_old;
ALTER TABLE review_logs_partitioned RENAME TO review_logs;
```

**Option B: Range Partition by reviewed_at** (simpler, for time-based cleanup)
```sql
-- Monthly partitions
CREATE TABLE review_logs_2026_05 PARTITION OF review_logs
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE review_logs_2026_06 PARTITION OF review_logs
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
-- ... continue monthly ...
```

**Expected improvement**: Index sizes drop 70%; VACUUM time reduced from hours to minutes.

---

### Threshold 3: 1 Million Cards Per User (Per-User Partitioning)

**When**: ~24+ months (only for power users with extreme card collections)

**Issue**: Single user's cards table scans become slow; `getDueCards()` returns 100k+ rows.

**Action**: 
1. Add a **partial index** for the specific user's due cards:
   ```sql
   CREATE INDEX cards_user_1234_due_idx ON cards(due)
     WHERE user_id = 'uuid-of-power-user' AND is_suspended = FALSE;
   ```

2. If still slow, consider moving power user to separate **read replica** for analytics-heavy queries.

3. Or implement **per-user sharding** (move to separate PostgreSQL instance) — but this is a major operational change.

**Expected improvement**: Due-card queries stay <100ms even for power users.

---

## Monitoring & Maintenance

### Weekly Health Checks

Run these queries to monitor index health and dead tuple accumulation:

```sql
-- Check dead tuple bloat on hot tables
SELECT relname, n_dead_tup, last_autovacuum, last_vacuum
FROM pg_stat_user_tables
WHERE relname IN ('cards', 'review_logs', 'leeches')
ORDER BY n_dead_tup DESC;

-- Alert if n_dead_tup > 100,000 on any table

-- Check index bloat
SELECT indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC
LIMIT 20;
```

### Monitoring Parameters

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| `n_dead_tup` on `review_logs` | < 10k | 10k–100k | > 100k |
| `n_dead_tup` on `cards` | < 5k | 5k–50k | > 50k |
| VACUUM duration | < 5 min | 5–15 min | > 15 min |
| Analytics query (p95) | < 100 ms | 100–500 ms | > 500 ms |
| Index scan efficiency | > 0.9 | 0.7–0.9 | < 0.7 |

### Supabase Auto-VACUUM

Supabase PostgreSQL instances have auto-VACUUM enabled by default. No manual action is required, but monitor via pg_stat_user_tables to ensure it's keeping up.

If `n_dead_tup` grows unbounded:
1. Check `last_autovacuum` timestamp — if recent, vacuum is running
2. If not recent, file a support ticket with Supabase
3. As a workaround, manually run `VACUUM ANALYZE` during low-traffic hours

---

## Embedding Vector Index Tuning

### Current Configuration

**IVFFlat index** on `cards.embedding`:
```sql
CREATE INDEX cards_embedding_idx
  ON cards USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

- `lists=100` is tuned for ~1M vectors
- Cost: ~5% index overhead; ~10% slower inserts

### Tuning by Scale

| Total Vectors | lists | Notes |
|---|---|---|
| < 1M | 50 | Smaller index, faster builds |
| 1M–5M | 100 | **Current; balanced** |
| 5M–10M | 200 | Increase for better search precision |
| > 10M | 300 | High precision; rebuilds may take hours |

When to rebuild:
```sql
-- Drop old index
DROP INDEX cards_embedding_idx;

-- Create new index with higher lists
CREATE INDEX CONCURRENTLY cards_embedding_idx
  ON cards USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 200);

-- Index build runs in background; queries still work on old index during build
```

**Expected improvement**: Semantic search remains < 100ms even with millions of cards.

---

## Backup & Recovery Strategy

### Automated Backups

Supabase provides:
- **Automatic daily backups** (7-day retention by default)
- **Point-in-time recovery (PITR)** available with Supabase Pro tier

### Manual Backup (for critical milestones)

Before major migrations or deployments:
```bash
supabase db pull --db-url "postgresql://..." > backup-YYYY-MM-DD.sql
```

### Recovery Procedure

If data corruption occurs:
1. Create a new Supabase project
2. Run `supabase db push` with the backup SQL file
3. Verify data integrity
4. Redirect application to new database
5. Archive old project for forensics

---

## Cluster Health Checklist

Before scaling to next threshold:

- [ ] Replication lag < 1 second (check `pg_stat_replication`)
- [ ] Index bloat on hot tables < 30%
- [ ] VACUUM duration < 30 minutes
- [ ] p95 query latency < 500ms
- [ ] Connection pool utilization < 80% (if using pgBouncer)
- [ ] Backup retention policy documented and tested
- [ ] Monitoring alerts configured for all thresholds above

---

## References

- [pgvector documentation](https://github.com/pgvector/pgvector)
- [PostgreSQL PARTITIONING](https://www.postgresql.org/docs/current/ddl-partitioning.html)
- [PostgreSQL VACUUM and ANALYZE](https://www.postgresql.org/docs/current/maintenance.html)
- [Supabase scaling guide](https://supabase.com/docs/guides/database/best-practices)

---

**Last updated**: May 2026
**Maintained by**: Database team
