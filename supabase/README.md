# Supabase Database Setup

This directory contains database migrations and setup instructions for Requiary.

## Quick Start

### 1. Run the Migration

In your Supabase project dashboard:

1. Go to **SQL Editor**
2. Click **New Query**
3. Copy the contents of `migrations/001_initial_schema.sql`
4. Paste and run the query
5. Verify the `messages` table was created

### 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

Add your values:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
IP_SALT=generate-a-random-string-here
```

**Generate IP_SALT:**
```bash
openssl rand -base64 32
```

### 3. Verify Setup

Test that the API works:

```bash
# Start dev server
npm run dev

# In another terminal, test the API
curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -d '{"content": "Test message", "sessionId": "test-session-123"}'
```

You should get a success response with the created message.

## Database Schema

### Table: `messages`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `content` | TEXT | Message content (1-280 chars) |
| `approved` | BOOLEAN | Public visibility (default: true) |
| `flagged` | BOOLEAN | Flagged for moderation |
| `moderator_notes` | TEXT | Internal notes |
| `session_id` | TEXT | Client UUID for rate limiting |
| `ip_hash` | TEXT | SHA-256 hash of IP address |
| `user_agent` | TEXT | Browser user agent |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |
| `deleted_at` | TIMESTAMPTZ | Soft delete timestamp |
| `semantic_tags` | JSONB | Reserved for semantic clustering |

### Row Level Security (RLS)

The schema includes three RLS policies:

1. **public_read_approved**: Anyone can read approved, non-deleted messages
2. **public_insert**: Anyone can insert messages with a session_id
3. **service_role_all**: Service role has full access (for admin/moderation)

## Rate Limiting

The API enforces rate limiting:
- **Limit:** 3 submissions per session per hour
- **Key:** `session_id` (client-generated UUID)
- **Storage:** In-memory Map (resets on server restart)

For production, consider:
- Redis for persistent rate limiting
- Upstash for serverless-friendly storage
- IP-based rate limiting in addition to session-based

## Privacy & Security

### IP Hashing
IP addresses are hashed using SHA-256 with a secret salt before storage:
```typescript
const ipHash = crypto
  .createHash('sha256')
  .update(`${ip}:${process.env.IP_SALT}`)
  .digest('hex');
```

This allows:
- ✅ Abuse prevention (can block by hash)
- ✅ Rate limiting
- ❌ Cannot reverse to get original IP

### Session Management
- Client generates UUID with `crypto.randomUUID()`
- Stored in `sessionStorage` (persists across page reloads)
- Not shared across browser tabs
- Cleared when browser/tab closes

## Testing

### Manual Testing

1. **Submit a message:**
   - Go to `/participate`
   - Enter text (1-280 characters)
   - Click "Share Your Grief"
   - Should see success message

2. **Test rate limiting:**
   - Submit 3 messages quickly
   - 4th submission should be rejected with 429 status

3. **Verify in database:**
   - Go to Supabase dashboard → Table Editor → messages
   - Should see your submissions

### API Endpoints

**POST /api/messages**
```json
{
  "content": "Your grief message here",
  "sessionId": "uuid-v4-session-id"
}
```

**GET /api/messages**
```
Query params:
- limit: Number of messages (default: 100)
- offset: Pagination offset (default: 0)
```

## Troubleshooting

### "relation 'messages' does not exist"
→ Run the migration in Supabase SQL Editor

### "Failed to fetch messages" (500 error)
→ Check RLS policies are enabled
→ Verify anon key in .env.local

### Rate limit not working
→ Rate limiting is in-memory, resets on server restart
→ Check sessionStorage in browser DevTools

### Messages not appearing
→ Check `approved = true` and `deleted_at IS NULL`
→ Verify RLS policy: `public_read_approved`
