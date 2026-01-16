'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { VISUALIZATION_CONFIG } from '@/lib/config/visualization-config'
import { getDeviceConfig } from '@/lib/device-detection'
import Link from 'next/link'

const vertexShader = `
attribute vec3 aPosition;
attribute vec2 aTexCoord;
varying vec2 vTexCoord;

void main() {
  vTexCoord = aTexCoord;
  vec4 positionVec4 = vec4(aPosition, 1.0);
  positionVec4.xy = positionVec4.xy * 2.0 - 1.0;
  gl_Position = positionVec4;
}
`

const cosmicFragmentShader = `
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_brightness;
uniform vec3 u_tintColor;
uniform float u_animSpeedX;
uniform float u_animSpeedY;
uniform float u_noiseScale;
uniform float u_contrast;
uniform float u_toneMapping;

varying vec2 vTexCoord;

#define NUM_OCTAVES 4

float random(vec2 pos) {
    return fract(sin(dot(pos.xy, vec2(13.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 pos) {
    vec2 i = floor(pos);
    vec2 f = fract(pos);
    float a = random(i + vec2(0.0, 0.0));
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 pos) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < NUM_OCTAVES; i++) {
        float dir = mod(float(i), 2.0) > 0.5 ? 1.0 : -1.0;
        v += a * noise(pos - 0.1 * dir * u_time * 2.0);
        pos = rot * pos * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

void main() {
    vec2 p = (gl_FragCoord.xy * u_noiseScale - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    p -= vec2(-12.0, 0.0);
    
    vec2 q = vec2(0.0);
    q.x = fbm(p + 0.00 * u_time * 2.0);
    q.y = fbm(p + vec2(1.0));

    vec2 r = vec2(0.0);
    r.x = fbm(p + 1.0 * q + vec2(1.7, 1.2) + u_animSpeedX * u_time * 2.0);
    r.y = fbm(p + 1.0 * q + vec2(8.3, 2.8) + u_animSpeedY * u_time * 2.0);

    float f = fbm(p + r);

    vec3 baseCol = mix(vec3(0.0), vec3(1.0), clamp((f * f) * u_contrast, 0.0, 1.0));
    baseCol = mix(baseCol, vec3(1.0), clamp(length(q), 0.0, 1.0));
    baseCol = mix(baseCol, u_tintColor, clamp(r.x, 0.0, 1.0));

    vec3 finalColor = (f * f * f * 1.0 + 0.9 * f) * baseCol;
    vec3 mapped = (finalColor * u_toneMapping) / (1.0 + finalColor * u_toneMapping);

    gl_FragColor = vec4(mapped * u_brightness, 1.0);
}
`

interface Particle {
  id: string
  x: number
  y: number
  size: number
  content: string
  alpha: number
  isUserMessage: boolean
  // Smooth hover transition
  hoverGlow: number  // 0 to 1, animates smoothly
}

interface DbMessage {
  id: string
  content: string
}

