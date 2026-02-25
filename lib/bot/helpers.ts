import { Bot, InlineKeyboard } from 'grammy'
import {
  analyzeBloodReportBuffer,
  analyzeMedicalDocumentBuffer,
} from '../actions.ts'
import { type DocType, LANGUAGES, LANG_CODES } from './config.ts'

// ─────────────────────────────────────────────────────────────────────────────
// HTML helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Escape characters that break Telegram's HTML parse mode. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Strip markdown bold/italic markers that Gemini may emit (* ** _ __). */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*{1,3}([^*\n]+?)\*{1,3}/g, '$1')
    .replace(/_{1,2}([^_\n]+?)_{1,2}/g, '$1')
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline keyboard builders
// ─────────────────────────────────────────────────────────────────────────────

/** 3-column language picker keyboard. */
export function buildLangKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard()
  const entries = Object.entries(LANGUAGES)
  for (let i = 0; i < entries.length; i++) {
    const [code, { name, flag }] = entries[i]
    kb.text(`${flag} ${name}`, `setlang:${code}`)
    if ((i + 1) % 3 === 0) kb.row()
  }
  return kb
}

/** Document type selector keyboard (shown after every file upload). */
export function buildDocTypeKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🩸 Blood Report',      'doctype:blood').row()
    .text('📄 Medical Document', 'doctype:medical').row()
    .text('🏥 Insurance Claim',  'doctype:insurance')
}

/** Post-analysis action keyboard. */
export function buildPostAnalysisKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🔊 Get Audio',          'action:audio')
    .text('💬 Follow-up question', 'action:followup')
    .row()
    .text('📋 Compare with older report', 'action:prevreport')
}

// ─────────────────────────────────────────────────────────────────────────────
// File downloader
// ─────────────────────────────────────────────────────────────────────────────

export async function downloadTelegramFile(
  bot: Bot,
  fileId: string,
  hintMime?: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const file = await bot.api.getFile(fileId)
  const filePath = file.file_path
  if (!filePath) throw new Error('Telegram did not return a file_path')

  const token = process.env.BOT_TOKEN!
  const url   = `https://api.telegram.org/file/bot${token}/${filePath}`
  const res   = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download file (${res.status})`)

  const buffer = Buffer.from(await res.arrayBuffer())
  if (hintMime) return { buffer, mimeType: hintMime }

  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  const MIME: Record<string, string> = {
    pdf:  'application/pdf',
    png:  'image/png',
    jpg:  'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
  }
  return { buffer, mimeType: MIME[ext] ?? 'application/octet-stream' }
}

// ─────────────────────────────────────────────────────────────────────────────
// Analysis dispatcher
// ─────────────────────────────────────────────────────────────────────────────

export async function runAnalysis(
  buffer: Buffer,
  mimeType: string,
  docType: DocType,
  lang: string,
): Promise<{ success: boolean; analysis?: string; error?: string }> {
  if (docType === 'blood')   return analyzeBloodReportBuffer(buffer, mimeType, lang)
  if (docType === 'medical') return analyzeMedicalDocumentBuffer(buffer, mimeType, lang)
  // 'insurance' is handled by the two-step sendInsurancePair flow — never reaches here
  throw new Error(`runAnalysis called with unsupported docType: ${docType}`)
}
