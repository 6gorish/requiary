/**
 * Sonification Service: Main orchestrator for Web Audio system
 * Manages all audio layers, routing, and integration with MessageLogicService
 * 
 * ROUTING ARCHITECTURE:
 * 
 *   Synthetic layers (cluster, figura, ground) → clusterCompressor → masterBus
 *   Sample layers (field, shimmer, texture) ───────────────────────→ masterBus
 *   Reverb return ─────────────────────────────────────────────────→ masterBus
 *   masterBus → masterGlue → masterGain → destination
 * 
 * The cluster compressor tames oscillator beating.
 * The master glue is very gentle - just for cohesion.
 * Sample-based layers bypass cluster compression (already mastered).
 */

import { DEFAULT_SONIFICATION_CONFIG } from '@/lib/config/sonification-config'
import { GroundLayer } from './ground-layer'
import { FieldLayer } from './field-layer'
import { ClusterChannel } from './cluster-channel'
import { ShimmerLayer } from './shimmer-layer'
import { FiguraLayer } from './figura-layer'
import { TextureLayer } from './texture-layer'
import { CantusLayer } from './cantus-layer'
import { sampleCache } from './sample-cache'
import { embeddingToPitch } from './pitch-utils'
import type { SonificationConfig, AudioState, MessageCluster } from './types'

export interface ChannelInfo {
  id: string
  name: string
  gain: number
  muted: boolean
  hasContent: boolean
  currentSample?: string
}

export class SonificationService {
  private config: SonificationConfig
  private context: AudioContext | null = null
  private state: AudioState = 'uninitialized'

  // Audio graph nodes
  private masterGain: GainNode | null = null
  private masterGlue: DynamicsCompressorNode | null = null  // Very gentle master compression
  private masterBus: GainNode | null = null                  // Sum bus before glue
  private clusterCompressor: DynamicsCompressorNode | null = null  // Tames oscillator beating
  
  // Reverb
  private convolver: ConvolverNode | null = null
  private reverbReturn: GainNode | null = null

  // Per-layer send gains
  private groundSend: GainNode | null = null
  private fieldSend: GainNode | null = null
  private clusterSend: GainNode | null = null
  private shimmerSend: GainNode | null = null
  private figuraSend: GainNode | null = null
  private textureSend: GainNode | null = null

  // Layers
  private groundLayer: GroundLayer | null = null
  private fieldLayer: FieldLayer | null = null
  private clusterChannel: ClusterChannel | null = null
  private shimmerLayer: ShimmerLayer | null = null
  private figuraLayer: FiguraLayer | null = null
  private textureLayer: TextureLayer | null = null
  private cantusLayer: CantusLayer | null = null

  // State
  private isMuted: boolean = false
  private volume: number = 1.0
  private currentTonicHz: number = 220
  private channelMutes: Map<string, boolean> = new Map()

  constructor(config: SonificationConfig = DEFAULT_SONIFICATION_CONFIG) {
    this.config = config
  }

  /**
   * iOS silent switch workaround: playing an HTML5 Audio element
   * switches the audio session from "ambient" (respects silent switch)
   * to "playback" (ignores silent switch, like YouTube/Spotify).
   * Must be called from a user gesture context.
   */
  private async unlockIOSAudio(): Promise<void> {
    // Tiny silent MP3 - just enough to trigger media playback mode
    const silentDataURI = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAAPAAAAAwAAAbAAqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV////////////////////////////////////////////AAAAAExhdmM1OC4xMwAAAAAAAAAAAAAAACQAAAAAAAAAAaC2Kn9XAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/+M4wAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV/+M4wDsAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV'

    try {
      const audio = new Audio(silentDataURI)
      audio.volume = 0.01  // Nearly silent, but not zero (some browsers ignore zero)
      // playsInline exists on HTMLMediaElement at runtime but not in TS types for Audio
      ;(audio as any).playsInline = true
      
      // Play and immediately pause - just need to trigger the audio session switch
      await audio.play()
      audio.pause()
      audio.remove()
      
      console.log('[SonificationService] iOS audio unlocked')
    } catch (error) {
      // Non-fatal - will just respect silent switch on iOS
      console.warn('[SonificationService] iOS audio unlock failed (non-fatal):', error)
    }
  }

