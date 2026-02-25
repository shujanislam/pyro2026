/**
 * Telegram Bot — Blood Report Analyser
 *
 * Features:
 *  • /start  — welcome & quick guide
 *  • /help   — command list
 *  • /setlang — pick preferred language (inline keyboard or arg)
 *  • /lang   — show current language
 *  • Send any photo or PDF document → blood-report analysis (text + MP3 audio)
 *
 * Language preference is stored in a module-level Map.
 * On a Vercel cold start the Map is empty and users default to English.
 * For persistence across cold starts, replace the Map with a KV store
 * (e.g. Upstash Redis / Vercel KV).
 *
 * TTS: edge-tts via the internal /api/tts endpoint (ElevenLabs is excluded
 * because its free tier blocks server-to-server calls).
 * Assamese has no Microsoft neural voice — a (en) fallback is used with a note.
 */

import { Bot, Context, InlineKeyboard, InputFile } from 'grammy'
import { analyzeBloodReportBuffer } from './actions'

// ─────────────────────────────────────────────────────────────────────────────
// Language config
// ─────────────────────────────────────────────────────────────────────────────

interface LangConfig {
  name: string
  voice: string | null   // null = no native edge-tts voice
  flag: string
}

const LANGUAGES: Record<string, LangConfig> = {
  en: { name: 'English',    voice: 'en-US-AriaNeural',    flag: '🇬🇧' },
  hi: { name: 'Hindi',      voice: 'hi-IN-SwaraNeural',   flag: '🇮🇳' },
  bn: { name: 'Bengali',    voice: 'bn-IN-TanishaaNeural',flag: '🇧🇩' },
  ta: { name: 'Tamil',      voice: 'ta-IN-PallaviNeural', flag: '🏴' },
  te: { name: 'Telugu',     voice: 'te-IN-ShrutiNeural',  flag: '🏴' },
  kn: { name: 'Kannada',    voice: 'kn-IN-SapnaNeural',   flag: '🏴' },
  mr: { name: 'Marathi',    voice: 'mr-IN-AarohiNeural',  flag: '🏴' },
  gu: { name: 'Gujarati',   voice: 'gu-IN-DhwaniNeural',  flag: '🏴' },
  pa: { name: 'Punjabi',    voice: 'pa-IN-GurpreetNeural',flag: '🏴' },
  as: { name: 'Assamese',   voice: null,                   flag: '🏴' },
}

const LANG_CODES = Object.keys(LANGUAGES)

// ─────────────────────────────────────────────────────────────────────────────
// In-memory language store (userId → lang code)
// Replace with a KV store for persistence across cold starts
// ─────────────────────────────────────────────────────────────────────────────

const userLangStore = new Map<number, string>()

function getUserLang(userId: number): string {
  return userLangStore.get(userId) ?? 'en'
}

