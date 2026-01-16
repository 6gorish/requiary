/**
 * Installation Shader Background
 * 
 * FIXED: Bright areas = opaque, dark areas = transparent
 * OPTIMIZED: Reduced octaves, faster animation
 */

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

uniform float scale;
uniform float offsetX;
uniform float timeScale;
uniform float noiseSpeed;
uniform float brightness;
uniform vec3 color;
uniform vec3 accent;

#define NUM_OCTAVES 4  // Reduced from 6 for better performance

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

    // FIXED: Bright areas = opaque, dark areas = transparent
    // f ranges 0-1: high f = bright color
    float alpha = f * 0.8;  // Bright (high f) = opaque (high alpha)
    alpha = clamp(alpha, 0.1, 0.9);

    // tone mapping
    vec3 mapped = (finalColor * brightness) / (1.0 + finalColor * brightness);

    gl_FragColor = vec4(mapped, alpha);
}
`

export function InstallationShaderBackground() {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const materialRef = useRef<THREE.ShaderMaterial | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const scene = new THREE.Scene()
    sceneRef.current = scene

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    const renderer = new THREE.WebGLRenderer({
      antialias: false, // Disable for better performance
      alpha: true
    })
    rendererRef.current = renderer

    renderer.setSize(window.innerWidth, window.innerHeight)
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    renderer.setPixelRatio(isMobile ? 1 : 1) // Force 1x pixel ratio for performance

    containerRef.current.appendChild(renderer.domElement)

    const material = new THREE.ShaderMaterial({
      uniforms: {
        u_time: { value: 0.0 },
        u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        scale: { value: 3.0 },
        offsetX: { value: -12.0 },
        timeScale: { value: 2.0 }, // Increased from 1.0 for faster animation
        noiseSpeed: { value: 0.1 }, // Increased from 0.05 for more visible motion
        brightness: { value: 3.0 },
        color: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
        accent: { value: new THREE.Vector3(0.3, 0.2, 1.0) }
      },
      vertexShader,
      fragmentShader,
      transparent: true,
    })
    materialRef.current = material

    const geometry = new THREE.PlaneGeometry(2, 2)
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    const handleResize = () => {
      if (!renderer || !material) return
      const width = window.innerWidth
      const height = window.innerHeight
      renderer.setSize(width, height)
      material.uniforms.u_resolution.value.set(width, height)
    }
    
    window.addEventListener('resize', handleResize)

    let animationFrameId: number
    
    const animate = () => {
      if (!material || !renderer || !scene) return
      
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      material.uniforms.u_time.value += isMobile ? 0.027 : 0.016 // Doubled speed
      
      renderer.render(scene, camera)
      animationFrameId = requestAnimationFrame(animate)
    }
    
    animate()

    return () => {
      window.removeEventListener('resize', handleResize)
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
        overflow: 'hidden',
      }}
    />
  )
}
