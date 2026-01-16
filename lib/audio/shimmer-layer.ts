/**
 * Shimmer Layer: Event-triggered samples
 * One-shot samples triggered by events (new messages, connections, etc.)
 * 
 * Sample categories:
 * - Bell/chime sounds
 * - Short textural hits
 * - Brief atmospheric swells
 */

import type { SonificationConfig } from './types'
import { sampleCache } from './sample-cache'

// Shimmer samples - one-shots for event triggers
const SHIMMER_SAMPLES = [
  'ftus-nyc-subway-bell-shimmer-os.mp3',
  'fizzpop.mp3',
  'fizzpop-dry.mp3',
  'lo-crackle.mp3',
  'fake-vinyl-dry.mp3',
  'lidell-sk1-fly-pass-shimmer.mp3',
  'lidell-sk1-fly-pass-dry.mp3',
  'coyote-dry.mp3',
  'lidell-drill-gtr.mp3',
]

interface ActiveShimmer {
  source: AudioBufferSourceNode
  gain: GainNode
  sample: string
  startTime: number
}

export class ShimmerLayer {
  private context: AudioContext
  private config: SonificationConfig['shimmer']
  private outputGain: GainNode

  // Sample management
  private sampleBuffers: Map<string, AudioBuffer> = new Map()
  private loadedSamples: Set<string> = new Set()
  private activeShimmers: Map<string, ActiveShimmer> = new Map()
  private shimmerCounter: number = 0

  // Timing constraints
  private lastTriggerTime: number = 0
  private minTriggerInterval: number = 2000  // Don't trigger more than once per 2s
  private maxConcurrent: number = 3  // Max simultaneous shimmers

  // Mixer state
  private baseGain: number
  private isMuted: boolean = false

  // Random trigger system
  private randomTriggerInterval: NodeJS.Timeout | null = null
  private minRandomInterval: number = 8000   // Min 8 seconds between random triggers
  private maxRandomInterval: number = 25000  // Max 25 seconds

  constructor(context: AudioContext, config: SonificationConfig['shimmer']) {
    this.context = context
    this.config = config
    this.baseGain = config.gain

    this.outputGain = context.createGain()
    this.outputGain.gain.value = config.gain

    // Start loading samples
    this.loadSamples()
  }

  connect(destination: AudioNode): void {
    this.outputGain.connect(destination)
  }

  /**
   * Load all shimmer samples using shared cache
   */
  private async loadSamples(): Promise<void> {
    console.log('[ShimmerLayer] Loading samples via cache...')
    
    const loadPromises = SHIMMER_SAMPLES.map(async (filename) => {
      const buffer = await sampleCache.load(filename)
      if (buffer) {
        this.sampleBuffers.set(filename, buffer)
        this.loadedSamples.add(filename)
      }
    })

    await Promise.allSettled(loadPromises)
    console.log(`[ShimmerLayer] Loaded ${this.loadedSamples.size}/${SHIMMER_SAMPLES.length} samples`)

    // Start random trigger system
    if (this.loadedSamples.size > 0) {
      this.scheduleRandomTrigger()
    }
  }

  /**
   * Schedule a random shimmer trigger
   */
  private scheduleRandomTrigger(): void {
    const delay = this.minRandomInterval + 
      Math.random() * (this.maxRandomInterval - this.minRandomInterval)

    this.randomTriggerInterval = setTimeout(() => {
      // Trigger with high probability (0.7) - the rate limiting will prevent spam
      this.triggerShimmer(0.7)
      this.scheduleRandomTrigger()
    }, delay)
  }

  /**
   * Trigger a shimmer event
   * @param probability - Probability of actually triggering (0-1)
   */
  triggerShimmer(probability: number = this.config.probability): void {
    // Check probability
    if (Math.random() > probability) return

    // Rate limiting
    const now = Date.now()
    if (now - this.lastTriggerTime < this.minTriggerInterval) return

    // Concurrency limiting
    if (this.activeShimmers.size >= this.maxConcurrent) return

    // Check if we have samples
    if (this.loadedSamples.size === 0) return

    // Pick a random sample
    const samples = Array.from(this.loadedSamples)
    const sample = samples[Math.floor(Math.random() * samples.length)]

    this.playSample(sample)
    this.lastTriggerTime = now
  }

  /**
   * Play a specific sample
   */
  private playSample(sampleName: string): void {
    const buffer = this.sampleBuffers.get(sampleName)
    if (!buffer) return

    const source = this.context.createBufferSource()
    source.buffer = buffer
    source.loop = false

    // Individual gain is for mute control (0 or 1), outputGain handles level
    const gain = this.context.createGain()
    gain.gain.value = this.isMuted ? 0 : 1.0

    source.connect(gain)
    gain.connect(this.outputGain)

    const id = `shimmer-${this.shimmerCounter++}`
    const shimmer: ActiveShimmer = {
      source,
      gain,
      sample: sampleName,
      startTime: this.context.currentTime
    }

    this.activeShimmers.set(id, shimmer)

    // Cleanup when sample ends
    source.onended = () => {
      this.activeShimmers.delete(id)
      try {
        source.disconnect()
        gain.disconnect()
      } catch (e) { /* ignore */ }
    }

    source.start()
    console.log(`[ShimmerLayer] Playing: ${sampleName}`)
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  isPlaying(): boolean {
    return this.activeShimmers.size > 0
  }

  getCurrentSample(): string {
    if (this.activeShimmers.size === 0) return '—'
    // Return most recently started sample
    let latest: ActiveShimmer | null = null
    for (const shimmer of this.activeShimmers.values()) {
      if (!latest || shimmer.startTime > latest.startTime) {
        latest = shimmer
      }
    }
    return latest?.sample ?? '—'
  }

  getActiveCount(): number {
    return this.activeShimmers.size
  }

  // ============================================================
  // MIXER API
  // ============================================================

  getGain(): number {
    return this.baseGain
  }

  setGain(gain: number): void {
    this.baseGain = gain
    if (!this.isMuted) {
      this.outputGain.gain.setTargetAtTime(gain, this.context.currentTime, 0.05)
    }
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted
    // Mute via outputGain (controls all active shimmers at once)
    this.outputGain.gain.setTargetAtTime(
      muted ? 0 : this.baseGain,
      this.context.currentTime,
      0.05
    )
  }

  stop(): void {
    // Clear random trigger
    if (this.randomTriggerInterval) {
      clearTimeout(this.randomTriggerInterval)
      this.randomTriggerInterval = null
    }

    for (const shimmer of this.activeShimmers.values()) {
      try {
        shimmer.source.stop()
        shimmer.source.disconnect()
        shimmer.gain.disconnect()
      } catch (e) { /* ignore */ }
    }
    this.activeShimmers.clear()

    // Release cache references
    for (const filename of this.loadedSamples) {
      sampleCache.release(filename)
    }

    this.sampleBuffers.clear()
    this.loadedSamples.clear()
  }
}
