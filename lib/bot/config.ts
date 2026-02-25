// ─────────────────────────────────────────────────────────────────────────────
// Bot-wide constants & types
// ─────────────────────────────────────────────────────────────────────────────

export interface LangConfig {
  name: string
  flag: string
}

export type DocType = 'blood' | 'medical' | 'insurance'

export const LANGUAGES: Record<string, LangConfig> = {
  en: { name: 'English',  flag: '🇬🇧' },
  hi: { name: 'Hindi',    flag: '🇮🇳' },
  bn: { name: 'Bengali',  flag: '🇧🇩' },
  ta: { name: 'Tamil',    flag: '🏴' },
  te: { name: 'Telugu',   flag: '🏴' },
  kn: { name: 'Kannada',  flag: '🏴' },
  mr: { name: 'Marathi',  flag: '🏴' },
  gu: { name: 'Gujarati', flag: '🏴' },
  pa: { name: 'Punjabi',  flag: '🏴' },
  as: { name: 'Assamese', flag: '🏴' },
}

export const LANG_CODES = Object.keys(LANGUAGES)

export const TTS_VOICES: Record<string, string> = {
  en: 'en-US-AriaNeural',
  hi: 'hi-IN-SwaraNeural',
  bn: 'bn-IN-TanishaaNeural',
  ta: 'ta-IN-PallaviNeural',
  te: 'te-IN-ShrutiNeural',
  kn: 'kn-IN-SapnaNeural',
  mr: 'mr-IN-AarohiNeural',
  gu: 'gu-IN-DhwaniNeural',
  pa: 'pa-IN-GurpreetNeural',
  // 'as' intentionally omitted — no Microsoft neural voice for Assamese
}

export const DOC_LABELS: Record<DocType, string> = {
  blood:     '🩸 Blood Report',
  medical:   '📄 Medical Document',
  insurance: '🏥 Insurance Claim',
}
