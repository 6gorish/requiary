/**
 * API Route: POST /api/messages
 * Submit a new grief message to the database
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSemanticEmbedding } from '@/lib/semantic-encoding';

// Rate limiting: max 3 submissions per session per hour
const RATE_LIMIT = 3;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

// In-memory rate limit tracking (will reset on server restart)
// For production, consider Redis or Upstash
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { content, sessionId } = body;

    // Validation
    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Trim and validate content length
    const trimmedContent = content.trim();
    if (trimmedContent.length < 1 || trimmedContent.length > 280) {
      return NextResponse.json(
        { error: 'Content must be between 1 and 280 characters' },
        { status: 400 }
      );
    }

    // Rate limiting check
    const now = Date.now();
    const rateLimitKey = sessionId;
    const rateLimitData = rateLimitStore.get(rateLimitKey);

    if (rateLimitData) {
      // Check if we're still in the rate limit window
      if (now < rateLimitData.resetAt) {
        if (rateLimitData.count >= RATE_LIMIT) {
          return NextResponse.json(
            { 
              error: 'Rate limit exceeded. Please wait before submitting another message.',
              retryAfter: Math.ceil((rateLimitData.resetAt - now) / 1000)
            },
            { status: 429 }
          );
        }
        // Increment count
        rateLimitData.count++;
      } else {
        // Window expired, reset
        rateLimitStore.set(rateLimitKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
      }
    } else {
      // First submission for this session
      rateLimitStore.set(rateLimitKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    }

    // Get IP address for hashing
    const ip = 
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';

    // Create IP hash (SHA-256 with salt)
    const ipSalt = process.env.IP_SALT || 'default-salt-change-in-production';
    const ipHash = crypto
      .createHash('sha256')
      .update(`${ip}:${ipSalt}`)
      .digest('hex');

    // Generate semantic embedding
    console.log(`Generating embedding for: "${trimmedContent.substring(0, 50)}..."`)
    const embedding = await getSemanticEmbedding(trimmedContent);

    if (!embedding) {
      console.warn('Failed to generate embedding, storing message without semantic data')
    }

    // Create Supabase client
    const supabase = await createClient();

    // Insert message
    const { data, error } = await supabase
      .from('messages')
      .insert({
        content: trimmedContent,
        session_id: sessionId,
        ip_hash: ipHash,
        source: 'web',
        semantic_data: embedding ? {
          embedding,
          generated_at: new Date().toISOString()
        } : null,
        approved: true, // Public immediately for MVP
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to save message' },
        { status: 500 }
      );
    }

    console.log(`✅ Message ${data.id} stored ${embedding ? 'with' : 'without'} embedding`)

    // Return success
    return NextResponse.json(
      {
        success: true,
        message: data
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch messages (for visualization)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Fetch approved, non-deleted messages
    const { data, error, count } = await supabase
      .from('messages')
      .select('id, content, created_at', { count: 'exact' })
      .eq('approved', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      messages: data || [],
      total: count || 0,
      limit,
      offset
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
