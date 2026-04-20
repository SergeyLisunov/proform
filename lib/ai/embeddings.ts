// Multilingual sentence embeddings via HuggingFace Inference API.
// Model: sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2 (384-dim).

const HF_EMBED_MODEL =
  process.env.HF_EMBED_MODEL || 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'
const HF_EMBED_URL = `https://api-inference.huggingface.co/pipeline/feature-extraction/${HF_EMBED_MODEL}`

export const EMBEDDING_DIM = 384

export type EmbedInput = string

function meanPool(vectors: number[][]): number[] {
  const dim = vectors[0].length
  const out = new Array<number>(dim).fill(0)
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) out[i] += v[i]
  }
  for (let i = 0; i < dim; i++) out[i] /= vectors.length
  return out
}

function isFlat(arr: unknown): arr is number[] {
  return Array.isArray(arr) && typeof arr[0] === 'number'
}

function normalize(sentence: unknown): number[] {
  if (isFlat(sentence)) return sentence
  if (Array.isArray(sentence) && Array.isArray(sentence[0])) {
    // Token-level embeddings → mean pool.
    return meanPool(sentence as number[][])
  }
  throw new Error('UNEXPECTED_EMBEDDING_SHAPE')
}

export async function embedOne(text: string): Promise<number[]> {
  const [vec] = await embedMany([text])
  return vec
}

export async function embedMany(texts: string[]): Promise<number[][]> {
  const token = process.env.HF_API_TOKEN
  if (!token) throw new Error('HF_API_TOKEN not configured')
  if (texts.length === 0) return []

  const res = await fetch(HF_EMBED_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Wait-For-Model': 'true',
    },
    body: JSON.stringify({
      inputs: texts,
      options: { wait_for_model: true, use_cache: true },
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`HF_EMBED_FAILED ${res.status}: ${errText.slice(0, 200)}`)
  }

  const data = (await res.json()) as unknown

  if (!Array.isArray(data)) throw new Error('UNEXPECTED_HF_RESPONSE')

  // Response is either number[][] (one vec per input) or number[][][] (token-level per input).
  return (data as unknown[]).map(normalize)
}

/** Stable hash for cache invalidation. */
export async function contentHash(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
