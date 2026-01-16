# Testing Guide

## Test Structure

The test suite is organized into three layers:

### 1. Unit Tests (`tests/services/`)
Tests individual services in isolation using mocks.

- `cluster-selector.test.ts` - Message clustering and similarity scoring
- `message-pool-manager.test.ts` - Dual-cursor pagination and pool management
- `message-logic-service.test.ts` - Main service coordinator

**Run unit tests:**
```bash
npm test tests/services
```

### 2. Integration Tests (`tests/integration/`)
Tests the complete stack with real Supabase connection.

- `full-stack.test.ts` - End-to-end system validation

**Run integration tests:**
```bash
npm run test:integration
```

**Requirements:**
- Valid `.env.local` with Supabase credentials
- Active Supabase instance with seed data

### 3. Load Tests (`tests/load/`)
Performance and stress testing under realistic conditions.

- `stress.test.ts` - Performance validation and stress scenarios

**Run load tests:**
```bash
npm run test:load
```

**Requirements:**
- Valid `.env.local` with Supabase credentials
- Database with 500+ seed messages recommended

---

## Quick Start

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm test -- --watch
```

### Run Tests with UI
```bash
npm run test:ui
```

### Run Specific Test File
```bash
npm test tests/services/cluster-selector.test.ts
```

### Check Test Coverage
```bash
npm run test:coverage
```

---

## Environment Setup

### Required Environment Variables

Create `.env.local` in project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### Optional Test Configuration

Override pool configuration via environment:

```env
MESSAGE_POOL_WORKING_SET=400
MESSAGE_POOL_CLUSTER_SIZE=20
MESSAGE_POOL_DURATION_MS=8000
```

---

## Test Output

### Successful Test Run
```
✓ tests/services/cluster-selector.test.ts (40)
✓ tests/services/message-pool-manager.test.ts (50)
✓ tests/services/message-logic-service.test.ts (30)

Test Files  3 passed (3)
Tests  120 passed (120)
```

### Coverage Report
```
File                              | % Stmts | % Branch | % Funcs | % Lines
lib/services/cluster-selector.ts  |   95.2  |   89.3   |  100.0  |  95.2
lib/services/database-service.ts  |   88.5  |   82.1   |   90.0  |  88.5
lib/services/message-pool-...    |   92.8  |   86.4   |  100.0  |  92.8
lib/services/message-logic-...   |   94.1  |   88.7   |  100.0  |  94.1
```

---

## Troubleshooting

### Tests Skip with "No Supabase credentials"
- Ensure `.env.local` exists with valid credentials
- Check that `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set

### Integration Tests Fail with "Database empty"
- Load seed data into Supabase
- Verify messages have `approved=true` and `deleted_at=null`

### Load Tests Timeout
- Increase timeout in `vitest.config.ts`: `testTimeout: 60000`
- Check Supabase connection speed
- Reduce test iteration counts in `tests/load/stress.test.ts`

### TypeScript Errors
- Ensure all dependencies installed: `npm install`
- Check `tsconfig.json` includes test files
- Verify path aliases work: `@/lib` should resolve to `./lib`

---

## Performance Benchmarks

Expected performance targets:

| Operation | Target | Acceptable |
|-----------|--------|------------|
| Initialization (500 msgs) | < 2s | < 5s |
| Cluster generation | < 50ms | < 100ms |
| Message submission | < 100ms | < 200ms |
| Concurrent reads (10) | < 500ms | < 1s |

---

## Continuous Integration

### GitHub Actions (Future)

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
```

---

## Next Steps After Testing

1. **Review Coverage** - Aim for 80%+ on business logic
2. **Fix Failures** - Address any failing tests
3. **Performance Tuning** - Optimize based on load test results
4. **Documentation** - Update API docs based on test insights
5. **Integration** - Move to Phase 2B (presentation layer)
