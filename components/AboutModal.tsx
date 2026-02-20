'use client'

import { useEffect, useCallback } from 'react'

interface AboutModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AboutModal({ isOpen, onClose }: AboutModalProps) {
  // Close on escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        style={{
          animation: 'fadeIn 0.3s ease-out',
        }}
      />
      
      {/* Modal content */}
      <div 
        className="relative z-10 w-full max-w-2xl max-h-[85vh] mx-4 overflow-y-auto modal-scrollbar"
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: 'slideUp 0.3s ease-out',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 md:top-6 md:right-6 z-20 w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full border border-white/30 hover:border-white/50 hover:bg-white/10 transition-all"
          style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}
          aria-label="Close"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/80">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* Content container */}
        <div 
          className="px-6 py-8 md:px-10 md:py-12"
          style={{
            background: 'linear-gradient(to bottom, rgba(20, 18, 22, 0.98), rgba(15, 13, 17, 0.98))',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '4px',
          }}
        >
          {/* Title */}
          <h2 
            className="text-2xl md:text-3xl font-light tracking-wide mb-8"
            style={{ 
              fontFamily: 'var(--font-logo)',
              color: 'rgba(250, 247, 242, 0.95)',
              textShadow: '0 2px 10px rgba(0,0,0,0.5)',
            }}
          >
            About Requiary
          </h2>

          {/* Epigraph */}
          <div className="mb-8 pb-8 border-b border-white/10">
            <p 
              className="text-base md:text-lg italic"
              style={{ color: 'rgba(200, 195, 210, 0.9)' }}
            >
              "The heart of the wise is in the house of mourning."
            </p>
            <p 
              className="text-sm mt-2"
              style={{ color: 'rgba(160, 155, 170, 0.7)' }}
            >
              — Ecclesiastes 7:4
            </p>
          </div>

          {/* Body content */}
          <div className="space-y-6">
            <p 
              className="text-sm md:text-base font-light leading-relaxed"
              style={{ color: 'rgba(200, 195, 210, 0.85)' }}
            >
              Requiary begins with a paradox: grief is both universal and deeply personal. Everyone experiences loss. Yet we're often left without adequate spaces to honor that experience—spaces that don't demand we move through mourning on someone else's timeline.
            </p>

            <p 
              className="text-sm md:text-base font-light leading-relaxed"
              style={{ color: 'rgba(200, 195, 210, 0.85)' }}
            >
              This space transforms anonymous grief messages into a luminous constellation. Each submission becomes a glowing point of light in a shared cosmos. The system identifies resonances between expressions, revealing unexpected connections between individual griefs. Your loss finds company in strangers' words.
            </p>

            <p 
              className="text-sm md:text-base font-light leading-relaxed"
              style={{ color: 'rgba(200, 195, 210, 0.85)' }}
            >
              The generative soundscape emerges from the aggregate presence of messages—not a preset ambient bed, but sound generated from the data itself. Semantic similarity becomes harmonic consonance. The installation breathes, creating acoustic architecture for contemplation.
            </p>

            {/* The Name section */}
            <div className="pt-6 mt-6 border-t border-white/10">
              <h3 
                className="text-lg md:text-xl font-light tracking-wide mb-4"
                style={{ 
                  color: 'rgba(235, 230, 245, 0.9)',
                }}
              >
                The Name
              </h3>
              <p 
                className="text-sm md:text-base font-light leading-relaxed"
                style={{ color: 'rgba(200, 195, 210, 0.85)' }}
              >
                A <em>reliquary</em> is a container for sacred remains—a vessel that holds what was lost but remains precious. <strong style={{ color: 'rgba(235, 230, 245, 0.95)', fontWeight: 500 }}>Requiary</strong> adapts this concept for collective grief: a digital vessel holding anonymous expressions of loss, each message a relic of someone's mourning, preserved and witnessed alongside others.
              </p>
            </div>

            {/* Guidance */}
            <div className="pt-6 mt-6 border-t border-white/10">
              <p 
                className="text-sm font-light italic"
                style={{ color: 'rgba(160, 155, 170, 0.75)' }}
              >
                Move at your own pace. Read what calls to you. Hover over particles to reveal messages. Contribute if it feels right. Silence is welcomed here.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Keyframe animations and scrollbar styling */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(20px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <style jsx global>{`
        /* Custom scrollbar for the modal */
        .modal-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .modal-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
        }
        .modal-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 4px;
        }
        .modal-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.25);
        }
        /* Firefox */
        .modal-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.15) rgba(255, 255, 255, 0.05);
        }
      `}</style>
    </div>
  )
}
