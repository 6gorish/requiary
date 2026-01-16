/**
 * Shared AudioBuffer cache
 * Prevents duplicate sample loading across layers
 * 
 * Each audio file is decoded once and shared by reference.
 * AudioBuffers are immutable, so sharing is safe.
 */

interface CachedSample {
  buffer: AudioBuffer
  duration: number
  refCount: number  // Track how many layers are using this
}

class SampleCache {
  private cache: Map<string, CachedSample> = new Map()
  private loading: Map<string, Promise<AudioBuffer | null>> = new Map()
  private context: AudioContext | null = null

  setContext(context: AudioContext): void {
    this.context = context
  }

  /**
   * Load a sample, returning cached version if available
   */
  async load(filename: string): Promise<AudioBuffer | null> {
    if (!this.context) {
      console.error('[SampleCache] AudioContext not set')
      return null
    }

    // Return cached buffer if available
    const cached = this.cache.get(filename)
    if (cached) {
      cached.refCount++
      console.log(`[SampleCache] Cache hit: ${filename} (refs: ${cached.refCount})`)
      return cached.buffer
    }

    // If already loading, wait for that promise
    const existingLoad = this.loading.get(filename)
    if (existingLoad) {
      console.log(`[SampleCache] Waiting for existing load: ${filename}`)
      return existingLoad
    }

    // Start new load
    const loadPromise = this.loadSample(filename)
    this.loading.set(filename, loadPromise)

    const buffer = await loadPromise
    this.loading.delete(filename)

    return buffer
  }

  private async loadSample(filename: string): Promise<AudioBuffer | null> {
    try {
      const response = await fetch(`/audio/${filename}`)
      if (!response.ok) {
        console.warn(`[SampleCache] Failed to fetch ${filename}: ${response.status}`)
        return null
      }

      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await this.context!.decodeAudioData(arrayBuffer)

      this.cache.set(filename, {
        buffer: audioBuffer,
        duration: audioBuffer.duration,
        refCount: 1
      })

      console.log(`[SampleCache] Loaded: ${filename} (${audioBuffer.duration.toFixed(1)}s, ${(audioBuffer.length * audioBuffer.numberOfChannels * 4 / 1024 / 1024).toFixed(1)}MB)`)
      return audioBuffer
    } catch (error) {
      console.warn(`[SampleCache] Error loading ${filename}:`, error)
      return null
    }
  }

  /**
   * Get buffer info without loading
   */
  getInfo(filename: string): { duration: number; refCount: number } | null {
    const cached = this.cache.get(filename)
    if (!cached) return null
    return { duration: cached.duration, refCount: cached.refCount }
  }

  /**
   * Release a reference to a sample
   * (For future use - could unload when refCount hits 0)
   */
  release(filename: string): void {
    const cached = this.cache.get(filename)
    if (cached) {
      cached.refCount--
      // Could delete if refCount === 0, but keeping for now
    }
  }

  /**
   * Get total memory usage estimate (bytes)
   */
  getMemoryUsage(): { samples: number; totalMB: number; breakdown: Array<{ file: string; mb: number }> } {
    let totalBytes = 0
    const breakdown: Array<{ file: string; mb: number }> = []

    for (const [filename, { buffer }] of this.cache) {
      // Each sample = length * channels * 4 bytes (32-bit float)
      const bytes = buffer.length * buffer.numberOfChannels * 4
      totalBytes += bytes
      breakdown.push({ file: filename, mb: bytes / 1024 / 1024 })
    }

    breakdown.sort((a, b) => b.mb - a.mb)

    return {
      samples: this.cache.size,
      totalMB: totalBytes / 1024 / 1024,
      breakdown
    }
  }

  /**
   * Clear all cached samples
   */
  clear(): void {
    this.cache.clear()
    this.loading.clear()
    console.log('[SampleCache] Cleared')
  }

  /**
   * Log memory usage summary
   */
  logUsage(): void {
    const { samples, totalMB, breakdown } = this.getMemoryUsage()
    console.log(`[SampleCache] ${samples} samples, ${totalMB.toFixed(1)}MB total`)
    console.log('[SampleCache] Top 5 by size:')
    breakdown.slice(0, 5).forEach(({ file, mb }) => {
      console.log(`  ${file}: ${mb.toFixed(1)}MB`)
    })
  }
}

// Singleton instance
export const sampleCache = new SampleCache()
