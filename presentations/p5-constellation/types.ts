/**
 * Types and configuration for P5.js Constellation presentation layer
 * 
 * v6: RADICAL SIMPLIFICATION - get basics working first
 */

import type p5 from 'p5'
import type { GriefMessage } from '@/types/grief-messages'

export const CONFIG = {
  // Particle System
  PARTICLE_BASE_SIZE: 3, // Smaller base size for variety
  PARTICLE_NEW_SIZE: 5, // Reduced max size
  PARTICLE_SIZE_DECAY: 0.1,
  PARTICLE_VELOCITY_MAX: 1.0,
  PARTICLE_FADE_IN_SPEED: 0.02,
  PARTICLE_FADE_OUT_SPEED: 0.016,
  
  // Spatial Bounds - TIGHTER to reduce distortion
  SPACE_X_MIN: -400, // Reduced from 500
  SPACE_X_MAX: 400,
  SPACE_Y_MIN: -400,
  SPACE_Y_MAX: 400,
  SPACE_Z_MIN: -150, // Reduced from 200
  SPACE_Z_MAX: 150,
  
  // Constellation Network
  CONNECTION_MIN_SIMILARITY: 0.6,
  CONNECTION_STROKE_WEIGHT: 0.5,
  CONNECTION_OPACITY_BASE: 100,
  CONNECTION_FADE_IN_SPEED: 0.01,
  CONNECTION_FADE_OUT_SPEED: 0.02,
  CONNECTION_SPRING_POINTS: 8,
  CONNECTION_SPRING_CONSTANT: 0.05,
  CONNECTION_SPRING_DAMPING: 0.9,
  
  // Visual Style - SIMPLE, STRONG COLOR
  BASE_HUE: 30, // Orange
  BASE_SATURATION: 80, // High saturation
  BASE_LIGHTNESS: 55, // Medium brightness
  HUE_VARIATION: 0, // NO VARIATION - all same color for now
  BACKGROUND_HUE: 0,
  BACKGROUND_SATURATION: 0,
  BACKGROUND_LIGHTNESS: 5,
  
  // Camera
  CAMERA_ORBIT_SPEED: 0.0005,
  CAMERA_RADIUS: 800,
  CAMERA_HEIGHT_OSCILLATION: 50,
  CAMERA_HEIGHT_SPEED: 0.001,
  
  // Fluid Field (Tier 3)
  FLUID_GRID_RESOLUTION: 20,
  FLUID_NOISE_SCALE: 0.05,
  FLUID_TIME_SCALE: 0.001,
  FLUID_FORCE_STRENGTH: 0.1,
  
  // Background Field (Tier 3)
  BACKGROUND_STAR_COUNT: 1000,
  BACKGROUND_STAR_Z_MIN: -1000,
  BACKGROUND_STAR_Z_MAX: -500,
  BACKGROUND_STAR_BRIGHTNESS_MIN: 50,
  BACKGROUND_STAR_BRIGHTNESS_MAX: 150,
  
  // Text Reveal (Tier 3)
  TEXT_SIZE: 18,
  TEXT_MAX_WIDTH: 300,
  TEXT_FADE_SPEED: 0.05,
  TEXT_CLICK_RADIUS: 30,
  
  // Performance
  TARGET_FPS: 60,
  NEW_MESSAGE_HIGHLIGHT_DURATION: 60000,
}

export interface Vector3D {
  x: number
  y: number
  z: number
}

export interface Color {
  h: number
  s: number
  l: number
}

export interface Particle {
  id: string
  message: GriefMessage
  position: Vector3D
  originalPosition: Vector3D
  velocity: Vector3D
  size: number
  brightness: number
  color: Color
  age: number
  fadeOut: boolean
}

export interface ParticleSystemState {
  particles: Map<string, Particle>
  frame: number
}

export interface SpringPoint {
  position: Vector3D
  velocity: Vector3D
  equilibrium: Vector3D
}

export interface Connection {
  from: string
  to: string
  strength: number
  springs: SpringPoint[]
  opacity: number
}

export interface NetworkState {
  connections: Map<string, Connection>
  frame: number
}

export interface FluidGrid {
  grid: Vector3D[][][]
  resolution: number
  frame: number
}

export interface CameraState {
  angle: number
  radius: number
  height: number
  targetPosition: Vector3D
  lookAt: Vector3D
}

export interface TextRevealState {
  selectedParticle: Particle | null
  textOpacity: number
  screenPosition: { x: number; y: number } | null
}

export interface PresentationState {
  particles: ParticleSystemState
  network: NetworkState
  fluid?: FluidGrid
  camera?: CameraState
  textReveal?: TextRevealState
  frame: number
}

export type P5Instance = p5

export interface P5SketchProps {
  onReady?: () => void
  onError?: (error: Error) => void
}
