# Database Schema
## The House of Mourning Data Layer

The data layer provides persistent storage for grief messages with support for semantic embeddings, moderation, and efficient pagination.

---

## Database Overview

**Platform:** Supabase (PostgreSQL)  
**Primary Table:** `messages`  
**Key Features:** Semantic embeddings, soft deletion, cursor-based pagination

---

## Messages Table

The single table storing all grief submissions.

### Schema

```sql
CREATE TABLE messages (
  -- Primary identification
  id BIGSERIAL PRIMARY KEY,
  
  -- Core content
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 280),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Moderation
  approved BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  
  -- Semantic encoding
  semantic_data JSONB,
  
  -- Submission tracking
  source TEXT DEFAULT 'web' CHECK (source IN ('web', 'sms')),
  session_id TEXT,
  ip_hash TEXT
);
```

### Column Reference

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL | Auto-incrementing 64-bit integer. Used for stable cursor pagination. |
| `content` | TEXT | User's grief expression. Constrained to 1-280 characters at database level. |
| `created_at` | TIMESTAMPTZ | Server timestamp (UTC). Used for temporal proximity calculations in clustering. |
| `approved` | BOOLEAN | Moderation status. Only `approved=true` messages appear in visualization. Default: `true` |
| `deleted_at` | TIMESTAMPTZ | Soft delete timestamp. `NULL` = active, non-NULL = deleted (hidden from queries). |
| `semantic_data` | JSONB | AI-generated semantic embeddings. Structure: `{embedding: number[], generated_at: string}` |
| `source` | TEXT | Submission origin: `'web'` (website form) or `'sms'` (text message). |
| `session_id` | TEXT | Anonymous session identifier for rate limiting. Not personally identifiable. |
| `ip_hash` | TEXT | One-way SHA-256 hash of IP address for abuse prevention. Not reversible. |

---

## Semantic Data Structure

The `semantic_data` JSONB column stores AI-generated embeddings:

```json
{
  "embedding": [-0.8, 0.3, 0.7, -0.2, 0.9, -0.5, 0.1, 0.6, -0.4, 0.8],
  "generated_at": "2025-11-17T20:30:00.000Z"
}
```

**Embedding Array:**
- 10-dimensional vector
- Values between -1.0 and 1.0
- Represents semantic themes: loss type, emotional tone, temporal relationship, specificity, universality
- Generated via Anthropic Claude API (see [Semantic Encoding](./SEMANTIC-ENCODING.md))

**Generated At:**
- ISO 8601 timestamp
- Records when embedding was created
- Useful for tracking stale embeddings if model changes

---

## Indexes

Five indexes optimize different query patterns:

### Primary Timeline Index
```sql
CREATE INDEX idx_messages_approved_timeline 
  ON messages(approved, deleted_at, created_at DESC, id DESC)
  WHERE approved = true AND deleted_at IS NULL;
```
**Purpose:** Main query index for retrieving approved messages ordered by time.

### Cursor Pagination (Descending)
```sql
CREATE INDEX idx_messages_cursor_desc 
  ON messages(id DESC)
  WHERE approved = true AND deleted_at IS NULL;
```
**Purpose:** Historical cursor traversal. Working set loads messages walking backwards through IDs.

### Cursor Pagination (Ascending)
```sql
CREATE INDEX idx_messages_cursor_asc 
  ON messages(id ASC)
  WHERE approved = true AND deleted_at IS NULL;
```
**Purpose:** New message detection. Polling checks for IDs above current watermark.

### Semantic Data Queries
```sql
CREATE INDEX idx_messages_semantic 
  ON messages USING GIN (semantic_data)
  WHERE semantic_data IS NOT NULL;
```
**Purpose:** GIN index for JSONB queries on semantic embeddings.

### Session Rate Limiting
```sql
CREATE INDEX idx_messages_session 
  ON messages(session_id, created_at)
  WHERE session_id IS NOT NULL;
```
**Purpose:** Efficiently query recent submissions by session for rate limiting.

---

## Row Level Security (RLS)

RLS policies control access at the database level.

### Public Read Policy
```sql
CREATE POLICY "Public can view approved messages"
  ON messages
  FOR SELECT
  USING (approved = true AND deleted_at IS NULL);
```
**Effect:** Anonymous users can only see approved, non-deleted messages.

### Authenticated Insert Policy
```sql
CREATE POLICY "Authenticated users can insert messages"
  ON messages
  FOR INSERT
  WITH CHECK (true);
```
**Effect:** Any authenticated request can insert new messages.

### Service Role Access
The service role key bypasses RLS entirely, allowing admin operations.

---

## Query Patterns

### Load Working Set (Historical Cursor)
```sql
SELECT * FROM messages
WHERE id <= $cursor
  AND approved = true
  AND deleted_at IS NULL
ORDER BY id DESC
LIMIT 18;
```

### Check for New Messages (Watermark)
```sql
SELECT * FROM messages
WHERE id > $watermark
  AND approved = true
  AND deleted_at IS NULL
ORDER BY id ASC
LIMIT 20;
```

### Get Message Count
```sql
SELECT COUNT(*) FROM messages
WHERE approved = true
  AND deleted_at IS NULL;
```

### Rate Limit Check
```sql
SELECT COUNT(*) FROM messages
WHERE session_id = $session_id
  AND created_at > NOW() - INTERVAL '1 hour';
```

---

## Data Flow

```
User submits message
         │
         ▼
┌─────────────────────────┐
│  API Route (/api/messages)   │
│  - Validates content         │
│  - Generates semantic embedding│
│  - Hashes IP address         │
│  - Inserts to database       │
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Supabase (PostgreSQL)       │
│  - Stores message            │
│  - Triggers indexes          │
│  - RLS filters read access   │
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Logic Layer Polling         │
│  - Detects new message       │
│  - Adds to priority queue    │
│  - Message appears in viz    │
└─────────────────────────┘
```

---

## How This Serves the Vision

| Technical Choice | Aesthetic Purpose |
|-----------------|-------------------|
| Auto-incrementing BIGINT IDs | Stable cursor pagination ensures smooth, predictable traversal through the grief constellation |
| Soft deletion (`deleted_at`) | Messages can be moderated without destroying the record—respects that every submission was an act of vulnerability |
| Semantic embeddings in JSONB | Enables thematic clustering without complex joins—connections emerge organically |
| Character limit (280) | Constraints invite precision—grief expressed with intention, not sprawl |
| Session-based rate limiting | Prevents abuse while allowing anonymous participation—the space remains open |
| RLS at database level | Security is foundational, not an afterthought—visitors can trust the space |

---

## Environment Variables

Required for database connection:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
IP_SALT=random-string-for-ip-hashing
ANTHROPIC_API_KEY=your-anthropic-key  # For semantic encoding
```

---

## Related Documentation

- [Semantic Encoding](./SEMANTIC-ENCODING.md) - How embeddings are generated
- [Configuration Reference](./CONFIGURATION.md) - Data layer configuration
- [Dual-Cursor System](../logic/DUAL-CURSOR-SYSTEM.md) - How messages flow through the system
