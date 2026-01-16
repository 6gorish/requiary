/**
 * Logging Control
 * 
 * Temporarily silence business logic logging for development.
 * Set ENABLE_LOGGING to false to quiet all console output.
 */

export const ENABLE_LOGGING = false

// Wrapper for conditional logging
export const log = ENABLE_LOGGING ? console.log.bind(console) : () => {}
export const warn = ENABLE_LOGGING ? console.warn.bind(console) : () => {}
export const error = console.error.bind(console) // Always log errors
