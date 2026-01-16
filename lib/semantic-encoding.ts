/**
 * Semantic Encoding Module
 *
 * Generates semantic embeddings for grief messages using Anthropic's Claude API.
 * Embeddings represent semantic themes like loss type, emotional tone, etc.
 */

/**
 * Generate semantic embedding vector for grief message content
 * Returns 10-dimensional vector representing semantic themes
 *
 * @param content - The grief message text
 * @returns Array of 10 numbers between -1.0 and 1.0, or null if generation fails
 */
export async function getSemanticEmbedding(content: string): Promise<number[] | null> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        messages: [{
          role: "user",
          content: `Generate a semantic embedding vector for this grief expression.
          Consider themes of: loss type, emotional tone, temporal relationship,
          specific vs abstract, personal vs universal.

          Message: "${content}"

          Return ONLY a JSON array of 10 numbers between -1.0 and 1.0 representing
          semantic dimensions. No explanation.

          Example format: [-0.8, 0.3, 0.7, -0.2, 0.9, -0.5, 0.1, 0.6, -0.4, 0.8]`
        }]
      })
    })

    if (!response.ok) {
      console.error(`Anthropic API error: ${response.status}`)
      return null
    }

    const data = await response.json()
    const embedding = JSON.parse(data.content[0].text.trim())

    // Validate embedding format
    if (!Array.isArray(embedding) || embedding.length !== 10) {
      console.error('Invalid embedding format')
      return null
    }

    return embedding
  } catch (error) {
    console.error('Semantic encoding error:', error)
    return null
  }
}

/**
 * Calculate cosine similarity between two embedding vectors
 * Returns value between -1 (opposite) and 1 (identical)
 *
 * @param vec1 - First embedding vector
 * @param vec2 - Second embedding vector
 * @returns Cosine similarity score
 */
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have same length')
  }

  const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0)
  const mag1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0))
  const mag2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0))

  if (mag1 === 0 || mag2 === 0) return 0

  return dotProduct / (mag1 * mag2)
}
