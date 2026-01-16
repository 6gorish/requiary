#!/usr/bin/env node

/**
 * Quick Start Test Verification
 * 
 * Simple environment check without TypeScript imports
 */

console.log('='.repeat(60))
console.log('House of Mourning - Test Environment Verification')
console.log('='.repeat(60))
console.log('')

// Load .env.local if it exists
try {
  const fs = require('fs')
  const path = require('path')
  const envPath = path.join(process.cwd(), '.env.local')
  
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8')
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=')
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim()
        process.env[key.trim()] = value
      }
    })
  }
} catch (err) {
  console.warn('⚠️  Could not load .env.local')
}

// Check environment
const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL
const hasKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (hasUrl && hasKey) {
  console.log('✓ Test environment is properly configured\n')
  console.log('Database Configuration:')
  console.log(`  URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`)
  console.log(`  Has Key: ✓`)
  console.log('')
  console.log('✓ You can run all test suites:\n')
  console.log('  npm test                  # Run all unit tests')
  console.log('  npm run test:ui           # Run with UI')
  console.log('  npm run test:integration  # Run integration tests')
  console.log('  npm run test:load         # Run load tests')
  console.log('  npm run test:coverage     # Check coverage')
} else {
  console.log('⚠️  Limited test capabilities\n')
  
  if (!hasUrl) console.log('  ✗ NEXT_PUBLIC_SUPABASE_URL not set')
  if (!hasKey) console.log('  ✗ NEXT_PUBLIC_SUPABASE_ANON_KEY not set')
  
  console.log('')
  console.log('  npm test                  # Unit tests only (mocked)')
  console.log('')
  console.log('To enable integration and load tests:')
  console.log('  1. Create .env.local in project root')
  console.log('  2. Add your Supabase credentials:')
  console.log('     NEXT_PUBLIC_SUPABASE_URL=your_url')
  console.log('     NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key')
}

console.log('')
console.log('='.repeat(60))
console.log('')

// Exit with appropriate code
process.exit(hasUrl && hasKey ? 0 : 1)
