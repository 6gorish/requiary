-- Migration: Initial schema for The House of Mourning
-- Date: 2025-11-17
-- Purpose: Complete database schema with semantic encoding support

-- ============================================================================
-- MESSAGES TABLE
-- ============================================================================

DROP TABLE IF EXISTS messages CASCADE;

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

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Primary query index: approved messages ordered by creation
CREATE INDEX idx_messages_approved_timeline 
  ON messages(approved, deleted_at, created_at DESC, id DESC)
  WHERE approved = true AND deleted_at IS NULL;

-- Cursor pagination: descending (newest first)
CREATE INDEX idx_messages_cursor_desc 
  ON messages(id DESC)
  WHERE approved = true AND deleted_at IS NULL;

-- Cursor pagination: ascending (oldest first)
CREATE INDEX idx_messages_cursor_asc 
  ON messages(id ASC)
  WHERE approved = true AND deleted_at IS NULL;

-- Semantic data queries (GIN index for JSONB)
CREATE INDEX idx_messages_semantic 
  ON messages USING GIN (semantic_data)
  WHERE semantic_data IS NOT NULL;

-- Session-based rate limiting
CREATE INDEX idx_messages_session 
  ON messages(session_id, created_at)
  WHERE session_id IS NOT NULL;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE messages IS 
  'Grief messages for The House of Mourning exhibition. Each message is a user-submitted expression of loss that becomes part of the collective memorial installation.';

COMMENT ON COLUMN messages.id IS 
  'Auto-incrementing 64-bit integer ID. Used for stable cursor pagination.';

COMMENT ON COLUMN messages.content IS 
  'The grief message content. Constrained to 1-280 characters (enforced at database level).';

COMMENT ON COLUMN messages.created_at IS 
  'Timestamp when message was submitted. Used for temporal proximity calculations in clustering algorithm.';

COMMENT ON COLUMN messages.approved IS 
  'Whether message is approved for public display. Default: true (no moderation queue for exhibition).';

COMMENT ON COLUMN messages.deleted_at IS 
  'Soft delete timestamp. NULL = active message. Non-NULL = deleted (hidden from public queries).';

COMMENT ON COLUMN messages.semantic_data IS 
  'AI-generated semantic embeddings for thematic clustering. Structure: {embedding: number[], generated_at: string}. NULL indicates embedding generation failed or message predates semantic encoding feature.';

COMMENT ON COLUMN messages.source IS 
  'Submission source. Values: "web" (website form) or "sms" (text message via Twilio).';

COMMENT ON COLUMN messages.session_id IS 
  'Anonymous session identifier for rate limiting and abuse prevention. Not personally identifiable.';

COMMENT ON COLUMN messages.ip_hash IS 
  'One-way hash of submitter IP address for abuse prevention. Not reversible to actual IP.';

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

-- Anonymous users: read approved messages
GRANT SELECT ON messages TO anon;

-- Authenticated users: read and insert messages
GRANT SELECT, INSERT ON messages TO authenticated;

-- Authenticated users: use ID sequence
GRANT USAGE, SELECT ON SEQUENCE messages_id_seq TO authenticated;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy: Public can view approved, non-deleted messages
CREATE POLICY "Public can view approved messages"
  ON messages
  FOR SELECT
  USING (approved = true AND deleted_at IS NULL);

-- Policy: Authenticated users can insert messages
CREATE POLICY "Authenticated users can insert messages"
  ON messages
  FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- COMPLETION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'The House of Mourning: Schema initialized';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Table created: messages';
  RAISE NOTICE 'Indexes: 5 (timeline, cursors, semantic, session)';
  RAISE NOTICE 'RLS enabled: Public read, authenticated insert';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Run seed script to populate initial data';
  RAISE NOTICE '  2. Test message submission with semantic encoding';
  RAISE NOTICE '  3. Verify clustering algorithm with mixed data';
  RAISE NOTICE '========================================';
END $$;