function InstallationPreview() {
  const containerRef = useRef<HTMLDivElement>(null)
  const p5InstanceRef = useRef<any>(null)
  const [hoveredMessage, setHoveredMessage] = useState<{ content: string; x: number; y: number; isUser?: boolean } | null>(null)
  const [userMessage, setUserMessage] = useState<string | null>(null)
  const [totalMessages, setTotalMessages] = useState<number>(0)
  const [isLoaded, setIsLoaded] = useState(false)
  const [showUserMessage, setShowUserMessage] = useState(true)
  const [isUserParticleHovered, setIsUserParticleHovered] = useState(false)

  // Get user's submitted message from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem('submittedGriefMessage')
    if (stored) {
      setUserMessage(stored)
    }
  }, [])

  // Fade out user message after 5 seconds
  useEffect(() => {
    if (userMessage && isLoaded) {
      const timer = setTimeout(() => {
        setShowUserMessage(false)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [userMessage, isLoaded])

  useEffect(() => {
    const deviceConfig = getDeviceConfig()

    import('p5').then((p5Module) => {
      const p5 = p5Module.default

      if (!containerRef.current) return

      const sketch = (p: any) => {
        let backgroundLayer: any
        let particleLayer: any
        let cosmicShader: any
        let shaderTime = 0

        const particles = new Map<string, Particle>()
        let currentHoveredId: string | null = null

        // Particle sizing
        const minParticleSize = deviceConfig.minParticleSize
        const maxParticleSize = deviceConfig.maxParticleSize
        const particleSizeRange = maxParticleSize - minParticleSize

        p.setup = async () => {
          const canvas = p.createCanvas(p.windowWidth, p.windowHeight)
          canvas.parent(containerRef.current!)

          // Background shader layer
          backgroundLayer = p.createGraphics(p.width, p.height, p.WEBGL)
          cosmicShader = backgroundLayer.createShader(vertexShader, cosmicFragmentShader)

          // Particle layer
          particleLayer = p.createGraphics(p.width, p.height)

          // Fetch messages from database
          const supabase = createClient()
          
          // Get total count
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('approved', true)
            .is('deleted_at', null)
          
          setTotalMessages(count || 0)

          // Fetch up to 300 messages
          const { data: messages, error } = await supabase
            .from('messages')
            .select('id, content')
            .eq('approved', true)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(300)

          if (error) {
            console.error('Failed to fetch messages:', error)
          }

          // Reserve center area for user's message
          const centerX = p.width / 2
          const centerY = p.height / 2
          const centerRadius = 150

          if (messages && messages.length > 0) {
            messages.forEach((msg: DbMessage) => {
              // Generate position avoiding center
              let x, y, attempts = 0
              do {
                x = p.width * 0.05 + Math.random() * p.width * 0.9
                y = p.height * 0.05 + Math.random() * p.height * 0.9
                attempts++
              } while (
                Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2) < centerRadius && 
                attempts < 20
              )

              particles.set(msg.id, {
                id: msg.id,
                x,
                y,
                size: minParticleSize + Math.random() * particleSizeRange,
                content: msg.content,
                alpha: 0,
                isUserMessage: false,
                hoverGlow: 0
              })
            })
          }

          // Add user's message as center particle if it exists
          const storedMessage = sessionStorage.getItem('submittedGriefMessage')
          if (storedMessage) {
            const userParticle: Particle = {
              id: 'user-submission',
              x: centerX,
              y: centerY,
              size: maxParticleSize * 1.3,
              content: storedMessage,
              alpha: 0,
              isUserMessage: true,
              hoverGlow: 0
            }
            particles.set('user-submission', userParticle)
          }

          setIsLoaded(true)
        }

        p.draw = () => {
          shaderTime += 0.016 * deviceConfig.shaderSpeedMultiplier
          const { backgroundColor: bg } = VISUALIZATION_CONFIG
          p.background(bg.r, bg.g, bg.b)

          // Background shader
          const { backgroundColor, cosmicShader: shaderConfig, darkOverlay } = VISUALIZATION_CONFIG
          backgroundLayer.clear()
          backgroundLayer.background(backgroundColor.r, backgroundColor.g, backgroundColor.b)
          backgroundLayer.shader(cosmicShader)

          // Shader breathing
          const shaderBreathTime = Date.now() / 1000
          const breath1 = Math.sin(shaderBreathTime * 0.17) * 0.04
          const breath2 = Math.sin(shaderBreathTime * 0.11) * 0.03
          const breath3 = Math.sin(shaderBreathTime * 0.07) * 0.02
          const bgBreathing = breath1 + breath2 + breath3
          const bgBrightness = shaderConfig.brightness * (1.0 + bgBreathing)

          cosmicShader.setUniform('u_time', shaderTime)
          cosmicShader.setUniform('u_resolution', [backgroundLayer.width, backgroundLayer.height])
          cosmicShader.setUniform('u_brightness', bgBrightness)
          cosmicShader.setUniform('u_tintColor', [shaderConfig.tintColor.r, shaderConfig.tintColor.g, shaderConfig.tintColor.b])
          cosmicShader.setUniform('u_animSpeedX', shaderConfig.animationSpeedX)
          cosmicShader.setUniform('u_animSpeedY', shaderConfig.animationSpeedY)
          cosmicShader.setUniform('u_noiseScale', shaderConfig.noiseScale)
          cosmicShader.setUniform('u_contrast', shaderConfig.contrast)
          cosmicShader.setUniform('u_toneMapping', shaderConfig.toneMapping)

          backgroundLayer.noStroke()
          backgroundLayer.rect(-backgroundLayer.width/2, -backgroundLayer.height/2, backgroundLayer.width, backgroundLayer.height)
          backgroundLayer.resetShader()

          p.image(backgroundLayer, 0, 0)

          // Dark overlay
          p.noStroke()
          p.fill(darkOverlay.color.r, darkOverlay.color.g, darkOverlay.color.b, darkOverlay.opacity * 255)
          p.rect(0, 0, p.width, p.height)

          // Draw particles
          particleLayer.clear()
          const ctx = particleLayer.drawingContext
          const { particleColors } = VISUALIZATION_CONFIG

          // Pulse timing for hover effect
          const pulseTime = Date.now() / 1000
          const hoverPulse = 1 + Math.sin(pulseTime * 2) * 0.15

          particles.forEach((particle) => {
            // Fade in animation
            if (particle.alpha < 1) {
              particle.alpha = Math.min(1, particle.alpha + 0.02)
            }

            // Smooth hover glow transition
            const isHovered = particle.id === currentHoveredId
            if (isHovered) {
              particle.hoverGlow = Math.min(1, particle.hoverGlow + 0.1)
            } else {
              particle.hoverGlow = Math.max(0, particle.hoverGlow - 0.05)
            }

            if (particle.alpha < 0.01) return

            // Color selection - warmer/brighter when hovered
            const isUser = particle.isUserMessage
            const glowAmount = particle.hoverGlow
            
            // Base colors
            let center, mid
            if (isUser) {
              center = { r: 255, g: 250, b: 240 }
              mid = { r: 255, g: 245, b: 220 }
            } else {
              // Interpolate toward warm white on hover
              const baseCenter = particleColors.default.center
              const baseMid = particleColors.default.mid
              center = {
                r: baseCenter.r + (255 - baseCenter.r) * glowAmount * 0.6,
                g: baseCenter.g + (250 - baseCenter.g) * glowAmount * 0.5,
                b: baseCenter.b + (240 - baseCenter.b) * glowAmount * 0.3
              }
              mid = {
                r: baseMid.r + (255 - baseMid.r) * glowAmount * 0.5,
                g: baseMid.g + (245 - baseMid.g) * glowAmount * 0.4,
                b: baseMid.b + (230 - baseMid.b) * glowAmount * 0.25
              }
            }

            // Size and brightness multipliers
            // User particle always pulses; others pulse when hovered
            const sizePulse = isUser ? hoverPulse : (1 + (hoverPulse - 1) * glowAmount)
            const sizeMult = 1 + glowAmount * 0.3  // Grow up to 30% on hover
            const brightnessMult = isUser ? 1.3 : (1 + glowAmount * 0.4)  // Brighten on hover
            
            const sizeBrightness = 0.4 + ((particle.size - 2) / 4) * 0.6
            const totalBrightness = particle.alpha * sizeBrightness * brightnessMult

            const finalSize = particle.size * 2.5 * sizeMult * sizePulse

            const gradient = ctx.createRadialGradient(
              particle.x, particle.y, 0,
              particle.x, particle.y, finalSize
            )

            gradient.addColorStop(0, `rgba(${center.r}, ${center.g}, ${center.b}, ${1.0 * totalBrightness})`)
            gradient.addColorStop(0.4, `rgba(${mid.r}, ${mid.g}, ${mid.b}, ${0.6 * totalBrightness})`)
            gradient.addColorStop(0.7, `rgba(${mid.r}, ${mid.g}, ${mid.b}, ${0.2 * totalBrightness})`)
            gradient.addColorStop(1, `rgba(${mid.r}, ${mid.g}, ${mid.b}, 0)`)

            ctx.fillStyle = gradient
            ctx.beginPath()
            ctx.arc(particle.x, particle.y, finalSize, 0, Math.PI * 2)
            ctx.fill()
          })

          p.image(particleLayer, 0, 0)
        }

        p.mouseMoved = () => {
          let foundParticle: Particle | null = null

          for (const particle of particles.values()) {
            if (particle.alpha <= 0) continue

            const dx = p.mouseX - particle.x
            const dy = p.mouseY - particle.y
            const distance = Math.sqrt(dx * dx + dy * dy)

            if (distance <= particle.size * 2.5) {
              foundParticle = particle
              break
            }
          }

          const newId = foundParticle ? foundParticle.id : null
          if (newId !== currentHoveredId) {
            currentHoveredId = newId
            
            // Check if it's the user particle
            if (foundParticle?.isUserMessage) {
              setIsUserParticleHovered(true)
              setHoveredMessage(null)  // Don't show hover tooltip for user message
            } else {
              setIsUserParticleHovered(false)
              setHoveredMessage(foundParticle
                ? { content: foundParticle.content, x: foundParticle.x, y: foundParticle.y }
                : null
              )
            }
          }

          return false
        }

        p.windowResized = () => {
          const oldWidth = p.width
          const oldHeight = p.height

          p.resizeCanvas(p.windowWidth, p.windowHeight)

          particles.forEach(particle => {
            particle.x = (particle.x / oldWidth) * p.width
            particle.y = (particle.y / oldHeight) * p.height
          })

          backgroundLayer = p.createGraphics(p.width, p.height, p.WEBGL)
          cosmicShader = backgroundLayer.createShader(vertexShader, cosmicFragmentShader)
          particleLayer = p.createGraphics(p.width, p.height)
        }
      }

      const p5Instance = new p5(sketch)
      p5InstanceRef.current = p5Instance
    })

    return () => {
      if (p5InstanceRef.current) {
        p5InstanceRef.current.remove()
      }
    }
  }, [])

  // Show user message if: initial 5 seconds OR hovering user particle
  const shouldShowUserMessage = userMessage && isLoaded && (showUserMessage || isUserParticleHovered)

  return (
    <div className="fixed inset-0 w-full h-full bg-black">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Minimal nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 py-3 md:px-6 md:py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <Link
            href="/"
            className="text-white/80 hover:text-white transition-colors text-sm md:text-base font-light tracking-wide"
            style={{
              fontFamily: 'var(--font-logo)',
              textShadow: '0 2px 10px rgba(0,0,0,0.8)'
            }}
          >
            Requiary
          </Link>
        </div>
      </nav>

      {/* Hover tooltip for non-user particles */}
      {hoveredMessage && (
        <div
          className="fixed pointer-events-none z-30"
          style={{
            left: hoveredMessage.x + 25 > window.innerWidth - 340 
              ? undefined 
              : `${hoveredMessage.x + 25}px`,
            right: hoveredMessage.x + 25 > window.innerWidth - 340
              ? `${window.innerWidth - hoveredMessage.x + 25}px`
              : undefined,
            top: `${hoveredMessage.y + 25}px`,
            maxWidth: '320px',
          }}
        >
          <p
            className="font-display leading-relaxed italic"
            style={{
              color: 'rgba(160, 155, 170, 0.9)',
              fontSize: 'clamp(1rem, 1.5vw, 1.25rem)',
              textShadow: '0 0 10px rgba(0,0,0,1), 0 0 25px rgba(0,0,0,0.95)',
            }}
          >
            "{hoveredMessage.content}"
          </p>
        </div>
      )}

      {/* User's message - fades out after 5s, reappears on hover */}
      <div 
        className="fixed z-40 pointer-events-none transition-opacity duration-500"
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -100%)',
          marginTop: '-40px',
          maxWidth: '500px',
          width: '90%',
          textAlign: 'center',
          opacity: shouldShowUserMessage ? 1 : 0,
        }}
      >
        <p
          className="font-display"
          style={{
            color: 'rgba(250, 247, 242, 0.98)',
            fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
            fontWeight: 500,
            letterSpacing: '0.02em',
            lineHeight: 1.2,
            textShadow: '0 0 15px rgba(0,0,0,1), 0 0 40px rgba(0,0,0,0.9), 0 4px 8px rgba(0,0,0,0.9)',
          }}
        >
          {userMessage}
        </p>
      </div>

      {/* Confirmation panel - bottom of screen */}
      {isLoaded && (
        <div className="fixed bottom-0 left-0 right-0 z-40">
          <div 
            className="max-w-2xl mx-auto px-6 pb-8 pt-16"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.8) 60%, transparent 100%)',
            }}
          >
            {/* Confirmation message */}
            <div className="text-center mb-8">
              <p 
                className="text-lg md:text-xl font-light leading-relaxed mb-2"
                style={{ 
                  color: 'rgba(220, 215, 230, 0.95)',
                  textShadow: '0 2px 10px rgba(0,0,0,0.8)',
                }}
              >
                {userMessage 
                  ? 'Your grief has been witnessed.'
                  : 'A constellation of shared grief.'
                }
              </p>
              <p 
                className="text-sm md:text-base font-light"
                style={{ color: 'rgba(180, 175, 190, 0.85)' }}
              >
                {userMessage
                  ? `Your message joins ${totalMessages.toLocaleString()} expressions of loss.`
                  : `${totalMessages.toLocaleString()} expressions of loss, waiting to be unveiled.`
                }
              </p>
            </div>

            {/* Invitation */}
            <div 
              className="text-center mb-8 py-6 px-4 rounded-lg"
              style={{ 
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <p 
                className="text-sm font-light italic"
                style={{ color: 'rgba(160, 155, 170, 0.75)' }}
              >
                {userMessage 
                  ? 'Your contribution is now part of the constellation.'
                  : 'Where individual loss discovers collective witness.'
                }
              </p>
            </div>



            {/* Links */}
            <div className="flex justify-center gap-6 mt-6 text-sm">
              <Link 
                href="/participate"
                className="text-white/60 hover:text-white/90 transition-colors"
              >
                {userMessage ? 'Share another' : 'Share your grief'}
              </Link>
              <Link 
                href="/about"
                className="text-white/60 hover:text-white/90 transition-colors"
              >
                Learn more
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default dynamic(() => Promise.resolve(InstallationPreview), { ssr: false })
