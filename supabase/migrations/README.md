# Database Migration: UUID → Integer IDs

## Why This Migration?

The original table used UUID primary keys, but the business logic requires integer IDs for:
- Dual-cursor pagination algorithm
- Timeline ordering (sequential IDs)
- Range queries and comparisons
- Better performance for this use case

## How to Run

### Option 1: Supabase Dashboard (Easiest)

1. Go to your Supabase project: https://supabase.com/dashboard/project/bdepnqbhvhjtyrstmjis
2. Click **SQL Editor** in left sidebar
3. Click **New Query**
4. Copy/paste entire contents of `001_switch_to_integer_ids.sql`
5. Click **Run** (or press Cmd+Enter)
6. You should see: "Migration complete! Messages table now uses BIGINT IDs."

### Option 2: Supabase CLI

```bash
# If you have Supabase CLI installed
supabase db push
```

### Option 3: Manual psql (Advanced)

```bash
psql "postgresql://postgres.[PROJECT-REF]@aws-0-us-west-1.pooler.supabase.com:5432/postgres" \
  -f supabase/migrations/001_switch_to_integer_ids.sql
```

## What This Does

1. **Drops** existing `messages` table (⚠️ data will be lost)
2. **Creates** new `messages` table with `BIGSERIAL` (auto-incrementing integer) ID
3. **Creates** optimized indexes for cursor pagination
4. **Configures** Row Level Security (RLS) policies
5. **Grants** appropriate permissions to anon/authenticated roles

## After Migration

### Re-seed Data

You'll need to re-run your seed data script to populate the 600 messages.

If you don't have the seed script anymore, I can regenerate it for you.

### Verify Schema

Check that the migration worked:

```sql
-- Should show 'bigint' not 'uuid'
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND column_name = 'id';
```

### Run Integration Tests

```bash
npm run test:integration
```

Should now pass! ✅

## Rollback (If Needed)

To go back to UUIDs (not recommended):

```sql
DROP TABLE IF EXISTS messages CASCADE;

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ DEFAULT NULL
);
```

## Questions?

- **Will this affect production?** Only if you've deployed to production. Local dev uses local Supabase.
- **What about existing data?** This migration drops the table. Export first if you need to preserve messages.
- **Performance impact?** Integer IDs are faster - this improves performance.

---

**Status:** Ready to run ✅  
**Breaking:** Yes (drops table)  
**Estimated time:** ~5 seconds
