/**
 * Telegram Bot — Med-Clarity
 *
 * Features:
 *  • /start     — welcome message
 *  • /help      — command list
 *  • /setlang   — pick preferred language (inline keyboard or arg)
 *  • /lang      — show current language
 *  • /stop      — clear session state
 *  • Send photo or PDF → asks what type of document → analyses it
 *
 * Document types supported:
 *  🩸 Blood Report       — explains test results in plain language
 *  📄 Medical Document  — explains prescriptions, discharge summaries, etc.
 *  🏥 Insurance Claim   — audits insurance claim coverage
 *
 * Architecture notes:
 *  • The bot asks for document type BEFORE analysing — no premature Gemini calls.
 *  • File resolution is STATELESS: the "What type?" message is a reply to the
 *    user's file message — the callback handler walks reply_to_message to recover
 *    the file. This works in both long-polling (dev) and webhook/serverless (prod).
 *  • Language preference is per-user in a module-level Map that survives within a
 *    process (polling). In production (serverless cold starts) it resets to English.
 *    Replace with Upstash Redis / Vercel KV for true persistence.
 *  • After each analysis an inline keyboard offers: 🔊 Get Audio (on-demand TTS),
 *    💬 Follow-up question, and 📋 Previous report (if one exists in the session).
 */

import { Bot, InlineKeyboard, InputFile } from 'grammy'
import {
  analyzeBloodReportBuffer,
  analyzeMedicalDocumentBuffer,
  analyzeMedicalInsuranceBuffer,
  answerFollowUpQuestion,
  compareReports,
} from './actions.ts'

// ─────────────────────────────────────────────────────────────────────────────
// Language config
// ─────────────────────────────────────────────────────────────────────────────

interface LangConfig {
  name: string
  flag: string
}