function setUserLang(userId: number, lang: string): void {
  if (LANG_CODES.includes(lang)) userLangStore.set(userId, lang)
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Build a 3-column inline keyboard for language selection. */
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

/** Strip basic markdown (*bold*, _italic_, `code`, #headings) for TTS. */
function stripMarkdown(text: string): string {
  return text
    .replace(/^#+\s+/gm, '')
    .replace(/\*{1,3}(.+?)\*{1,3}/g, '$1')
    .replace(/_{1,3}(.+?)_{1,3}/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Truncate to a safe TTS length (avoid huge audio files). */
const TTS_MAX_CHARS = 1200

/** Base URL for internal API calls — resolved from env variables. */
function getBaseUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

/** Call the internal /api/tts endpoint and return the MP3 Buffer, or null on failure. */
async function fetchTtsBuffer(text: string, lang: string): Promise<Buffer | null> {
  const config = LANGUAGES[lang]
  const voice = config?.voice ?? LANGUAGES.en.voice!

  // Assamese has no native voice — fall back silently
  const ttsLang = config?.voice ? lang : 'en'

  const cleanText = stripMarkdown(text).slice(0, TTS_MAX_CHARS)
  if (!cleanText) return null

  try {
    const res = await fetch(`${getBaseUrl()}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleanText, voice }),
    })
    if (!res.ok) {
      console.error(`[TTS] /api/tts responded ${res.status} for lang=${ttsLang}`)
      return null
    }
    const ab = await res.arrayBuffer()
    return Buffer.from(ab)
  } catch (err) {
    console.error('[TTS] fetch error:', err)
    return null
  }
}

/** Download a Telegram file and return it as a Buffer. */
async function fetchTelegramFile(
  bot: Bot,
  fileId: string,
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

  // Determine MIME type from extension
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  const MIME: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
  }
  const mimeType = MIME[ext] ?? 'application/octet-stream'
  return { buffer, mimeType }
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
      `👋 Hi <b>${name}</b>! I can analyse your <b>blood test reports</b> and explain them in plain language.\n\n` +
      `📎 Just send me a photo or PDF of your blood report and I'll explain what each result means — in your own language.\n\n` +
      `🌐 Default language: <b>English</b>. Use /setlang to change it.\n\n` +
      `Type /help for all commands.`,
      { parse_mode: 'HTML' },
    )
  })

  // ── /help ─────────────────────────────────────────────────────────────────
  bot.command('help', async (ctx) => {
    await ctx.reply(
      `<b>📋 Available commands</b>\n\n` +
      `/start — Welcome message\n` +
      `/setlang — Choose your language (inline keyboard)\n` +
      `/lang — Show your current language\n` +
      `/help — This help message\n\n` +
      `<b>📎 How to analyse a blood report</b>\n` +
      `Send a <b>photo</b> or <b>document (PDF/image)</b> of your blood report. ` +
      `I will send back a plain-language explanation and an audio version.\n\n` +
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
    await ctx.reply(`🌐 Your current language is <b>${flag} ${name}</b>.\nUse /setlang to change it.`, {
      parse_mode: 'HTML',
    })
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
      '🌐 <b>Choose your language</b>',
      { parse_mode: 'HTML', reply_markup: buildLangKeyboard() },
    )
  })

  // ── Inline keyboard callback for language selection ───────────────────────
  bot.callbackQuery(/^setlang:(.+)$/, async (ctx) => {
    const userId = ctx.from.id
    const lang = ctx.match[1]
    if (!LANG_CODES.includes(lang)) {
      await ctx.answerCallbackQuery({ text: 'Unknown language' })
      return
    }
    setUserLang(userId, lang)
    const { name, flag } = LANGUAGES[lang]
    await ctx.answerCallbackQuery({ text: `Language set to ${flag} ${name}` })
    await ctx.editMessageText(`✅ Language set to <b>${flag} ${name}</b>.`, { parse_mode: 'HTML' })
  })

  // ── Blood report handler (photo or document) ──────────────────────────────
  async function handleReport(
    ctx: Context,
    fileId: string,
    isPhoto: boolean,
  ) {
    const userId = ctx.from?.id
    if (!userId) return
    const lang = getUserLang(userId)
    const { name: langName, flag, voice } = LANGUAGES[lang]

    const thinkingMsg = await ctx.reply(
      `🔬 Analysing your blood report in <b>${flag} ${langName}</b>… Please wait.`,
      { parse_mode: 'HTML' },
    )

    try {
      // 1. Download the file
      const mimeType = isPhoto ? 'image/jpeg' : undefined
      let buffer: Buffer
      let resolvedMime: string

      if (isPhoto) {
        const file = await bot.api.getFile(fileId)
        const filePath = file.file_path!
        const url = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath}`
        const res = await fetch(url)
        const ab = await res.arrayBuffer()
        buffer = Buffer.from(ab)
        resolvedMime = mimeType!
      } else {
        const result = await fetchTelegramFile(bot, fileId)
        buffer = result.buffer
        resolvedMime = result.mimeType
      }

      // 2. Analyse with Gemini
      const { success, analysis, error } = await analyzeBloodReportBuffer(buffer, resolvedMime, lang)

      if (!success || !analysis) {
        await ctx.api.deleteMessage(ctx.chat!.id, thinkingMsg.message_id).catch(() => null)
        await ctx.reply(`❌ Analysis failed: ${error ?? 'Unknown error'}`)
        return
      }

      // 3. Send text result
      await ctx.api.deleteMessage(ctx.chat!.id, thinkingMsg.message_id).catch(() => null)
      await ctx.reply(
        `📋 <b>Blood Report Analysis</b> <i>(${flag} ${langName})</i>\n\n${analysis}`,
        { parse_mode: 'HTML' },
      )

      // 4. Generate and send audio
      if (!voice) {
        // No native TTS voice for this language — inform user
        await ctx.reply(
          `🔊 <i>Audio is not available for ${langName} — no neural voice exists for this language yet.</i>`,
          { parse_mode: 'HTML' },
        )
        return
      }

      const audioMsg = await ctx.reply('🎙️ Generating audio summary…')
      const audioBuffer = await fetchTtsBuffer(analysis, lang)

      await ctx.api.deleteMessage(ctx.chat!.id, audioMsg.message_id).catch(() => null)

      if (!audioBuffer) {
        await ctx.reply(`⚠️ Audio generation failed. The text result above is complete.`)
        return
      }

      await ctx.replyWithAudio(new InputFile(audioBuffer, `blood_report_${lang}.mp3`), {
        title: `Blood Report — ${langName}`,
        performer: 'Pyro Health AI',
      })
    } catch (err) {
      console.error('[Bot] handleReport error:', err)
      await ctx.api.deleteMessage(ctx.chat!.id, thinkingMsg.message_id).catch(() => null)
      await ctx.reply(`❌ Something went wrong. Please try again or send it as a document.`)
    }
  }

  // Photos (compressed by Telegram)
  bot.on('message:photo', async (ctx) => {
    const photos = ctx.message.photo
    const best = photos[photos.length - 1] // highest resolution
    await handleReport(ctx, best.file_id, true)
  })

  // Documents (uncompressed PDFs / images — recommended for medical docs)
  bot.on('message:document', async (ctx) => {
    const doc = ctx.message.document
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowed.includes(doc.mime_type ?? '')) {
      await ctx.reply(
        `⚠️ Please send your blood report as a <b>photo</b> or a <b>PDF/image document</b>.`,
        { parse_mode: 'HTML' },
      )
      return
    }
    await handleReport(ctx, doc.file_id, false)
  })

  // Catch-all for plain text (not a command)
  bot.on('message:text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) return // handled above
    await ctx.reply(
      `📎 Send me a <b>photo</b> or <b>document</b> of your blood report and I'll analyse it for you.\n\n` +
      `Use /setlang to change the response language, or /help for all commands.`,
      { parse_mode: 'HTML' },
    )
  })

  return bot
}
