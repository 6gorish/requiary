/**
 * Debug Logging Utilities
 * 
 * Conditional logging based on ?debug=true query parameter
 * Keeps logs available for debugging without cluttering production
 */

class DebugLogger {
  private enabled: boolean

  constructor() {
    // Check for debug query param on initialization
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      this.enabled = params.get('debug') === 'true'
    } else {
      this.enabled = false
    }
  }

  log(...args: any[]) {
    if (this.enabled) {
      console.log(...args)
    }
  }

  warn(...args: any[]) {
    if (this.enabled) {
      console.warn(...args)
    }
  }

  error(...args: any[]) {
    // Always show errors
    console.error(...args)
  }

  info(...args: any[]) {
    if (this.enabled) {
      console.info(...args)
    }
  }

  table(data: any) {
    if (this.enabled) {
      console.table(data)
    }
  }

  group(label: string) {
    if (this.enabled) {
      console.group(label)
    }
  }

  groupEnd() {
    if (this.enabled) {
      console.groupEnd()
    }
  }
}

// Export singleton instance
export const debug = new DebugLogger()
