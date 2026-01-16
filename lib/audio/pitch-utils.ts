/**
 * Pitch calculation utilities for sonification
 * Converts semantic embeddings to musical pitches within scales
 */

/**
 * Convert embedding to pitch within pentatonic scale
 */
export function embeddingToPitch(
  embedding: number[] | undefined,
  scale: number[],        // [0, 3, 5, 7, 10] for minor pentatonic
  bassHz: number,         // Current bass note frequency
  octaveAboveBass: number // Which octave (1, 2, 3...)
): { scaleDegree: number; hz: number } {

  if (!embedding || embedding.length < 3) {
    // Fallback: random scale degree
    const idx = Math.floor(Math.random() * scale.length)
    const scaleDegree = scale[idx]
    const hz = bassHz * Math.pow(2, octaveAboveBass) * Math.pow(2, scaleDegree / 12)
    return { scaleDegree, hz }
  }

  // Weight first 3 dimensions
  const raw = embedding[0] * 0.5 + embedding[1] * 0.3 + embedding[2] * 0.2

  // Normalize from typical embedding range (-1 to 1) to 0-1
  const normalized = (raw + 1) / 2
  const clamped = Math.max(0, Math.min(1, normalized))

  // Map to scale index
  const index = Math.floor(clamped * scale.length)
  const safeIndex = Math.min(index, scale.length - 1)
  const scaleDegree = scale[safeIndex]

  // Calculate frequency
  const octaveMultiplier = Math.pow(2, octaveAboveBass)
  const semitoneMultiplier = Math.pow(2, scaleDegree / 12)
  const hz = bassHz * octaveMultiplier * semitoneMultiplier

  return { scaleDegree, hz }
}

/**
 * Convert scale degree to Hz given bass frequency
 */
export function scaleDegreesToHz(
  scaleDegree: number,
  bassHz: number,
  octave: number = 2
): number {
  return bassHz * Math.pow(2, octave) * Math.pow(2, scaleDegree / 12)
}

/**
 * Get interval ratio for chromatic extension
 * Used for adding color tones (7ths, 9ths, etc.)
 */
export function chromaticExtension(
  baseHz: number,
  extensionType: 'maj7' | 'min7' | '9' | '11' | '13'
): number {
  const ratios = {
    'maj7': 15/8,   // Major 7th
    'min7': 9/5,    // Minor 7th
    '9': 9/4,       // Major 9th
    '11': 4/3 * 2,  // Perfect 11th (octave + 4th)
    '13': 5/3 * 2   // Major 13th (octave + 6th)
  }
  return baseHz * ratios[extensionType]
}