  async initialize(): Promise<void> {
    if (this.state !== 'uninitialized') {
      console.warn('[SonificationService] Already initialized')
      return
    }

    try {
      // iOS silent switch override: play silent audio to switch to media playback mode
      await this.unlockIOSAudio()

      this.context = new AudioContext()
      this.state = 'suspended'

      // Initialize sample cache with AudioContext
      sampleCache.setContext(this.context)

      // === OUTPUT CHAIN ===
      // masterGain → destination
      this.masterGain = this.context.createGain()
      this.masterGain.gain.value = this.config.master.gain * this.volume
      this.masterGain.connect(this.context.destination)

      // masterGlue → masterGain (very gentle, just for cohesion)
      this.masterGlue = this.context.createDynamicsCompressor()
      this.masterGlue.threshold.value = -12    // High threshold - only catches peaks
      this.masterGlue.knee.value = 20          // Very soft knee
      this.masterGlue.ratio.value = 1.5        // Barely compressing
      this.masterGlue.attack.value = 0.1       // Slow attack - lets transients through
      this.masterGlue.release.value = 0.3      // Medium release
      this.masterGlue.connect(this.masterGain)

      // masterBus → masterGlue (sum point for all sources)
      this.masterBus = this.context.createGain()
      this.masterBus.gain.value = 1.0
      this.masterBus.connect(this.masterGlue)

      // === CLUSTER COMPRESSOR (for synthetic oscillators) ===
      this.clusterCompressor = this.context.createDynamicsCompressor()
      this.clusterCompressor.threshold.value = -18   // Catches oscillator beating
      this.clusterCompressor.knee.value = 12         // Soft knee
      this.clusterCompressor.ratio.value = 4         // More aggressive than master
      this.clusterCompressor.attack.value = 0.05     // Faster attack to catch swells
      this.clusterCompressor.release.value = 0.2     // Quick recovery
      this.clusterCompressor.connect(this.masterBus)

      // === REVERB SEND/RETURN ===
      await this.createReverbSendReturn()

      // === CREATE LAYERS ===
      this.groundLayer = new GroundLayer(this.context, this.config.ground)
      this.fieldLayer = new FieldLayer(this.context, this.config.field)
      this.clusterChannel = new ClusterChannel(this.context, this.config)
      this.shimmerLayer = new ShimmerLayer(this.context, this.config.shimmer)
      this.figuraLayer = new FiguraLayer(this.context, this.config.figura)
      this.textureLayer = new TextureLayer(this.context, this.config.texture)
      this.cantusLayer = new CantusLayer(this.context, this.config.cantus)

      // === CONNECT LAYERS ===
      
      // Synthetic layers → clusterCompressor (with reverb sends)
      this.connectSyntheticLayer(this.groundLayer, this.groundSend!, 0)        // Bass: no reverb
      this.connectSyntheticLayer(this.clusterChannel, this.clusterSend!, 0.3)  // Cluster: some reverb
      this.connectSyntheticLayer(this.figuraLayer, this.figuraSend!, 0.8)      // Figura: heavy reverb

      // Sample layers → masterBus directly (bypass cluster compressor)
      this.connectSampleLayer(this.fieldLayer, this.fieldSend!, 0)             // Field: no reverb (baked in)
      this.connectSampleLayer(this.shimmerLayer, this.shimmerSend!, 0.4)       // Shimmer: some reverb
      this.connectSampleLayer(this.textureLayer, this.textureSend!, 0)         // Texture: no reverb
      
      // Cantus has its own dedicated reverb, connects directly to masterBus
      this.cantusLayer.connect(this.masterBus!)

      // Link cluster channel to ground layer for bass reference
      this.clusterChannel.setBassFrequencyGetter(() => {
        return this.groundLayer?.getCurrentBassFrequency() ?? 55
      })

      await this.context.resume()
      this.state = 'running'

      // Log sample cache usage
      sampleCache.logUsage()

      console.log('[SonificationService] Initialized with dual-compressor architecture')
    } catch (error) {
      console.error('[SonificationService] Initialization failed:', error)
      this.state = 'uninitialized'
      throw error
    }
  }

