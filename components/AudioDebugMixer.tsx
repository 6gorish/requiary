'use client'

/**
 * AudioDebugMixer
 * Development tool for granular control over sonification channels
 * Only visible when ?debug=true
 * 
 * Includes:
 * - Channel faders (gain + mute)
 * - Parameter knobs for real-time tuning
 * - Diagnostics footer
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { SonificationService, ChannelInfo } from '@/lib/audio/sonification-service'

interface AudioDebugMixerProps {
  sonificationService: SonificationService | null
  visible: boolean
}

// ============================================================
// CHANNEL FADER COMPONENT
// ============================================================

interface ChannelFaderProps {
  channel: ChannelInfo
  onGainChange: (gain: number) => void
  onMuteToggle: () => void
  onSoloToggle: () => void
  isSoloed: boolean
  anySoloed: boolean  // True if ANY channel is soloed
}

function ChannelFader({ channel, onGainChange, onMuteToggle, onSoloToggle, isSoloed, anySoloed }: ChannelFaderProps) {
  const percentage = Math.round(channel.gain * 100)
  const isStub = channel.name.includes('stub')
  const trackRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  
  // Channel is effectively muted if: explicitly muted, OR another channel is soloed and this one isn't
  const isEffectivelyMuted = channel.muted || (anySoloed && !isSoloed)
  
  const yToGain = useCallback((clientY: number) => {
    if (!trackRef.current) return channel.gain
    const rect = trackRef.current.getBoundingClientRect()
    const relativeY = clientY - rect.top
    const normalizedY = 1 - (relativeY / rect.height)
    const clampedY = Math.max(0, Math.min(1, normalizedY))
    return clampedY * 2
  }, [channel.gain])
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isEffectivelyMuted || isStub) return
    isDragging.current = true
    onGainChange(yToGain(e.clientY))
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      onGainChange(yToGain(e.clientY))
    }
    
    const handleMouseUp = () => {
      isDragging.current = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [channel.muted, isStub, yToGain, onGainChange])
  
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isEffectivelyMuted || isStub) return
    isDragging.current = true
    onGainChange(yToGain(e.touches[0].clientY))
    
    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return
      e.preventDefault()
      onGainChange(yToGain(e.touches[0].clientY))
    }
    
    const handleTouchEnd = () => {
      isDragging.current = false
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
    
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd)
  }, [channel.muted, isStub, yToGain, onGainChange])
  
  const fillHeight = Math.min(100, percentage / 2)
  const thumbBottom = fillHeight
  
  // Visual state colors
  const getFillColor = () => {
    if (isEffectivelyMuted) return 'bg-red-500/50'
    if (isSoloed) return 'bg-yellow-500/60'
    if (isStub) return 'bg-white/20'
    return 'bg-purple-500/60'
  }
  
  const getThumbColor = () => {
    if (isEffectivelyMuted) return 'bg-red-400'
    if (isSoloed) return 'bg-yellow-400'
    if (isStub) return 'bg-white/30'
    return 'bg-purple-400'
  }
  
  return (
    <div className="flex flex-col items-center gap-1" style={{ width: '54px' }}>
      <div 
        className={`text-[9px] text-center leading-tight h-8 flex items-center justify-center px-1 ${
          isStub ? 'text-white/30' : 'text-white/70'
        }`}
      >
        {channel.name.replace(' (stub)', '')}
      </div>
      
      <div className="relative flex flex-col items-center">
        <div className={`text-[10px] font-mono mb-1 ${isStub ? 'text-white/30' : 'text-white/60'}`}>
          {percentage}%
        </div>
        
        <div 
          ref={trackRef}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className={`relative w-6 h-20 bg-black/40 rounded border border-white/20 ${
            isStub || isEffectivelyMuted ? 'cursor-not-allowed' : 'cursor-ns-resize'
          }`}
          style={{ touchAction: 'none' }}
        >
          <div 
            className={`absolute bottom-0 left-0 right-0 rounded-b pointer-events-none ${getFillColor()}`}
            style={{ height: `${fillHeight}%` }}
          />
          
          <div 
            className={`absolute left-0.5 right-0.5 h-2 rounded pointer-events-none ${getThumbColor()}`}
            style={{ 
              bottom: `${thumbBottom}%`,
              transform: 'translateY(50%)',
              boxShadow: isEffectivelyMuted || isStub ? 'none' : isSoloed ? '0 0 6px rgba(234, 179, 8, 0.5)' : '0 0 6px rgba(168, 85, 247, 0.5)'
            }}
          />
        </div>
      </div>
      
      <button
        onClick={onMuteToggle}
        disabled={isStub}
        className={`w-6 h-5 rounded text-[9px] font-bold transition-colors ${
          isStub
            ? 'bg-white/10 text-white/20 cursor-not-allowed'
            : channel.muted 
              ? 'bg-red-500 text-white' 
              : 'bg-white/20 text-white/50 hover:bg-white/30'
        }`}
      >
        M
      </button>
      
      <button
        onClick={onSoloToggle}
        disabled={isStub}
        className={`w-6 h-5 rounded text-[9px] font-bold transition-colors ${
          isStub
            ? 'bg-white/10 text-white/20 cursor-not-allowed'
            : isSoloed 
              ? 'bg-yellow-500 text-black' 
              : 'bg-white/20 text-white/50 hover:bg-white/30'
        }`}
      >
        S
      </button>
      
      <div 
        className={`w-1.5 h-1.5 rounded-full ${
          isStub
            ? 'bg-white/10'
            : channel.hasContent 
              ? (channel.muted ? 'bg-red-400' : 'bg-green-400') 
              : 'bg-yellow-400/50'
        }`}
      />
    </div>
  )
}

// ============================================================
// PARAMETER KNOB COMPONENT
// ============================================================

interface ParameterKnobProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (value: number) => void
}

function ParameterKnob({ label, value, min, max, step = 1, unit = '', onChange }: ParameterKnobProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const startY = useRef(0)
  const startValue = useRef(value)
  
  // Normalize value to 0-1 for display
  const normalized = (value - min) / (max - min)
  const rotation = -135 + (normalized * 270) // -135° to +135°
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    startY.current = e.clientY
    startValue.current = value
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const deltaY = startY.current - e.clientY
      const sensitivity = (max - min) / 100 // 100px drag = full range
      const newValue = Math.max(min, Math.min(max, startValue.current + deltaY * sensitivity))
      // Round to step
      const stepped = Math.round(newValue / step) * step
      onChange(stepped)
    }
    
    const handleMouseUp = () => {
      isDragging.current = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [value, min, max, step, onChange])
  
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-[9px] text-white/60 text-center leading-tight h-6 flex items-center">
        {label}
      </div>
      
      {/* Knob */}
      <div 
        ref={trackRef}
        onMouseDown={handleMouseDown}
        className="relative w-10 h-10 cursor-ns-resize"
        style={{ touchAction: 'none' }}
      >
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full border-2 border-white/20 bg-black/40" />
        
        {/* Value arc - SVG */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 40 40">
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="none"
            stroke="rgba(168, 85, 247, 0.4)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${normalized * 75.4} 100`}
            transform="rotate(-135 20 20)"
          />
        </svg>
        
        {/* Indicator line */}
        <div 
          className="absolute top-1/2 left-1/2 w-0.5 h-4 bg-purple-400 origin-bottom rounded"
          style={{ 
            transform: `translate(-50%, -100%) rotate(${rotation}deg)`,
            boxShadow: '0 0 4px rgba(168, 85, 247, 0.6)'
          }}
        />
        
        {/* Center dot */}
        <div className="absolute top-1/2 left-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/30" />
      </div>
      
      {/* Value display */}
      <div className="text-[10px] font-mono text-white/70">
        {step < 1 ? value.toFixed(1) : Math.round(value)}{unit}
      </div>
    </div>
  )
}

