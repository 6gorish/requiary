/**
 * Message Pool Configuration
 *
 * Centralized configuration system for message traversal and clustering.
 * Supports environment variable overrides for deployment flexibility.
 */

import type { MessagePoolConfig } from '@/types/grief-messages'

/**
 * Default Configuration
 *
 * Production-tested values optimized for exhibition environment.
 * DO NOT modify these without load testing.
 */
export const DEFAULT_CONFIG: MessagePoolConfig = {
  // Working set: Total messages in particle universe (updated for exhibition)
  workingSetSize: 300,

  // Cluster: Number of connections shown (12 related + focus + next = 14 total particles visible)
  clusterSize: 12,

  // Duration: How long to display each cluster (20 seconds for contemplative viewing)
  clusterDuration: 20000,

  // Polling: Check for new messages every 5 seconds
  pollingInterval: 5000,

  // Priority Queue
  priorityQueue: {
    // Maximum queue size before dropping oldest
    maxSize: 200,

    // Normal mode: Max 5 new messages per cluster
    normalSlots: 5,

    // Adapt queue size based on memory pressure
    memoryAdaptive: true
  },

  // Surge Mode (viral traffic)
  surgeMode: {
    // Activate when queue exceeds 100 messages
    threshold: 100,

    // Surge: 70% new messages
    newMessageRatio: 0.7,

    // Minimum: 30% historical (guaranteed)
    minHistoricalRatio: 0.3
  },

  // Similarity Scoring Weights
  similarity: {
    // Temporal: Messages near in time (60%)
    temporalWeight: 0.6,

    // Length: Similar length messages (20%)
    lengthWeight: 0.2,

    // Semantic: Keyword matching (20%, future)
    semanticWeight: 0.2
  }
}

/**
 * Load Configuration
 *
 * Reads configuration from environment variables with validation.
 * Falls back to DEFAULT_CONFIG for missing values.
 *
 * @returns {MessagePoolConfig} Validated configuration object
 * @throws {Error} If any config value is invalid
 *
 * @example
 * // .env.local
 * POOL_WORKING_SET_SIZE=600
 * POOL_CLUSTER_SIZE=25
 * POOL_CLUSTER_DURATION=10000
 *
 * const config = loadConfig()
 * console.log(config.workingSetSize) // 600
 */
export function loadConfig(): MessagePoolConfig {
  const config: MessagePoolConfig = {
    workingSetSize: parseIntWithValidation(
      process.env.POOL_WORKING_SET_SIZE,
      DEFAULT_CONFIG.workingSetSize,
      100,
      1000,
      'workingSetSize'
    ),

    clusterSize: parseIntWithValidation(
      process.env.POOL_CLUSTER_SIZE,
      DEFAULT_CONFIG.clusterSize,
      5,
      50,
      'clusterSize'
    ),

    clusterDuration: parseIntWithValidation(
      process.env.POOL_CLUSTER_DURATION,
      DEFAULT_CONFIG.clusterDuration,
      3000,
      30000,
      'clusterDuration'
    ),

    pollingInterval: parseIntWithValidation(
      process.env.POOL_POLLING_INTERVAL,
      DEFAULT_CONFIG.pollingInterval,
      1000,
      30000,
      'pollingInterval'
    ),

    priorityQueue: {
      maxSize: parseIntWithValidation(
        process.env.POOL_QUEUE_MAX_SIZE,
        DEFAULT_CONFIG.priorityQueue.maxSize,
        50,
        500,
        'priorityQueue.maxSize'
      ),

      normalSlots: parseIntWithValidation(
        process.env.POOL_QUEUE_NORMAL_SLOTS,
        DEFAULT_CONFIG.priorityQueue.normalSlots,
        1,
        10,
        'priorityQueue.normalSlots'
      ),

      memoryAdaptive: parseBooleanWithDefault(
        process.env.POOL_QUEUE_MEMORY_ADAPTIVE,
        DEFAULT_CONFIG.priorityQueue.memoryAdaptive
      )
    },

    surgeMode: {
      threshold: parseIntWithValidation(
        process.env.POOL_SURGE_THRESHOLD,
        DEFAULT_CONFIG.surgeMode.threshold,
        50,
        200,
        'surgeMode.threshold'
      ),

      newMessageRatio: parseFloatWithValidation(
        process.env.POOL_SURGE_NEW_RATIO,
        DEFAULT_CONFIG.surgeMode.newMessageRatio,
        0.5,
        0.9,
        'surgeMode.newMessageRatio'
      ),

      minHistoricalRatio: parseFloatWithValidation(
        process.env.POOL_SURGE_MIN_HISTORICAL,
        DEFAULT_CONFIG.surgeMode.minHistoricalRatio,
        0.1,
        0.5,
        'surgeMode.minHistoricalRatio'
      )
    },

    similarity: {
      temporalWeight: parseFloatWithValidation(
        process.env.POOL_SIMILARITY_TEMPORAL,
        DEFAULT_CONFIG.similarity.temporalWeight,
        0.0,
        1.0,
        'similarity.temporalWeight'
      ),

      lengthWeight: parseFloatWithValidation(
        process.env.POOL_SIMILARITY_LENGTH,
        DEFAULT_CONFIG.similarity.lengthWeight,
        0.0,
        1.0,
        'similarity.lengthWeight'
      ),

      semanticWeight: parseFloatWithValidation(
        process.env.POOL_SIMILARITY_SEMANTIC,
        DEFAULT_CONFIG.similarity.semanticWeight,
        0.0,
        1.0,
        'similarity.semanticWeight'
      )
    }
  }

  // Validate cross-field constraints
  validateConfig(config)

  return config
}

