/**
 * Session Management
 * Generates and manages anonymous session IDs for rate limiting
 */

const SESSION_KEY = 'hom_session_id';

/**
 * Get existing session ID from sessionStorage or create a new one
 * Session persists across page reloads but not across tabs
 * 
 * @returns {string} UUID session identifier
 */
export function getOrCreateSessionId(): string {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    throw new Error('getOrCreateSessionId can only be called in browser context');
  }

  // Try to get existing session ID
  let sessionId = sessionStorage.getItem(SESSION_KEY);

  // Create new session ID if none exists
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }

  return sessionId;
}

/**
 * Clear the current session ID (for testing/development)
 */
export function clearSessionId(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(SESSION_KEY);
  }
}

/**
 * Check if a session ID exists
 */
export function hasSessionId(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return sessionStorage.getItem(SESSION_KEY) !== null;
}