const LANGUAGES: Record<string, LangConfig> = {
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

const LANG_CODES = Object.keys(LANGUAGES)

// ─────────────────────────────────────────────────────────────────────────────
// In-memory language store  (userId → lang code)
// Replace with Upstash Redis / Vercel KV for persistence across cold starts
// ─────────────────────────────────────────────────────────────────────────────

const userLangStore = new Map<number, string>()

function getUserLang(userId: number): string {
  return userLangStore.get(userId) ?? 'en'
}

function setUserLang(userId: number, lang: string): void {
  if (LANG_CODES.includes(lang)) userLangStore.set(userId, lang)
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-user session state
// context = compact analysis text (~400-600 chars) — follow-up sends this as
// plain text to Flash with the user's question; comparison sends 1 new image
// plus this text. Both paths are cheap: no second image re-analysis.
// Replace Map with Upstash Redis / Vercel KV for cross-cold-start persistence.
// ─────────────────────────────────────────────────────────────────────────────

interface AnalysisRecord {
  docType: DocType
  text: string      // the emitted analysis bullets — already concise
  timestamp: number
}

interface UserSession {
  awaitingFollowUp: boolean    // next text message → follow-up Q&A
  pendingComparison: boolean   // next file upload → comparison analysis
  lastAnalysis?: AnalysisRecord
  previousAnalysis?: AnalysisRecord  // the analysis prior to the latest one
}

const sessions = new Map<number, UserSession>()

function getSession(userId: number): UserSession {
  if (!sessions.has(userId)) {
    sessions.set(userId, { awaitingFollowUp: false, pendingComparison: false })
  }
  return sessions.get(userId)!
}

// ─────────────────────────────────────────────────────────────────────────────
// TTS helpers (Assamese omitted — no edge-tts neural voice exists)
// /api/tts → Next.js route → edge-tts (spawn). Dev: localhost:3000. Prod: Vercel.
// ─────────────────────────────────────────────────────────────────────────────

const TTS_VOICES: Record<string, string> = {
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

function getBaseUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

/** Strip traffic-light emoji and HTML so edge-tts reads clean prose. */
function prepareForTts(text: string): string {
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
async function fetchTtsAudio(text: string, lang: string): Promise<Buffer | null> {
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

// ─────────────────────────────────────────────────────────────────────────────
// HTML helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Escape characters that break Telegram's HTML parse mode. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline keyboard builders
// ─────────────────────────────────────────────────────────────────────────────

/** 3-column language picker keyboard. */
function buildLangKeyboard(): InlineKeyboard {
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
function buildDocTypeKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🩸 Blood Report',      'doctype:blood').row()
    .text('📄 Medical Document', 'doctype:medical').row()
    .text('🏥 Insurance Claim',  'doctype:insurance')
}

/**
 * Post-analysis action keyboard.
 * Always shows all three options after blood/medical analysis.
 */
function buildPostAnalysisKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🔊 Get Audio',          'action:audio')
    .text('💬 Follow-up question', 'action:followup')
    .row()
    .text('📋 Compare with older report', 'action:prevreport')
}

// ─────────────────────────────────────────────────────────────────────────────
// File downloader
// ─────────────────────────────────────────────────────────────────────────────

async function downloadTelegramFile(
  bot: Bot,
  fileId: string,
  hintMime?: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const file = await bot.api.getFile(fileId)
  const filePath = file.file_path
  if (!filePath) throw new Error('Telegram did not return a file_path')

  const token = process.env.BOT_TOKEN!
  const url = `https://api.telegram.org/file/bot${token}/${filePath}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download file (${res.status})`)

  const ab = await res.arrayBuffer()
  const buffer = Buffer.from(ab)

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

type DocType = 'blood' | 'medical' | 'insurance'

const DOC_LABELS: Record<DocType, string> = {
  blood:     '🩸 Blood Report',
  medical:   '📄 Medical Document',
  insurance: '🏥 Insurance Claim',
}

async function runAnalysis(
  buffer: Buffer,
  mimeType: string,
  docType: DocType,
  lang: string,
): Promise<{ success: boolean; analysis?: string; error?: string }> {
  if (docType === 'blood')     return analyzeBloodReportBuffer(buffer, mimeType, lang)
  if (docType === 'medical')   return analyzeMedicalDocumentBuffer(buffer, mimeType, lang)
  return analyzeMedicalInsuranceBuffer(buffer, mimeType)
}

// ─────────────────────────────────────────────────────────────────────────────
// Bot factory
// ─────────────────────────────────────────────────────────────────────────────

export function createBot(): Bot {
  const token = process.env.BOT_TOKEN
  if (!token) throw new Error('BOT_TOKEN environment variable is not set')

  const bot = new Bot(token)

  // ── /start ────────────────────────────────────────────────────────────────
  bot.command('start', async (ctx) => {
    const name = ctx.from?.first_name ?? 'there'
    await ctx.reply(
      `👋 Hi <b>${name}</b>! I'm <b>Med-Clarity</b> — your AI medical document assistant.\n\n` +
      `📎 <b>What I can analyse:</b>\n` +
      `  🩸 Blood test reports\n` +
      `  📄 Medical documents (prescriptions, discharge summaries, etc.)\n` +
      `  🏥 Insurance claims\n\n` +
      `Just send a <b>photo</b> or <b>PDF</b> and I'll ask what kind it is before analysing.\n\n` +
      `🌐 Default language: <b>English</b> — use /setlang to change.\n` +
      `Type /help for all commands.`,
      { parse_mode: 'HTML' },
    )
  })

  // ── /help ─────────────────────────────────────────────────────────────────
  bot.command('help', async (ctx) => {
    await ctx.reply(
      `<b>📋 Med-Clarity — Commands</b>\n\n` +
      `/start      — Welcome message\n` +
      `/setlang   — Choose response language\n` +
      `/lang       — Show your current language\n` +
      `/stop       — Clear your session state\n` +
      `/help       — This help message\n\n` +
      `<b>📎 How to use</b>\n` +
      `Send a <b>photo</b> or <b>document (PDF/image)</b>.\n` +
      `I'll ask what type it is, then analyse it.\n\n` +
      `<b>After each analysis you can:</b>\n` +
      `  💬 Ask a follow-up question about your report\n` +
      `  📈 Compare with a previous report to see what changed\n` +
      `  🔊 Receive an audio summary\n\n` +
      `<i>⚠ This bot does not provide medical advice.</i>`,
      { parse_mode: 'HTML' },
    )
  })

  // ── /lang ─────────────────────────────────────────────────────────────────
  bot.command('lang', async (ctx) => {
    const userId = ctx.from?.id
    if (!userId) return
    const lang = getUserLang(userId)
    const { name, flag } = LANGUAGES[lang]
    await ctx.reply(
      `🌐 Your current language is <b>${flag} ${name}</b>.\nUse /setlang to change it.`,
      { parse_mode: 'HTML' },
    )
  })

  // ── /setlang [code] ───────────────────────────────────────────────────────
  bot.command('setlang', async (ctx) => {
    const userId = ctx.from?.id
    if (!userId) return
    const arg = ctx.match?.trim().toLowerCase()
    if (arg && LANG_CODES.includes(arg)) {
      setUserLang(userId, arg)
      const { name, flag } = LANGUAGES[arg]
      await ctx.reply(`✅ Language set to <b>${flag} ${name}</b>.`, { parse_mode: 'HTML' })
      return
    }
    await ctx.reply(
      '🌐 <b>Choose your preferred language</b>\n<i>This affects blood report and medical document analysis.</i>',
      { parse_mode: 'HTML', reply_markup: buildLangKeyboard() },
    )
  })

  // ── /stop ─────────────────────────────────────────────────────────────────
  bot.command('stop', async (ctx) => {
    const userId = ctx.from?.id
    if (userId) {
      const s = getSession(userId)
      s.awaitingFollowUp = false
      s.pendingComparison = false
    }
    await ctx.reply(
      `✋ Session cleared. Send a new document any time to start again.\n\nUse /help to see all commands.`,
    )
  })

  // ── Inline keyboard: language selection ───────────────────────────────────
  bot.callbackQuery(/^setlang:(.+)$/, async (ctx) => {
    const userId = ctx.from.id
    const lang = ctx.match[1]
    if (!LANG_CODES.includes(lang)) {
      await ctx.answerCallbackQuery({ text: '⚠ Unknown language' }).catch(() => null)
      return
    }
    setUserLang(userId, lang)
    const { name, flag } = LANGUAGES[lang]
    await ctx.answerCallbackQuery({ text: `✅ Language set to ${flag} ${name}` }).catch(() => null)
    await ctx.editMessageText(
      `✅ Language set to <b>${flag} ${name}</b>.`,
      { parse_mode: 'HTML' },
    )
  })

  // ── Inline keyboard: document type selected ───────────────────────────────
  //
  // STATELESS: the bot's "What type?" message is a REPLY to the user's file.
  // reply_to_message recovers the file — works for concurrent users & serverless.
  //
  bot.callbackQuery(/^doctype:(blood|medical|insurance)$/, async (ctx) => {
    const userId = ctx.from.id
    const docType = ctx.match[1] as DocType
    const label = DOC_LABELS[docType]

    await ctx.answerCallbackQuery({ text: `Analysing as ${label}…` }).catch(() => null)

    // Recover original file from reply_to_message
    const originalMsg = ctx.callbackQuery.message?.reply_to_message
    if (!originalMsg) {
      await ctx.editMessageText('⚠ Original file not found. Please send it again.').catch(() => null)
      return
    }

    let fileId: string
    let hintMime: string | undefined
    if ('photo' in originalMsg && originalMsg.photo?.length) {
      fileId = originalMsg.photo[originalMsg.photo.length - 1].file_id
      hintMime = 'image/jpeg'
    } else if ('document' in originalMsg && originalMsg.document) {
      fileId = originalMsg.document.file_id
      hintMime = originalMsg.document.mime_type ?? undefined
    } else {
      await ctx.editMessageText('⚠ No file found. Please send the document again.').catch(() => null)
      return
    }

    const lang = getUserLang(userId)
    const chatId = ctx.chat!.id
    const progMsgId = ctx.callbackQuery.message!.message_id

    // Reuse the "What type?" message as the animated progress indicator
    await ctx.editMessageText(`📨 Receiving your document…`).catch(() => null)
    await sendAnalysis(ctx, userId, fileId, hintMime, docType, lang, chatId, progMsgId)
  })

  // ── Inline: follow-up question ──────────────────────────────────────────
  // ── Inline: get audio ─────────────────────────────────────────────────
  bot.callbackQuery('action:audio', async (ctx) => {
    const userId = ctx.from.id
    const session = getSession(userId)
    if (!session.lastAnalysis) {
      await ctx.answerCallbackQuery({ text: '⚠ No recent analysis to read aloud' }).catch(() => null)
      return
    }
    const lang = getUserLang(userId)
    if (!TTS_VOICES[lang]) {
      await ctx.answerCallbackQuery({ text: '⚠ Audio not available for your language' }).catch(() => null)
      return
    }
    await ctx.answerCallbackQuery({ text: '🔊 Generating audio…' }).catch(() => null)
    const chatId = ctx.chat!.id
    const gen = await bot.api.sendMessage(chatId, '🔊 Generating audio summary…')
    try {
      const audioBuffer = await fetchTtsAudio(session.lastAnalysis.text, lang)
      await bot.api.deleteMessage(chatId, gen.message_id).catch(() => null)
      if (!audioBuffer) {
        await bot.api.sendMessage(chatId, '⚠ Audio generation failed. Please try again.')
        return
      }
      await bot.api.sendVoice(
        chatId,
        new InputFile(audioBuffer, `report_${lang}.mp3`),
      )
    } catch (err) {
      console.error('[Bot] action:audio error:', err)
      await bot.api.deleteMessage(chatId, gen.message_id).catch(() => null)
      await bot.api.sendMessage(chatId, '⚠ Audio generation failed. Please try again.')
    }
  })

  // ── Inline: follow-up question ──────────────────────────────────────────
  bot.callbackQuery('action:followup', async (ctx) => {
    const userId = ctx.from.id
    const session = getSession(userId)
    if (!session.lastAnalysis) {
      await ctx.answerCallbackQuery({ text: '⚠ No recent analysis to ask about' }).catch(() => null)
      return
    }
    session.awaitingFollowUp = true
    await ctx.answerCallbackQuery().catch(() => null)
    await ctx.reply(
      `💬 <b>Ask your follow-up question</b>\n<i>Type anything about your last report and I'll answer based on it.</i>`,
      { parse_mode: 'HTML' },
    )
  })

  // ── Inline: show previous report ──────────────────────────────────────
  bot.callbackQuery('action:prevreport', async (ctx) => {
    const userId = ctx.from.id
    const session = getSession(userId)
    if (!session.lastAnalysis) {
      await ctx.answerCallbackQuery({ text: '⚠ No recent analysis to compare against' }).catch(() => null)
      return
    }
    if (session.lastAnalysis.docType === 'insurance') {
      await ctx.answerCallbackQuery({ text: '⚠ Comparison not available for insurance documents' }).catch(() => null)
      return
    }
    session.pendingComparison = true
    await ctx.answerCallbackQuery().catch(() => null)
    await ctx.reply(
      `📋 <b>Send your older report</b> (photo or PDF).\n` +
      `I'll compare it against your latest analysis to show what has improved or worsened.`,
      { parse_mode: 'HTML' },
    )
  })

  // ── Inline: compare reports (legacy — kept for any old keyboard messages) ───────
  bot.callbackQuery('action:compare', async (ctx) => {
    const userId = ctx.from.id
    const session = getSession(userId)
    if (!session.lastAnalysis) {
      await ctx.answerCallbackQuery({ text: '⚠ No recent analysis to compare against' }).catch(() => null)
      return
    }
    if (session.lastAnalysis.docType === 'insurance') {
      await ctx.answerCallbackQuery({ text: '⚠ Comparison not available for insurance documents' }).catch(() => null)
      return
    }
    session.pendingComparison = true
    await ctx.answerCallbackQuery().catch(() => null)
    await ctx.reply(
      `� <b>Send your older report</b> (photo or PDF).\n` +
      `I'll compare it against your latest analysis to show what has improved or worsened.`,
      { parse_mode: 'HTML' },
    )
  })

  // ── Photo handler ─────────────────────────────────────────────────────────
  bot.on('message:photo', async (ctx) => {
    const userId = ctx.from?.id
    if (!userId) return
    const session = getSession(userId)
    const photos = ctx.message.photo
    const fileId = photos[photos.length - 1].file_id

    if (session.pendingComparison && session.lastAnalysis) {
      session.pendingComparison = false
      await sendComparison(ctx, userId, fileId, 'image/jpeg', session.lastAnalysis)
      return
    }

    await ctx.reply(
      `📎 <b>Got your image!</b>\n\nWhat type of document is this?`,
      {
        parse_mode: 'HTML',
        reply_markup: buildDocTypeKeyboard(),
        reply_parameters: { message_id: ctx.message.message_id },
      },
    )
  })

  // ── Document handler ──────────────────────────────────────────────────────
  bot.on('message:document', async (ctx) => {
    const userId = ctx.from?.id
    if (!userId) return
    const doc = ctx.message.document
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowed.includes(doc.mime_type ?? '')) {
      await ctx.reply(
        `⚠️ Unsupported file type (<code>${doc.mime_type ?? 'unknown'}</code>).\n` +
        `Please send a <b>PDF</b> or <b>image (JPEG, PNG, WebP)</b>.`,
        { parse_mode: 'HTML' },
      )
      return
    }

    const session = getSession(userId)
    if (session.pendingComparison && session.lastAnalysis) {
      session.pendingComparison = false
      await sendComparison(ctx, userId, doc.file_id, doc.mime_type ?? undefined, session.lastAnalysis)
      return
    }

    await ctx.reply(
      `📎 <b>Got your document!</b>\n\nWhat type of document is this?`,
      {
        parse_mode: 'HTML',
        reply_markup: buildDocTypeKeyboard(),
        reply_parameters: { message_id: ctx.message.message_id },
      },
    )
  })

  // ── Plain text — check follow-up first ──────────────────────────────────
  bot.on('message:text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) return
    const userId = ctx.from?.id
    if (!userId) return
    const session = getSession(userId)

    if (session.awaitingFollowUp && session.lastAnalysis) {
      session.awaitingFollowUp = false
      await sendFollowUp(ctx, userId, ctx.message.text.trim(), session.lastAnalysis)
      return
    }

    await ctx.reply(
      `📎 Send me a <b>photo</b> or <b>document (PDF / image)</b> and I'll analyse it.\n\n` +
      `Use /setlang to change the response language, or /help for all commands.`,
      { parse_mode: 'HTML' },
    )
  })

  // ── Error handler ─────────────────────────────────────────────────────────
  bot.catch((err) => {
    const ctx = err.ctx
    console.error(`[Bot] Unhandled error for update ${ctx.update.update_id}:`, err.error)
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Inner helpers (closures over `bot`)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Full analysis pipeline:
   * 1. Animated progress (edit the existing message in-place through 3 stages)
   * 2. Download file from Telegram CDN
   * 3. Gemini analysis
   * 4. 🚨 Critical alert — regex check for 🔴, zero extra API calls
   * 5. Send text result (chunked if > 4096 chars)
   * 6. Store compact context for follow-up / comparison
   * 7. Post-analysis keyboard (follow-up + compare) for blood/medical
   * 8. TTS audio — generated after text is delivered so the user
   *    already has the result while the audio renders
   */
  async function sendAnalysis(
    ctx: any,
    userId: number,
    fileId: string,
    hintMime: string | undefined,
    docType: DocType,
    lang: string,
    chatId: number,
    progressMsgId?: number,
  ) {
    const label = DOC_LABELS[docType]
    const { name: langName, flag } = LANGUAGES[lang]
    const langDisplay = docType === 'insurance' ? '' : ` <i>(${flag} ${langName})</i>`

    // If we have an existing message to reuse as progress indicator, use it;
    // otherwise send a fresh one.
    let progMsgId: number
    const editProg = (text: string) =>
      bot.api.editMessageText(chatId, progMsgId, text, { parse_mode: 'HTML' }).catch(() => null)

    if (progressMsgId) {
      progMsgId = progressMsgId
    } else {
      const m = await bot.api.sendMessage(chatId, `📨 Receiving your document…`)
      progMsgId = m.message_id
    }

    try {
      await editProg(`🧠 Analysing your <b>${label}</b>${langDisplay}…`)
      const { buffer, mimeType } = await downloadTelegramFile(bot, fileId, hintMime)
      await editProg(`🔬 Reading report with Gemini AI…`)
      const { success, analysis, error } = await runAnalysis(buffer, mimeType, docType, lang)

      await bot.api.deleteMessage(chatId, progMsgId).catch(() => null)

      if (!success || !analysis) {
        await bot.api.sendMessage(chatId, `❌ Analysis failed: ${error ?? 'Unknown error. Please try again.'}`)
        return
      }

      // 🚨 Critical alert — instant regex, no extra Gemini call
      if (analysis.includes('🔴')) {
        await bot.api.sendMessage(
          chatId,
          `🚨 <b>URGENT FINDING DETECTED</b>\n` +
          `One or more values in your report need prompt attention. Please contact your doctor.`,
          { parse_mode: 'HTML' },
        )
      }

      // Send text (chunked if > 4096 chars)
      const safeAnalysis = escapeHtml(analysis)
      const header = `<b>${label} Analysis</b>${langDisplay}\n\n`
      const MAX = 4096
      const fullText = header + safeAnalysis
      if (fullText.length <= MAX) {
        await bot.api.sendMessage(chatId, fullText, { parse_mode: 'HTML' })
      } else {
        const chunkSize = MAX - header.length
        let remaining = safeAnalysis
        let first = true
        while (remaining.length > 0) {
          const chunk = remaining.slice(0, chunkSize)
          remaining = remaining.slice(chunkSize)
          await bot.api.sendMessage(chatId, first ? header + chunk : chunk, { parse_mode: 'HTML' })
          first = false
        }
      }

      // Store compact context for follow-up / comparison
      const session = getSession(userId)
      session.previousAnalysis = session.lastAnalysis   // shift current → previous
      session.lastAnalysis = { docType, text: analysis, timestamp: Date.now() }
      session.awaitingFollowUp = false
      session.pendingComparison = false

      // Post-analysis keyboard for blood and medical (not insurance)
      if (docType !== 'insurance') {
        await bot.api.sendMessage(
          chatId,
          `💡 <b>What would you like to do next?</b>`,
          {
            parse_mode: 'HTML',
            reply_markup: buildPostAnalysisKeyboard(),
          },
        )
      }
    } catch (err) {
      console.error(`[Bot] sendAnalysis error (userId=${userId}, type=${docType}):`, err)
      await bot.api.deleteMessage(chatId, progMsgId).catch(() => null)
      await bot.api.sendMessage(chatId, '❌ Something went wrong. Please try again.')
    }
  }

  /**
   * Comparison pipeline.
   * Token-efficient: only 1 NEW image is sent to Gemini.
   * The previous report is passed as compact text (the stored analysis bullets,
   * ~400-600 chars ≈ 100-150 tokens) — no re-processing of the old image.
   */
  async function sendComparison(
    ctx: any,
    userId: number,
    fileId: string,
    hintMime: string | undefined,
    prev: AnalysisRecord,
  ) {
    const lang = getUserLang(userId)
    const { name: langName, flag } = LANGUAGES[lang]
    const chatId: number = ctx.chat!.id

    const prog = await bot.api.sendMessage(chatId, `📨 Receiving report…`)
    const editProg = (text: string) =>
      bot.api.editMessageText(chatId, prog.message_id, text, { parse_mode: 'HTML' }).catch(() => null)

    try {
      await editProg(`🧠 Comparing with your previous ${DOC_LABELS[prev.docType]}…`)
      const { buffer, mimeType } = await downloadTelegramFile(bot, fileId, hintMime)
      await editProg(`🔬 Finding what changed…`)
      const result = await compareReports(
        buffer, mimeType, prev.text, prev.docType as 'blood' | 'medical', lang,
      )

      await bot.api.deleteMessage(chatId, prog.message_id).catch(() => null)

      if (!result.success || !result.analysis) {
        await bot.api.sendMessage(chatId, `❌ Comparison failed: ${result.error ?? 'Please try again.'}`)
        return
      }

      await bot.api.sendMessage(
        chatId,
        `<b>� Progress Report</b> <i>(${flag} ${langName})</i>\n<i>Older report vs your latest results</i>\n\n${escapeHtml(result.analysis)}`,
        { parse_mode: 'HTML' },
      )

      // Update context to the newest result
      const session = getSession(userId)
      session.previousAnalysis = session.lastAnalysis   // shift current → previous
      session.lastAnalysis = { docType: prev.docType, text: result.analysis, timestamp: Date.now() }

      await bot.api.sendMessage(
        chatId,
        `💡 <b>What would you like to do next?</b>`,
        {
          parse_mode: 'HTML',
          reply_markup: buildPostAnalysisKeyboard(),
        },
      )
    } catch (err) {
      console.error(`[Bot] sendComparison error (userId=${userId}):`, err)
      await bot.api.deleteMessage(chatId, prog.message_id).catch(() => null)
      await bot.api.sendMessage(chatId, '❌ Comparison failed. Please try again.')
    }
  }

  /**
   * Follow-up Q&A pipeline.
   * Text-only Gemini Flash call — no image resent.
   * Input: stored analysis text (~400-600 chars) + user question.
   * Total: ~600 input tokens. Fast and cheap.
   */
  async function sendFollowUp(
    ctx: any,
    userId: number,
    question: string,
    prev: AnalysisRecord,
  ) {
    if (!question) {
      await ctx.reply('Please type your question.')
      return
    }
    const lang = getUserLang(userId)
    const chatId: number = ctx.chat!.id
    const typing = await bot.api.sendMessage(chatId, `💭 Looking that up…`)

    try {
      const { success, answer, error } = await answerFollowUpQuestion(prev.text, question, lang)
      await bot.api.deleteMessage(chatId, typing.message_id).catch(() => null)

      if (!success || !answer) {
        await bot.api.sendMessage(chatId, `❌ Could not answer: ${error ?? 'Please try again.'}`)
        return
      }

      await bot.api.sendMessage(
        chatId,
        `💬 <b>Follow-up Answer</b>\n\n${escapeHtml(answer)}`,
        { parse_mode: 'HTML' },
      )

      // Re-show keyboard so user can keep asking
      const session = getSession(userId)
      if (session.lastAnalysis) {
        await bot.api.sendMessage(
          chatId,
          `💡 <b>Anything else?</b>`,
          {
            parse_mode: 'HTML',
            reply_markup: buildPostAnalysisKeyboard(),
          },
        )
      }
    } catch (err) {
      console.error(`[Bot] sendFollowUp error (userId=${userId}):`, err)
      await bot.api.deleteMessage(chatId, typing.message_id).catch(() => null)
      await bot.api.sendMessage(chatId, '❌ Something went wrong. Please try again.')
    }
  }

  return bot
}