/**
 * Parse integer from environment variable with validation
 *
 * @param envValue - Environment variable value
 * @param defaultValue - Default if env var missing
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @param fieldName - Field name for error messages
 * @returns Validated integer
 */
function parseIntWithValidation(
  envValue: string | undefined,
  defaultValue: number,
  min: number,
  max: number,
  fieldName: string
): number {
  if (envValue === undefined || envValue === '') {
    return defaultValue
  }

  const parsed = parseInt(envValue, 10)

  if (isNaN(parsed)) {
    throw new Error(
      `Invalid ${fieldName}: "${envValue}" is not a valid integer`
    )
  }

  if (parsed < min || parsed > max) {
    throw new Error(
      `Invalid ${fieldName}: ${parsed} is out of range [${min}, ${max}]`
    )
  }

  return parsed
}

/**
 * Parse float from environment variable with validation
 *
 * @param envValue - Environment variable value
 * @param defaultValue - Default if env var missing
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @param fieldName - Field name for error messages
 * @returns Validated float
 */
function parseFloatWithValidation(
  envValue: string | undefined,
  defaultValue: number,
  min: number,
  max: number,
  fieldName: string
): number {
  if (envValue === undefined || envValue === '') {
    return defaultValue
  }

  const parsed = parseFloat(envValue)

  if (isNaN(parsed)) {
    throw new Error(
      `Invalid ${fieldName}: "${envValue}" is not a valid number`
    )
  }

  if (parsed < min || parsed > max) {
    throw new Error(
      `Invalid ${fieldName}: ${parsed} is out of range [${min}, ${max}]`
    )
  }

  return parsed
}

/**
 * Parse boolean from environment variable
 *
 * @param envValue - Environment variable value
 * @param defaultValue - Default if env var missing
 * @returns Boolean value
 */
function parseBooleanWithDefault(
  envValue: string | undefined,
  defaultValue: boolean
): boolean {
  if (envValue === undefined || envValue === '') {
    return defaultValue
  }

  const lower = envValue.toLowerCase()
  if (lower === 'true' || lower === '1' || lower === 'yes') {
    return true
  }
  if (lower === 'false' || lower === '0' || lower === 'no') {
    return false
  }

  return defaultValue
}

/**
 * Validate cross-field configuration constraints
 *
 * @param config - Configuration to validate
 * @throws {Error} If validation fails
 */
function validateConfig(config: MessagePoolConfig): void {
  // Cluster size cannot exceed working set size
  if (config.clusterSize >= config.workingSetSize) {
    throw new Error(
      `clusterSize (${config.clusterSize}) must be less than workingSetSize (${config.workingSetSize})`
    )
  }

  // Normal slots cannot exceed cluster size
  if (config.priorityQueue.normalSlots > config.clusterSize) {
    throw new Error(
      `priorityQueue.normalSlots (${config.priorityQueue.normalSlots}) cannot exceed clusterSize (${config.clusterSize})`
    )
  }

  // Surge ratios must sum to 1.0 (or less)
  const surgeSum =
    config.surgeMode.newMessageRatio + config.surgeMode.minHistoricalRatio

  if (surgeSum > 1.0) {
    throw new Error(
      `surgeMode ratios sum to ${surgeSum.toFixed(2)}, must be <= 1.0`
    )
  }

  // Similarity weights must sum to 1.0 (or less)
  const simSum =
    config.similarity.temporalWeight +
    config.similarity.lengthWeight +
    config.similarity.semanticWeight

  if (simSum > 1.0) {
    throw new Error(
      `similarity weights sum to ${simSum.toFixed(2)}, must be <= 1.0`
    )
  }

  // Surge threshold should be less than max queue size
  if (config.surgeMode.threshold >= config.priorityQueue.maxSize) {
    console.warn(
      `[CONFIG] Warning: surgeMode.threshold (${config.surgeMode.threshold}) is >= priorityQueue.maxSize (${config.priorityQueue.maxSize}). Surge mode may not activate.`
    )
  }
}

/**
 * Get memory usage percentage
 *
 * Returns current JavaScript heap usage as percentage.
 * Used for memory-adaptive queue sizing.
 *
 * @returns Memory usage (0-100)
 */
export function getMemoryUsage(): number {
  // Only available in some environments (Node.js, Chrome)
  const mem = (performance as any).memory

  if (!mem || !mem.usedJSHeapSize || !mem.totalJSHeapSize) {
    // Memory API not available - assume moderate usage
    return 50
  }

  const percentage = (mem.usedJSHeapSize / mem.totalJSHeapSize) * 100
  return Math.min(100, Math.max(0, percentage))
}
