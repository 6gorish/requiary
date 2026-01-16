/**
 * Environment Check for Tests
 * 
 * Validates that required environment variables are set
 * and provides helpful error messages if not.
 */

export function checkTestEnvironment(): {
  isValid: boolean
  missing: string[]
  warnings: string[]
} {
  const missing: string[] = []
  const warnings: string[] = []

  // Required for integration and load tests
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    missing.push('NEXT_PUBLIC_SUPABASE_URL')
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  // Optional but recommended
  if (!process.env.MESSAGE_POOL_WORKING_SET) {
    warnings.push('MESSAGE_POOL_WORKING_SET not set - using default')
  }

  const isValid = missing.length === 0

  return { isValid, missing, warnings }
}

export function printEnvironmentStatus(): void {
  const { isValid, missing, warnings } = checkTestEnvironment()

  if (isValid) {
    console.log('✓ Test environment is properly configured\n')
  } else {
    console.error('✗ Test environment is incomplete\n')
    console.error('Missing required variables:')
    missing.forEach(key => console.error(`  - ${key}`))
    console.error('\nPlease set these in .env.local\n')
  }

  if (warnings.length > 0) {
    console.warn('⚠️  Warnings:')
    warnings.forEach(msg => console.warn(`  - ${msg}`))
    console.warn('')
  }
}

// Helper to get database info for debugging
export function getDatabaseInfo(): {
  url: string | null
  hasKey: boolean
  environment: string
} {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || null
  const hasKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const environment = process.env.NODE_ENV || 'development'

  return { url, hasKey, environment }
}
