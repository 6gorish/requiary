# Data Layer Configuration
## Database and Semantic Encoding Settings

This document covers configuration options for the data layer—database connections, semantic encoding, and related settings.

---

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://abc123.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anonymous key | `eyJhbGc...` |
| `ANTHROPIC_API_KEY` | Anthropic API key for semantic encoding | `sk-ant-...` |
| `IP_SALT` | Random string for IP hashing | Generate with `openssl rand -base64 32` |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | (none) | Service role key for admin operations |

---

## Semantic Encoding Configuration

### API Settings

Configured in `lib/semantic-encoding.ts`:

| Setting | Value | Description |
|---------|-------|-------------|
| Model | `claude-sonnet-4-20250514` | Anthropic model for embedding generation |
| Max Tokens | 500 | Response limit (embeddings are small) |
| Embedding Dimensions | 10 | Vector size for semantic representation |
| Value Range | -1.0 to 1.0 | Normalized embedding values |

### Changing the Model

To use a different Claude model:

```typescript
// lib/semantic-encoding.ts
body: JSON.stringify({
  model: "claude-sonnet-4-20250514",  // Change this
  // ...
})
```

**Considerations:**
- Faster models (Haiku) = lower cost, potentially less nuanced embeddings
- More capable models (Opus) = higher cost, potentially better semantic understanding
- Embeddings from different models are not directly comparable

---

## Similarity Weights

Configured in `lib/config/message-pool-config.ts`:

```typescript
similarity: {
  temporalWeight: 0.6,   // Weight for time proximity
  lengthWeight: 0.2,     // Weight for message length similarity
  semanticWeight: 0.2    // Weight for embedding-based similarity
}
```

### Environment Overrides

```bash
POOL_SIMILARITY_TEMPORAL=0.6    # Range: 0.0-1.0
POOL_SIMILARITY_LENGTH=0.2      # Range: 0.0-1.0
POOL_SIMILARITY_SEMANTIC=0.2    # Range: 0.0-1.0
```

### Weight Guidelines

| Scenario | Temporal | Length | Semantic |
|----------|----------|--------|----------|
| Exhibition (default) | 0.6 | 0.2 | 0.2 |
| Pure semantic clustering | 0.2 | 0.1 | 0.7 |
| Recency-focused | 0.8 | 0.1 | 0.1 |

**Constraint:** Weights must sum to ≤ 1.0 (validated at startup)

---

## Rate Limiting

### Current Implementation

In-memory rate limiting (resets on server restart):

| Setting | Value | Location |
|---------|-------|----------|
| Limit | 3 submissions | API route |
| Window | 1 hour | API route |
| Key | Session ID | Client-generated |

### Database Query for Rate Check

```sql
SELECT COUNT(*) FROM messages
WHERE session_id = $session_id
  AND created_at > NOW() - INTERVAL '1 hour';
```

---

## Database Constraints

### Content Validation

| Constraint | Value | Enforcement |
|------------|-------|-------------|
| Min length | 1 character | Database CHECK |
| Max length | 280 characters | Database CHECK |
| Allowed sources | 'web', 'sms' | Database CHECK |

### Soft Delete Behavior

Messages are never physically deleted. The `deleted_at` column:
- `NULL` = active message (visible)
- Non-NULL timestamp = deleted (filtered from queries)

---

## Connection Pooling

Supabase handles connection pooling automatically. For high-load scenarios:

| Setting | Default | Notes |
|---------|---------|-------|
| Pool mode | Transaction | Recommended for serverless |
| Max connections | Per Supabase plan | Check dashboard |
| Connection timeout | 30s | Supabase default |

---

## Backup and Recovery

### Automated Backups

Supabase provides:
- Point-in-time recovery (Pro plan)
- Daily backups (all plans)

### Manual Export

```bash
# Export all messages
pg_dump $DATABASE_URL --table=messages --data-only > messages_backup.sql
```

---

## How Configuration Serves the Vision

| Configuration | Purpose |
|---------------|---------|
| 60% temporal weight | Recent submissions cluster together—visitors see their contribution connect with the current moment |
| 280 character limit | Constraints invite precision—grief expressed with intention |
| Soft deletion | Messages can be moderated without destroying records—every submission was an act of vulnerability |
| IP hashing (not storing) | Privacy protection—the space is safe for anonymous participation |
| Graceful API degradation | Every submission is honored, even if AI fails—no technical failure should prevent grief from being witnessed |

---

## Related Documentation

- [Database Schema](./DATABASE-SCHEMA.md) - Table structure and indexes
- [Semantic Encoding](./SEMANTIC-ENCODING.md) - Embedding generation details
- [Logic Configuration](../logic/CONFIGURATION.md) - Working set and clustering config