  private async createReverbSendReturn(): Promise<void> {
    if (!this.context) throw new Error('AudioContext not initialized')

    this.convolver = this.context.createConvolver()

    try {
      const response = await fetch(this.config.reverb.irPath)
      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await this.context.decodeAudioData(arrayBuffer)
      this.convolver.buffer = audioBuffer
    } catch (error) {
      console.warn('[SonificationService] Failed to load reverb IR:', error)
    }

    // Reverb return → masterBus (bypasses cluster compressor)
    this.reverbReturn = this.context.createGain()
    this.reverbReturn.gain.value = this.config.reverb.wet
    this.convolver.connect(this.reverbReturn)
    this.reverbReturn.connect(this.masterBus!)

    // Create per-layer send gains
    this.groundSend = this.context.createGain()
    this.fieldSend = this.context.createGain()
    this.clusterSend = this.context.createGain()
    this.shimmerSend = this.context.createGain()
    this.figuraSend = this.context.createGain()
    this.textureSend = this.context.createGain()

    // Connect all sends to convolver
    this.groundSend.connect(this.convolver)
    this.fieldSend.connect(this.convolver)
    this.clusterSend.connect(this.convolver)
    this.shimmerSend.connect(this.convolver)
    this.figuraSend.connect(this.convolver)
    this.textureSend.connect(this.convolver)
  }

  /**
   * Connect synthetic layer → clusterCompressor + reverb send
   */
  private connectSyntheticLayer(
    layer: { connect: (node: AudioNode) => void },
    sendGain: GainNode,
    sendLevel: number
  ): void {
    layer.connect(this.clusterCompressor!)
    sendGain.gain.value = sendLevel
    layer.connect(sendGain)
  }

  /**
   * Connect sample layer → masterBus directly (bypasses cluster compressor)
   */
  private connectSampleLayer(
    layer: { connect: (node: AudioNode) => void },
    sendGain: GainNode,
    sendLevel: number
  ): void {
    layer.connect(this.masterBus!)
    sendGain.gain.value = sendLevel
    layer.connect(sendGain)
  }

  // === EVENT HANDLERS ===

  onClusterChange(cluster: MessageCluster): void {
    if (this.state !== 'running' || !this.clusterChannel) return

    const bassHz = this.groundLayer?.getCurrentBassFrequency() ?? 55
    const embedding = cluster.focus.semantic_data?.embedding
    const { hz: tonicHz } = embeddingToPitch(
      embedding,
      this.config.pitch.pentatonic,
      bassHz,
      this.config.pitch.baseOctave
    )
    this.currentTonicHz = tonicHz

    this.clusterChannel.onClusterChange(cluster)
    this.figuraLayer?.onClusterChange(tonicHz)
  }

  onFocusFade(): void {
    if (this.state !== 'running' || !this.figuraLayer) return
    this.figuraLayer.onFocusFade(this.currentTonicHz)
  }

  addConnectionResonance(fromId: string, toId: string, similarity: number): void {
    if (this.state !== 'running' || !this.clusterChannel) return
    this.clusterChannel.addConnectionResonance(fromId, toId, similarity)

    if (this.figuraLayer && similarity > 0.6) {
      this.figuraLayer.onConnection(similarity, this.currentTonicHz)
    }
  }

  triggerShimmer(probability?: number): void {
    if (this.state !== 'running' || !this.shimmerLayer) return
    this.shimmerLayer.triggerShimmer(probability)
  }

