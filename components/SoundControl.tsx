'use client'

/**
 * SoundControl
 * Minimalist volume and mute controls for sonification system
 * Handles user-gesture-based audio initialization for browser autoplay policy
 */

import { useState, useEffect, useCallback } from 'react'
import type { SonificationService } from '@/lib/audio/sonification-service'

interface SoundControlProps {
  sonificationService: SonificationService | null
}

export default function SoundControl({ sonificationService }: SoundControlProps) {
  const [volume, setVolume] = useState(1.0)
  const [isMuted, setIsMuted] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)

  // Check if already initialized
  useEffect(() => {
    if (!sonificationService) return
    const state = sonificationService.getState()
    if (state === 'running') {
      setIsInitialized(true)
      setVolume(sonificationService.getVolume())
      setIsMuted(sonificationService.isMutedState())
    }
  }, [sonificationService])

  // Initialize audio on user click (required by browser autoplay policy)
  const handleEnableSound = useCallback(async () => {
    if (!sonificationService || isInitializing || isInitialized) return
    
    setIsInitializing(true)
    try {
      await sonificationService.initialize()
      setIsInitialized(true)
      setVolume(sonificationService.getVolume())
      setIsMuted(sonificationService.isMutedState())
      console.log('[SoundControl] Audio initialized via user gesture')
    } catch (err) {
      console.error('[SoundControl] Failed to initialize audio:', err)
    } finally {
      setIsInitializing(false)
    }
  }, [sonificationService, isInitializing, isInitialized])

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    sonificationService?.setVolume(newVolume)
  }

  const handleMuteToggle = () => {
    const newMuted = !isMuted
    setIsMuted(newMuted)
    sonificationService?.setMuted(newMuted)
  }

  // Show "enable sound" button if not initialized
  if (!isInitialized) {
    return (
      <button
        onClick={handleEnableSound}
        disabled={isInitializing || !sonificationService}
        className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 flex items-center gap-2 bg-black/50 backdrop-blur-sm px-3 py-2 md:px-4 md:py-3 rounded-lg border border-white/20 hover:border-white/40 hover:bg-black/60 transition-all text-white/70 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
        title="Enable sound"
      >
        {isInitializing ? (
          <span className="text-xs md:text-sm">Loading...</span>
        ) : (
          <>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
            <span className="text-xs md:text-sm">Tap for sound</span>
          </>
        )}
      </button>
    )
  }

  // Show full controls once initialized
  return (
    <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 flex items-center gap-2 md:gap-3 bg-black/50 backdrop-blur-sm px-3 py-2 md:px-4 md:py-3 rounded-lg border border-white/10">
      {/* Mute toggle */}
      <button
        onClick={handleMuteToggle}
        className="text-white/70 hover:text-white transition-colors"
        aria-label={isMuted ? 'Unmute' : 'Mute'}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? (
          // Muted icon
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        ) : (
          // Unmuted icon
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        )}
      </button>

      {/* Volume slider */}
      <div className="flex items-center gap-2">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={handleVolumeChange}
          disabled={isMuted}
          className="w-16 md:w-24 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none
                     [&::-webkit-slider-thumb]:w-3
                     [&::-webkit-slider-thumb]:h-3
                     [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-white
                     [&::-webkit-slider-thumb]:cursor-pointer
                     [&::-moz-range-thumb]:w-3
                     [&::-moz-range-thumb]:h-3
                     [&::-moz-range-thumb]:rounded-full
                     [&::-moz-range-thumb]:bg-white
                     [&::-moz-range-thumb]:border-0
                     [&::-moz-range-thumb]:cursor-pointer
                     disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Volume"
        />
        <span className="text-white/50 text-xs font-mono w-8 text-right">
          {Math.round(volume * 100)}%
        </span>
      </div>
    </div>
  )
}
