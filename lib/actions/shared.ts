import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai'

// ─────────────────────────────────────────────────────────────────────────────
// Shared constants & helpers used across all action modules
// ─────────────────────────────────────────────────────────────────────────────

export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', hi: 'Hindi', as: 'Assamese', bn: 'Bengali',
  ta: 'Tamil',   te: 'Telugu', kn: 'Kannada',  mr: 'Marathi',
  gu: 'Gujarati', pa: 'Punjabi',
}

export const SCRIPT_HINTS: Record<string, string> = {
  as: `CRITICAL — You are writing in Assamese (Asamiya), NOT Bengali. Strictly follow Assamese orthography:
- Use ৰ (Assamese ra) — never র (Bengali ra)
- Use ৱ (Assamese wa) — never ব for the wa-sound
- Use হ'ব, কৰিব, যোৱা, আহিব style Assamese verb forms
- Do NOT use Bengali verb endings (-ছে, -বে) or Bengali-only vocabulary
- Write naturally in Assamese as spoken in Assam`,
}

export function getLangName(language: string): string {
  return LANGUAGE_NAMES[language] ?? 'English'
}

export function getScriptHint(language: string): string {
  return SCRIPT_HINTS[language] ?? ''
}

export function getGeminiModel(modelName: string): GenerativeModel {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set')
  const client = new GoogleGenerativeAI(apiKey)
  return client.getGenerativeModel({ model: modelName })
}

export function bufferToGenerativePart(fileBuffer: Buffer, mimeType: string) {
  return {
    inlineData: {
      data: fileBuffer.toString('base64'),
      mimeType,
    },
  }
}