// ============================================================
// MAIN MIXER COMPONENT
// ============================================================

export default function AudioDebugMixer({ sonificationService, visible }: AudioDebugMixerProps) {
  const [channels, setChannels] = useState<ChannelInfo[]>([])
  const [diagnostics, setDiagnostics] = useState<{
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
  } | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showParams, setShowParams] = useState(true)
  const [soloedChannels, setSoloedChannels] = useState<Set<string>>(new Set())
  
  // Parameter state (with defaults from config)
  const [params, setParams] = useState({
    detuneCents: 5,       // cents - controls beating rate
    attackTime: 8,        // seconds - slow subliminal entrance
    releaseTime: 6,       // seconds
    filterCutoff: 800,    // Hz
  })
  
  // Bass speed multiplier (1 = normal, 10 = 10x faster for testing)
  const [bassSpeed, setBassSpeed] = useState(1)
  
  // Cantus interval (in minutes)
  const [cantusInterval, setCantusInterval] = useState(5)
  
  // Load initial params from service when available
  useEffect(() => {
    if (!sonificationService || sonificationService.getState() !== 'running') return
    const currentParams = sonificationService.getClusterParams?.()
    if (currentParams) {
      setParams({
        detuneCents: currentParams.detuneCents,
        attackTime: currentParams.fadeInDuration / 1000,
        releaseTime: currentParams.fadeOutDuration / 1000,
        filterCutoff: currentParams.filterCutoff,
      })
    }
    // Load bass speed
    const currentBassSpeed = sonificationService.getBassSpeed?.()
    if (currentBassSpeed) {
      setBassSpeed(currentBassSpeed)
    }
    // Load cantus interval
    const currentCantusInterval = sonificationService.getCantusIntervalMin?.()
    if (currentCantusInterval) {
      setCantusInterval(currentCantusInterval)
    }
  }, [sonificationService, sonificationService?.getState()])

  // Poll for channel updates
  useEffect(() => {
    if (!visible || !sonificationService) return

    const updateState = () => {
      setChannels(sonificationService.getChannels())
      setDiagnostics(sonificationService.getDiagnostics())
    }

    updateState()
    const interval = setInterval(updateState, 100)
    return () => clearInterval(interval)
  }, [visible, sonificationService])

  // Apply parameter changes to the service
  useEffect(() => {
    if (!sonificationService) return
    sonificationService.setClusterParams?.({
      detuneCents: params.detuneCents,
      fadeInDuration: params.attackTime * 1000,
      fadeOutDuration: params.releaseTime * 1000,
      filterCutoff: params.filterCutoff,
    })
  }, [sonificationService, params])

  // Apply bass speed changes
  useEffect(() => {
    if (!sonificationService) return
    sonificationService.setBassSpeed?.(bassSpeed)
  }, [sonificationService, bassSpeed])

  // Apply cantus interval changes
  useEffect(() => {
    if (!sonificationService) return
    // Min interval from knob, max is 3x min (e.g., 5-15, 2-6, 0.5-1.5)
    const maxInterval = Math.max(cantusInterval * 3, cantusInterval + 2)
    sonificationService.setCantusInterval?.(cantusInterval, maxInterval)
  }, [sonificationService, cantusInterval])

  const handleGainChange = useCallback((channelId: string, gain: number) => {
    sonificationService?.setChannelGain(channelId, gain)
  }, [sonificationService])

  const handleMuteToggle = useCallback((channelId: string) => {
    const channel = channels.find(c => c.id === channelId)
    if (channel) {
      sonificationService?.setChannelMuted(channelId, !channel.muted)
    }
  }, [sonificationService, channels])

  const handleSoloToggle = useCallback((channelId: string) => {
    setSoloedChannels(prev => {
      const newSet = new Set(prev)
      if (newSet.has(channelId)) {
        newSet.delete(channelId)
      } else {
        newSet.add(channelId)
      }
      
      // Apply solo mutes immediately
      if (!sonificationService) return newSet
      
      const willHaveSolos = newSet.size > 0
      
      for (const channel of channels) {
        if (channel.name.includes('stub')) continue
        
        if (willHaveSolos) {
          // Mute channels not in the solo set
          sonificationService.setChannelMuted(channel.id, !newSet.has(channel.id))
        } else {
          // No solos - unmute all (they can manually mute again if needed)
          sonificationService.setChannelMuted(channel.id, false)
        }
      }
      
      return newSet
    })
  }, [sonificationService, channels])

  const handleParamChange = useCallback((param: keyof typeof params, value: number) => {
    setParams(prev => ({ ...prev, [param]: value }))
  }, [])

  const handleBassSpeedChange = useCallback((value: number) => {
    setBassSpeed(value)
  }, [])

  const handleCantusIntervalChange = useCallback((value: number) => {
    setCantusInterval(value)
  }, [])

  const handleTriggerCantus = useCallback(() => {
    sonificationService?.triggerCantusPhrase?.()
  }, [sonificationService])

  if (!visible || !sonificationService || sonificationService.getState() !== 'running') {
    return null
  }

  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="fixed top-16 left-4 z-50 bg-black/80 backdrop-blur-sm px-3 py-2 rounded-lg border border-purple-500/30 text-white/70 hover:text-white text-sm"
      >
        🎚️ Mixer
      </button>
    )
  }

  // Separate active channels from sample layers
  const activeChannels = channels.filter(c => !c.name.includes('stub') && c.id !== 'field' && c.id !== 'shimmer' && c.id !== 'texture')
  const sampleChannels = channels.filter(c => c.id === 'field' || c.id === 'shimmer' || c.id === 'texture')
  const stubChannels = channels.filter(c => c.name.includes('stub'))
  
  const anySoloed = soloedChannels.size > 0

  return (
    <div className="fixed top-16 left-4 z-50 bg-black/90 backdrop-blur-sm rounded-lg border border-purple-500/30 p-3 select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-purple-400 font-bold text-xs">🎚️ MIXER</span>
          {diagnostics && (
            <span className="text-green-400/80 text-[9px] font-mono px-1.5 py-0.5 bg-green-400/10 rounded">
              {diagnostics.contextState}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowParams(!showParams)}
            className={`text-[9px] px-2 py-1 rounded transition-colors ${
              showParams ? 'bg-purple-500/30 text-purple-300' : 'bg-white/10 text-white/50'
            }`}
          >
            PARAMS
          </button>
          <button
            onClick={() => setIsCollapsed(true)}
            className="text-white/40 hover:text-white text-sm px-1"
          >
            ×
          </button>
        </div>
      </div>

      {/* Channel faders */}
      <div className="flex gap-1">
        {activeChannels.map(channel => (
          <ChannelFader
            key={channel.id}
            channel={channel}
            onGainChange={(gain) => handleGainChange(channel.id, gain)}
            onMuteToggle={() => handleMuteToggle(channel.id)}
            onSoloToggle={() => handleSoloToggle(channel.id)}
            isSoloed={soloedChannels.has(channel.id)}
            anySoloed={anySoloed}
          />
        ))}
        
        {sampleChannels.length > 0 && (
          <div className="w-px bg-white/10 mx-1" />
        )}
        
        {sampleChannels.map(channel => (
          <ChannelFader
            key={channel.id}
            channel={channel}
            onGainChange={(gain) => handleGainChange(channel.id, gain)}
            onMuteToggle={() => handleMuteToggle(channel.id)}
            onSoloToggle={() => handleSoloToggle(channel.id)}
            isSoloed={soloedChannels.has(channel.id)}
            anySoloed={anySoloed}
          />
        ))}
        
        {stubChannels.length > 0 && (
          <div className="w-px bg-white/10 mx-1" />
        )}
        
        {stubChannels.map(channel => (
          <ChannelFader
            key={channel.id}
            channel={channel}
            onGainChange={(gain) => handleGainChange(channel.id, gain)}
            onMuteToggle={() => handleMuteToggle(channel.id)}
            onSoloToggle={() => handleSoloToggle(channel.id)}
            isSoloed={soloedChannels.has(channel.id)}
            anySoloed={anySoloed}
          />
        ))}
      </div>

      {/* Parameter knobs */}
      {showParams && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="text-[9px] text-white/40 mb-2 uppercase tracking-wider">Cluster Parameters</div>
          <div className="flex gap-3 justify-center">
            <ParameterKnob
              label="Detune"
              value={params.detuneCents}
              min={1}
              max={20}
              step={0.5}
              unit="¢"
              onChange={(v) => handleParamChange('detuneCents', v)}
            />
            <ParameterKnob
              label="Attack"
              value={params.attackTime}
              min={1}
              max={15}
              step={0.5}
              unit="s"
              onChange={(v) => handleParamChange('attackTime', v)}
            />
            <ParameterKnob
              label="Release"
              value={params.releaseTime}
              min={1}
              max={15}
              step={0.5}
              unit="s"
              onChange={(v) => handleParamChange('releaseTime', v)}
            />
            <ParameterKnob
              label="Filter"
              value={params.filterCutoff}
              min={200}
              max={2000}
              step={50}
              unit="Hz"
              onChange={(v) => handleParamChange('filterCutoff', v)}
            />
          </div>
          
          {/* Bass parameters */}
          <div className="text-[9px] text-white/40 mt-3 mb-2 uppercase tracking-wider">Ground Parameters</div>
          <div className="flex gap-3 justify-center">
            <ParameterKnob
              label="Bass Speed"
              value={bassSpeed}
              min={1}
              max={20}
              step={1}
              unit="×"
              onChange={handleBassSpeedChange}
            />
          </div>
          <div className="text-[8px] text-white/30 text-center mt-1">
            {bassSpeed === 1 ? '2-5 min' : `${Math.round(120/bassSpeed)}-${Math.round(300/bassSpeed)}s`}
          </div>
          
          {/* Cantus parameters */}
          <div className="text-[9px] text-white/40 mt-3 mb-2 uppercase tracking-wider">Cantus Parameters</div>
          <div className="flex gap-3 items-end justify-center">
            <ParameterKnob
              label="Interval"
              value={cantusInterval}
              min={0.25}
              max={15}
              step={0.25}
              unit="m"
              onChange={handleCantusIntervalChange}
            />
            <button
              onClick={handleTriggerCantus}
              disabled={diagnostics?.cantusActive}
              className={`mb-1 px-3 py-1.5 rounded text-[9px] font-bold transition-colors ${
                diagnostics?.cantusActive
                  ? 'bg-green-500/50 text-white cursor-not-allowed'
                  : 'bg-purple-500/30 text-purple-300 hover:bg-purple-500/50'
              }`}
            >
              {diagnostics?.cantusActive ? 'PLAYING' : 'TRIGGER'}
            </button>
          </div>
          <div className="text-[8px] text-white/30 text-center mt-1">
            {cantusInterval < 1 
              ? `${Math.round(cantusInterval * 60)}s - ${Math.round(cantusInterval * 180)}s`
              : `${cantusInterval}m - ${Math.round(cantusInterval * 3)}m`
            }
          </div>
        </div>
      )}

      {/* Diagnostics footer */}
      {diagnostics && (
        <div className="mt-3 pt-2 border-t border-white/10 text-[9px] font-mono text-white/40">
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            <span>Bass: <span className="text-purple-300">{diagnostics.currentBassNote}</span></span>
            <span>Res: <span className="text-purple-300">{diagnostics.activeResonances}</span></span>
            <span>Sighs: <span className="text-purple-300">{diagnostics.activeFiguras}</span>
              {diagnostics.currentFiguras.length > 0 && (
                <span className="text-white/30"> ({diagnostics.currentFiguras.join(', ')})</span>
              )}
            </span>
            <span>ClusterGR: <span className={diagnostics.clusterGR < -3 ? 'text-yellow-400' : 'text-purple-300'}>
              {diagnostics.clusterGR}dB
            </span></span>
            <span>MasterGR: <span className={diagnostics.masterGR < -2 ? 'text-yellow-400' : 'text-green-300'}>
              {diagnostics.masterGR}dB
            </span></span>
            <span>t: <span className="text-white/30">{diagnostics.currentTime}s</span></span>
          </div>
          {/* Sample info row */}
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
            <span>Field: <span className="text-cyan-300">{diagnostics.fieldSample}</span></span>
            <span>Texture: <span className="text-orange-300">{diagnostics.textureSample}</span></span>
            <span>Shimmer: <span className="text-cyan-300">{diagnostics.shimmerSample}</span></span>
            <span>Cantus: <span className={diagnostics.cantusActive ? 'text-green-400' : 'text-white/30'}>
              {diagnostics.cantusDegree}
            </span></span>
          </div>
        </div>
      )}
    </div>
  )
}
