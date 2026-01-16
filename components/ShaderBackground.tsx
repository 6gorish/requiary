'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = `
uniform float u_time;
uniform vec2 u_resolution;
varying vec2 vUv;

// ISF shader parameters converted to uniforms
uniform float scale;
uniform float offsetX;
uniform float timeScale;
uniform float noiseSpeed;
uniform float brightness;
uniform vec3 color;
uniform vec3 accent;

#define NUM_OCTAVES 6

mat3 rotX(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat3(
        1.0, 0.0, 0.0,
        0.0, c, -s,
        0.0, s, c
    );
}

mat3 rotY(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat3(
        c, 0.0, -s,
        0.0, 1.0, 0.0,
        s, 0.0, c
    );
}

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
        v += a * noise(pos - noiseSpeed * dir * u_time * timeScale);
        pos = rot * pos * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

void main(void) {
    vec2 p = (gl_FragCoord.xy * scale - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    p -= vec2(offsetX, 0.0);
    float time2 = u_time * timeScale;

    vec2 q = vec2(0.0);
    q.x = fbm(p + 0.00 * time2);
    q.y = fbm(p + vec2(1.0));

    vec2 r = vec2(0.0);
    r.x = fbm(p + 1.0 * q + vec2(1.7, 1.2) + 0.15 * time2);
    r.y = fbm(p + 1.0 * q + vec2(8.3, 2.8) + 0.126 * time2);

    float f = fbm(p + r);

    vec3 baseCol = mix(vec3(0.0), color, clamp((f * f) * 5.5, 0.0, 1.0));
    baseCol = mix(baseCol, color, clamp(length(q), 0.0, 1.0));
    baseCol = mix(baseCol, accent, clamp(r.x, 0.0, 1.0));

    vec3 finalColor = (f * f * f * 1.0 + 0.9 * f) * baseCol;

    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    // Reduced vignette for better visibility across all screen sizes
    float alpha = clamp(2.0 - length(uv - vec2(0.5)), 0.0, 1.0);

    // tone mapping
    vec3 mapped = (finalColor * brightness) / (1.0 + finalColor * brightness);

    gl_FragColor = vec4(mapped, alpha);
}
`

export function ShaderBackground() {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const materialRef = useRef<THREE.ShaderMaterial | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Scene setup
    const scene = new THREE.Scene()
    sceneRef.current = scene

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true // Enable transparency for vignette effect
    })
    rendererRef.current = renderer

    renderer.setSize(window.innerWidth, window.innerHeight)
    // Reduce pixel ratio on mobile for better performance
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    renderer.setPixelRatio(isMobile ? 1 : Math.min(window.devicePixelRatio, 2))
    containerRef.current.appendChild(renderer.domElement)

    // Shader material with ISF parameters
    const material = new THREE.ShaderMaterial({
      uniforms: {
        u_time: { value: 0.0 },
        u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        // ISF shader parameters - matching reference appearance
        scale: { value: 3.0 },
        offsetX: { value: -12.0 },  // Will be adjusted based on aspect ratio
        timeScale: { value: 1.0 },
        noiseSpeed: { value: 0.05 },
        brightness: { value: 4.0 },  // Increased for better visibility
        color: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
        accent: { value: new THREE.Vector3(0.3, 0.2, 1.0) }
      },
      vertexShader,
      fragmentShader,
      transparent: true,
    })
    materialRef.current = material
    
    // Adjust offset based on aspect ratio to keep shader centered
    const updateShaderOffset = () => {
      const aspectRatio = window.innerWidth / window.innerHeight
      // On laptop screens (~1.6), use less offset. On wider screens (~2.0+), use more.
      // Formula: interpolate between -8 (narrower) and -14 (wider)
      const minOffset = -8.0
      const maxOffset = -14.0
      const t = Math.min(Math.max((aspectRatio - 1.3) / 1.0, 0), 1) // normalize between 1.3 and 2.3
      material.uniforms.offsetX.value = minOffset + (maxOffset - minOffset) * t
    }
    updateShaderOffset()

    const geometry = new THREE.PlaneGeometry(2, 2)
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    // Handle resize with iOS viewport fix
    const handleResize = () => {
      if (!renderer || !material) return
      const width = window.innerWidth
      // Use visualViewport for iOS, fallback to window.innerHeight
      // Add extra height buffer for iOS address bar transitions
      const height = (window.visualViewport?.height || window.innerHeight) + 100
      renderer.setSize(width, height)
      material.uniforms.u_resolution.value.set(width, height)
      updateShaderOffset()  // Recalculate offset for new aspect ratio
    }
    
    window.addEventListener('resize', handleResize)
    
    // Also listen to visualViewport changes (iOS Safari address bar)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize)
    }

    // Animation loop
    let animationFrameId: number
    const animate = () => {
      if (!material || !renderer || !scene) return
      // Separate animation speeds: slower on desktop for contemplative feel, moderate on mobile
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      material.uniforms.u_time.value += isMobile ? 0.0135 : 0.008
      renderer.render(scene, camera)
      animationFrameId = requestAnimationFrame(animate)
    }
    animate()

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize)
      }
      cancelAnimationFrame(animationFrameId)

      if (renderer) {
        renderer.dispose()
        if (containerRef.current && renderer.domElement) {
          containerRef.current.removeChild(renderer.domElement)
        }
      }

      if (material) {
        material.dispose()
      }

      geometry.dispose()
    }
  }, [])

  return (
    <div 
      ref={containerRef} 
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        zIndex: -10,
        overflow: 'hidden',
        // Prevent any gaps during iOS viewport changes
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)',
      }}
    />
  )
}
