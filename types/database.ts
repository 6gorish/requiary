/**
 * Database Type Definitions
 * Generated from Supabase schema
 */

export interface Database {
  public: {
    Tables: {
      messages: {
        Row: {
          id: string;
          content: string;
          approved: boolean;
          flagged: boolean;
          moderator_notes: string | null;
          session_id: string | null;
          ip_hash: string | null;
          user_agent: string | null;
          source: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          semantic_tags: Record<string, number> | null;
          semantic_data: {
            embedding: number[];
            generated_at: string;
          } | null;
        };
        Insert: {
          id?: string;
          content: string;
          approved?: boolean;
          flagged?: boolean;
          moderator_notes?: string | null;
          session_id?: string | null;
          ip_hash?: string | null;
          user_agent?: string | null;
          source?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          semantic_tags?: Record<string, number> | null;
          semantic_data?: {
            embedding: number[];
            generated_at: string;
          } | null;
        };
        Update: {
          id?: string;
          content?: string;
          approved?: boolean;
          flagged?: boolean;
          moderator_notes?: string | null;
          session_id?: string | null;
          ip_hash?: string | null;
          user_agent?: string | null;
          source?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          semantic_tags?: Record<string, number> | null;
          semantic_data?: {
            embedding: number[];
            generated_at: string;
          } | null;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// Helper types for client usage
export type Message = Database['public']['Tables']['messages']['Row'];
export type MessageInsert = Database['public']['Tables']['messages']['Insert'];
export type MessageUpdate = Database['public']['Tables']['messages']['Update'];

// API Response types
export interface MessageSubmissionResponse {
  success: boolean;
  message?: Message;
  error?: string;
  retryAfter?: number;
}

export interface MessagesListResponse {
  messages: Message[];
  total: number;
  limit: number;
  offset: number;
}
