/**
 * Field Layer: Ambient texture beds
 * Crossfades between ambient samples to create evolving background texture
 * 
 * Sample categories:
 * - Shimmer-processed ambiences (subway, thunder, sirens)
 * - Drone textures (lidell-drone-home, lidell-drifter)
 * - Crackle/vinyl textures
 */

import type { SonificationConfig } from './types'
import { sampleCache } from './sample-cache'

// Field samples - ambient beds for slow crossfading
const FIELD_SAMPLES = [
  'ftus-thunder-shimmer.mp3',
  'ftus-nyc-subway-shimmer.mp3',
  'ftus-sirens-shimmer.mp3',
  'ftus-children-shimmer.mp3',
  'ftus-dia-beeps-shimmer.mp3',
  'ftus-dia-loop.mp3',
  'ftus-pigeons-loop.mp3',
  'lidell-drone-home.mp3',
  'lidell-drifter-1.mp3',
  'fake-vinyl-shimmer.mp3',
  'lo-stereo-crackle.mp3',
]

interface ActivePlayer {
  source: AudioBufferSourceNode
  gain: GainNode
  sample: string
}

export class FieldLayer {
  private context: AudioContext
  private config: SonificationConfig['field']
  private outputGain: GainNode

  // Sample management
  private sampleBuffers: Map<string, AudioBuffer> = new Map()
  private loadedSamples: Set<string> = new Set()
  private currentPlayer: ActivePlayer | null = null
  private nextPlayer: ActivePlayer | null = null
  private crossfadeTimeout: NodeJS.Timeout | null = null
  private cleanupTimeouts: Set<NodeJS.Timeout> = new Set()  // Track cleanup timeouts

  // Timing
  private crossfadeDuration: number = 8000  // 8 second crossfade
  private minPlayDuration: number = 30000   // Play for at least 30 seconds
  private maxPlayDuration: number = 90000   // Play for at most 90 seconds

  // Mixer state
  private baseGain: number  // Set from config
  private isMuted: boolean = false

  constructor(context: AudioContext, config: SonificationConfig['field']) {
    this.context = context
    this.config = config
    this.baseGain = config.gain  // Use config value

    this.outputGain = context.createGain()
    this.outputGain.gain.value = this.baseGain

    // Start loading samples
    this.loadSamples()
  }

  connect(destination: AudioNode): void {
    this.outputGain.connect(destination)
  }

  /**
   * Load all field samples using shared cache
   */
  private async loadSamples(): Promise<void> {
    console.log('[FieldLayer] Loading samples via cache...')
    
    const loadPromises = FIELD_SAMPLES.map(async (filename) => {
      const buffer = await sampleCache.load(filename)
      if (buffer) {
        this.sampleBuffers.set(filename, buffer)
        this.loadedSamples.add(filename)
      }
    })

    await Promise.allSettled(loadPromises)
    console.log(`[FieldLayer] Loaded ${this.loadedSamples.size}/${FIELD_SAMPLES.length} samples`)

    // Start playing if we have samples
    if (this.loadedSamples.size > 0) {
      this.startPlayback()
    }
  }

  /**
   * Start the ambient playback loop
   */
  private startPlayback(): void {
    const sample = this.pickRandomSample()
    if (!sample) return

    // Player gain is for crossfade control (0-1), outputGain handles level
    this.currentPlayer = this.createPlayer(sample, 1.0)
    this.scheduleNextCrossfade()
  }

  /**
   * Pick a random sample (avoiding the currently playing one)
   */
  private pickRandomSample(): string | null {
    const available = Array.from(this.loadedSamples).filter(
      s => s !== this.currentPlayer?.sample
    )
    if (available.length === 0) {
      // If only one sample, allow repeating
      return Array.from(this.loadedSamples)[0] ?? null
    }
    return available[Math.floor(Math.random() * available.length)]
  }

