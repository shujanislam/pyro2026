import { type DocType, LANG_CODES } from './config.ts'

// ─────────────────────────────────────────────────────────────────────────────
// Per-user language store (userId → lang code)
// Replace with Upstash Redis / Vercel KV for persistence across cold starts.
// ─────────────────────────────────────────────────────────────────────────────

const userLangStore = new Map<number, string>()

export function getUserLang(userId: number): string {
  return userLangStore.get(userId) ?? 'en'
}

export function setUserLang(userId: number, lang: string): void {
  if (LANG_CODES.includes(lang)) userLangStore.set(userId, lang)
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-user session state
// context = compact analysis text (~400-600 chars) — follow-up sends this as
// plain text to Flash; comparison sends 1 new image plus this text.
// Both paths are cheap: no second image re-analysis.
// Replace Map with Upstash Redis / Vercel KV for cross-cold-start persistence.
// ─────────────────────────────────────────────────────────────────────────────

export interface AnalysisRecord {
  docType: DocType
  text: string      // emitted analysis bullets — already concise
  timestamp: number
}

export interface UserSession {
  awaitingFollowUp: boolean    // next text message → follow-up Q&A
  pendingComparison: boolean   // next file upload → comparison analysis
  pendingInsuranceDoc?: { fileId: string; mimeType: string }  // first insurance file ref — waiting for the second
  lastAnalysis?: AnalysisRecord
  previousAnalysis?: AnalysisRecord  // analysis prior to the latest one
}

const sessions = new Map<number, UserSession>()

export function getSession(userId: number): UserSession {
  if (!sessions.has(userId)) {
    sessions.set(userId, { awaitingFollowUp: false, pendingComparison: false })
  }
  return sessions.get(userId)!
}
