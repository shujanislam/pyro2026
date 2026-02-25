import { TTS_VOICES } from './config.ts'

// ─────────────────────────────────────────────────────────────────────────────
// TTS helpers
// /api/tts → Next.js route → edge-tts (spawn). Dev: localhost:3000. Prod: Vercel.
// Assamese omitted — no Microsoft neural voice exists.
// ─────────────────────────────────────────────────────────────────────────────

export function getBaseUrl(): string {
  if (process.env.APP_URL)    return process.env.APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

/** Strip traffic-light emoji and HTML so edge-tts reads clean prose. */
export function prepareForTts(text: string): string {
  return text
    .replace(/[\u{1F7E2}\u{1F7E1}\u{1F534}\u{1F4C8}\u{1F4C9}\u{1F195}\u{27A1}\u{2705}\u{26A0}]/gu, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\*{1,3}(.+?)\*{1,3}/g, '$1')
    .replace(/_{1,2}(.+?)_{1,2}/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 1200)
}

/** Calls /api/tts; returns null on failure or when lang has no voice. */
export async function fetchTtsAudio(text: string, lang: string): Promise<Buffer | null> {
  const voice = TTS_VOICES[lang]
  if (!voice) return null
  const cleanText = prepareForTts(text)
  if (!cleanText) return null
  try {
    const res = await fetch(`${getBaseUrl()}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleanText, voice }),
    })
    if (!res.ok) {
      console.error(`[TTS] /api/tts returned ${res.status}`)
      return null
    }
    return Buffer.from(await res.arrayBuffer())
  } catch (err) {
    console.error('[TTS] fetch error:', err)
    return null
  }
}