  // === VOLUME/MUTE ===

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume))
    if (this.masterGain && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(
        this.config.master.gain * this.volume,
        this.context!.currentTime,
        0.05
      )
    }
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted
    if (this.context) {
      if (muted) {
        this.context.suspend()
      } else {
        this.context.resume()
      }
    }
  }

  // === PARAMETER CONTROL ===

  setClusterParams(params: {
    detuneCents?: number
    fadeInDuration?: number
    fadeOutDuration?: number
    filterCutoff?: number
  }): void {
    if (this.state !== 'running' || !this.clusterChannel) return
    this.clusterChannel.setParams(params)
  }

  getClusterParams() {
    return {
      detuneCents: this.config.cluster.baseDetuneCents,
      fadeInDuration: this.config.cluster.fadeInDuration,
      fadeOutDuration: this.config.cluster.fadeOutDuration,
      filterCutoff: 800
    }
  }

  setBassSpeed(multiplier: number): void {
    if (this.state !== 'running' || !this.groundLayer) return
    this.groundLayer.setSpeedMultiplier(multiplier)
  }

  getBassSpeed(): number {
    return this.groundLayer?.getSpeedMultiplier() ?? 1.0
  }

  // === CANTUS CONTROL ===

  setCantusInterval(minMinutes: number, maxMinutes: number): void {
    this.cantusLayer?.setPhraseInterval(minMinutes, maxMinutes)
  }

  getCantusIntervalMin(): number {
    return this.cantusLayer?.getPhraseIntervalMin() ?? 5
  }

  triggerCantusPhrase(): void {
    this.cantusLayer?.triggerPhrase()
  }

  getState(): AudioState { return this.state }
  getVolume(): number { return this.volume }
  isMutedState(): boolean { return this.isMuted }

  // === DEBUG MIXER API ===

  getChannels(): ChannelInfo[] {
    if (this.state !== 'running') return []

    const channels: ChannelInfo[] = []

    if (this.groundLayer) {
      channels.push({
        id: 'ground',
        name: 'Bass Drone',
        gain: this.groundLayer.getGain(),
        muted: this.channelMutes.get('ground') ?? false,
        hasContent: true
      })
    }

    if (this.clusterChannel) {
      channels.push({
        id: 'cluster-ensemble',
        name: 'Cluster',
        gain: this.clusterChannel.getEnsembleGain(),
        muted: this.channelMutes.get('cluster-ensemble') ?? false,
        hasContent: true
      })

      channels.push({
        id: 'cluster-pivot',
        name: 'Pivot',
        gain: this.clusterChannel.getPivotGain(),
        muted: this.channelMutes.get('cluster-pivot') ?? false,
        hasContent: this.clusterChannel.hasPivotActive()
      })

      channels.push({
        id: 'cluster-resonances',
        name: 'Resonances',
        gain: this.clusterChannel.getResonancesGain(),
        muted: this.channelMutes.get('cluster-resonances') ?? false,
        hasContent: this.clusterChannel.getActiveResonanceCount() > 0
      })
    }

    if (this.figuraLayer) {
      channels.push({
        id: 'figura',
        name: 'Sighs',
        gain: this.figuraLayer.getGain(),
        muted: this.channelMutes.get('figura') ?? false,
        hasContent: this.figuraLayer.getActiveFiguraCount() > 0
      })
    }

    if (this.cantusLayer) {
      channels.push({
        id: 'cantus',
        name: 'Cantus',
        gain: this.cantusLayer.getGain(),
        muted: this.channelMutes.get('cantus') ?? false,
        hasContent: this.cantusLayer.isPlaying()
      })
    }

    channels.push({
      id: 'reverb-return',
      name: 'Reverb',
      gain: this.reverbReturn?.gain.value ?? 0,
      muted: this.channelMutes.get('reverb-return') ?? false,
      hasContent: true
    })

    if (this.fieldLayer) {
      channels.push({
        id: 'field',
        name: 'Field',
        gain: this.fieldLayer.getGain(),
        muted: this.channelMutes.get('field') ?? false,
        hasContent: this.fieldLayer.isPlaying(),
        currentSample: this.fieldLayer.getCurrentSample()
      })
    }

    if (this.textureLayer) {
      channels.push({
        id: 'texture',
        name: 'Texture',
        gain: this.textureLayer.getGain(),
        muted: this.channelMutes.get('texture') ?? false,
        hasContent: this.textureLayer.isPlaying(),
        currentSample: this.textureLayer.getCurrentSample()
      })
    }

    if (this.shimmerLayer) {
      channels.push({
        id: 'shimmer',
        name: 'Shimmer',
        gain: this.shimmerLayer.getGain(),
        muted: this.channelMutes.get('shimmer') ?? false,
        hasContent: this.shimmerLayer.isPlaying(),
        currentSample: this.shimmerLayer.getCurrentSample()
      })
    }

    return channels
  }

  setChannelGain(channelId: string, gain: number): void {
    if (this.state !== 'running') return
    const clampedGain = Math.max(0, Math.min(2, gain))

    switch (channelId) {
      case 'ground':
        this.groundLayer?.setGain(clampedGain)
        break
      case 'cluster-ensemble':
        this.clusterChannel?.setEnsembleGain(clampedGain)
        break
      case 'cluster-pivot':
        this.clusterChannel?.setPivotGain(clampedGain)
        break
      case 'cluster-resonances':
        this.clusterChannel?.setResonancesGain(clampedGain)
        break
      case 'figura':
        this.figuraLayer?.setGain(clampedGain)
        break
      case 'cantus':
        this.cantusLayer?.setGain(clampedGain)
        break
      case 'reverb-return':
        this.reverbReturn?.gain.setTargetAtTime(clampedGain, this.context!.currentTime, 0.05)
        break
      case 'field':
        this.fieldLayer?.setGain(clampedGain)
        break
      case 'texture':
        this.textureLayer?.setGain(clampedGain)
        break
      case 'shimmer':
        this.shimmerLayer?.setGain(clampedGain)
        break
    }
  }

  setChannelMuted(channelId: string, muted: boolean): void {
    if (this.state !== 'running') return
    this.channelMutes.set(channelId, muted)

    switch (channelId) {
      case 'ground':
        this.groundLayer?.setMuted(muted)
        break
      case 'cluster-ensemble':
        this.clusterChannel?.setEnsembleMuted(muted)
        break
      case 'cluster-pivot':
        this.clusterChannel?.setPivotMuted(muted)
        break
      case 'cluster-resonances':
        this.clusterChannel?.setResonancesMuted(muted)
        break
      case 'figura':
        this.figuraLayer?.setMuted(muted)
        break
      case 'cantus':
        this.cantusLayer?.setMuted(muted)
        break
      case 'reverb-return':
        this.reverbReturn?.gain.setTargetAtTime(
          muted ? 0 : this.config.reverb.wet,
          this.context!.currentTime,
          0.05
        )
        break
      case 'field':
        this.fieldLayer?.setMuted(muted)
        break
      case 'texture':
        this.textureLayer?.setMuted(muted)
        break
      case 'shimmer':
        this.shimmerLayer?.setMuted(muted)
        break
    }
  }

  getDiagnostics(): {
    contextState: string
    sampleRate: number
    currentTime: number
    activeResonances: number
    activeFiguras: number
    currentBassHz: number
    currentBassNote: string
    currentFiguras: string[]
    clusterGR: number
    masterGR: number
    fieldSample: string
    textureSample: string
    shimmerSample: string
    cantusDegree: string
    cantusActive: boolean
  } | null {
    if (!this.context || this.state !== 'running') return null

    return {
      contextState: this.context.state,
      sampleRate: this.context.sampleRate,
      currentTime: Math.round(this.context.currentTime * 10) / 10,
      activeResonances: this.clusterChannel?.getActiveResonanceCount() ?? 0,
      activeFiguras: this.figuraLayer?.getActiveFiguraCount() ?? 0,
      currentBassHz: Math.round((this.groundLayer?.getCurrentBassFrequency() ?? 0) * 10) / 10,
      currentBassNote: this.groundLayer?.getCurrentBassNoteName() ?? '?',
      currentFiguras: this.figuraLayer?.getActiveFiguraNames() ?? [],
      clusterGR: Math.round(this.clusterCompressor?.reduction ?? 0),
      masterGR: Math.round(this.masterGlue?.reduction ?? 0),
      fieldSample: this.fieldLayer?.getCurrentSample() ?? '—',
      textureSample: this.textureLayer?.getCurrentSample() ?? '—',
      shimmerSample: this.shimmerLayer?.getCurrentSample() ?? '—',
      cantusDegree: this.cantusLayer?.getCurrentDegree() ?? '—',
      cantusActive: this.cantusLayer?.isPhraseActive() ?? false
    }
  }

  stop(): void {
    if (this.state === 'uninitialized') return

    this.groundLayer?.stop()
    this.fieldLayer?.stop()
    this.clusterChannel?.stop()
    this.shimmerLayer?.stop()
    this.figuraLayer?.stop()
    this.textureLayer?.stop()
    this.cantusLayer?.stop()

    try {
      this.groundSend?.disconnect()
      this.fieldSend?.disconnect()
      this.clusterSend?.disconnect()
      this.shimmerSend?.disconnect()
      this.figuraSend?.disconnect()
      this.textureSend?.disconnect()
      this.reverbReturn?.disconnect()
      this.convolver?.disconnect()
      this.clusterCompressor?.disconnect()
      this.masterBus?.disconnect()
      this.masterGlue?.disconnect()
      this.masterGain?.disconnect()
    } catch (e) { /* ignore */ }

    this.context?.close()
    
    // Clear sample cache
    sampleCache.clear()
    
    this.groundLayer = null
    this.fieldLayer = null
    this.clusterChannel = null
    this.shimmerLayer = null
    this.figuraLayer = null
    this.textureLayer = null
    this.cantusLayer = null
    this.groundSend = null
    this.fieldSend = null
    this.clusterSend = null
    this.shimmerSend = null
    this.figuraSend = null
    this.textureSend = null
    this.reverbReturn = null
    this.convolver = null
    this.clusterCompressor = null
    this.masterBus = null
    this.masterGlue = null
    this.masterGain = null
    this.context = null
    
    this.state = 'closed'
    console.log('[SonificationService] Stopped')
  }
}
