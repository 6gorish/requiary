import { defineConfig } from 'vitest/config'
import path from 'path'
import { loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // Load env files
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    test: {
      environment: 'node', // Use 'node' for backend logic tests
      setupFiles: ['./tests/setup.ts'],
      include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
      exclude: ['node_modules', '.next', '.vercel'],
      env: {
        // Make .env.local variables available to tests
        NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      },
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        include: ['lib/**/*.ts'],
        exclude: [
          'node_modules/',
          'tests/',
          '*.config.ts',
          'lib/supabase/**', // Exclude Supabase client (external)
          '**/*.d.ts',
        ],
        thresholds: {
          lines: 80,
          functions: 80,
          branches: 75,
          statements: 80,
        }
      },
      // Increase timeout for integration/load tests
      testTimeout: 30000,
      hookTimeout: 30000,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
      }
    }
  }
})