  /**
   * Create a player for a sample
   * Note: initialGain is 0-1 where 1 = full volume through this player
   * The outputGain handles the overall layer level
   */
  private createPlayer(sampleName: string, initialGain: number): ActivePlayer | null {
    const buffer = this.sampleBuffers.get(sampleName)
    if (!buffer) return null

    const source = this.context.createBufferSource()
    source.buffer = buffer
    source.loop = true  // Loop the sample

    const gain = this.context.createGain()
    gain.gain.value = initialGain  // This is for crossfade (0 to 1), not level

    source.connect(gain)
    gain.connect(this.outputGain)
    source.start()

    return { source, gain, sample: sampleName }
  }

  /**
   * Schedule the next crossfade
   */
  private scheduleNextCrossfade(): void {
    const duration = this.minPlayDuration + 
      Math.random() * (this.maxPlayDuration - this.minPlayDuration)

    this.crossfadeTimeout = setTimeout(() => {
      this.crossfadeToNext()
    }, duration)
  }

  /**
   * Crossfade to a new sample
   */
  private crossfadeToNext(): void {
    const nextSample = this.pickRandomSample()
    if (!nextSample) return

    // Create new player at 0 gain
    this.nextPlayer = this.createPlayer(nextSample, 0)
    if (!this.nextPlayer) return

    const now = this.context.currentTime
    const fadeDuration = this.crossfadeDuration / 1000

    // Fade out current
    if (this.currentPlayer) {
      this.currentPlayer.gain.gain.setValueAtTime(
        this.currentPlayer.gain.gain.value, 
        now
      )
      this.currentPlayer.gain.gain.linearRampToValueAtTime(0, now + fadeDuration)

      // Schedule cleanup
      const oldPlayer = this.currentPlayer
      const cleanupTimeout = setTimeout(() => {
        this.cleanupTimeouts.delete(cleanupTimeout)
        try {
          oldPlayer.source.stop()
          oldPlayer.source.disconnect()
          oldPlayer.gain.disconnect()
        } catch (e) { /* ignore */ }
      }, this.crossfadeDuration + 500)
      this.cleanupTimeouts.add(cleanupTimeout)
    }

    // Fade in next (to 1.0, outputGain handles actual level)
    this.nextPlayer.gain.gain.setValueAtTime(0, now)
    this.nextPlayer.gain.gain.linearRampToValueAtTime(
      this.isMuted ? 0 : 1.0, 
      now + fadeDuration
    )

    // Swap players
    this.currentPlayer = this.nextPlayer
    this.nextPlayer = null

    // Schedule next crossfade
    this.scheduleNextCrossfade()
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  isPlaying(): boolean {
    return this.currentPlayer !== null
  }

  getCurrentSample(): string {
    return this.currentPlayer?.sample ?? '—'
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
      this.outputGain.gain.setTargetAtTime(gain, this.context.currentTime, 0.1)
    }
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted
    this.outputGain.gain.setTargetAtTime(
      muted ? 0 : this.baseGain,
      this.context.currentTime,
      0.1
    )
  }

  stop(): void {
    if (this.crossfadeTimeout) {
      clearTimeout(this.crossfadeTimeout)
      this.crossfadeTimeout = null
    }

    // Clear all cleanup timeouts
    for (const timeout of this.cleanupTimeouts) {
      clearTimeout(timeout)
    }
    this.cleanupTimeouts.clear()

    if (this.currentPlayer) {
      try {
        this.currentPlayer.source.stop()
        this.currentPlayer.source.disconnect()
        this.currentPlayer.gain.disconnect()
      } catch (e) { /* ignore */ }
      this.currentPlayer = null
    }

    if (this.nextPlayer) {
      try {
        this.nextPlayer.source.stop()
        this.nextPlayer.source.disconnect()
        this.nextPlayer.gain.disconnect()
      } catch (e) { /* ignore */ }
      this.nextPlayer = null
    }

    // Release cache references
    for (const filename of this.loadedSamples) {
      sampleCache.release(filename)
    }

    this.sampleBuffers.clear()
    this.loadedSamples.clear()
  }
}
