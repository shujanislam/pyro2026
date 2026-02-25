/**
 * Telegram Bot — Med-Clarity
 *
 * Module layout:
 *  lib/bot/config.ts    — constants & types (LANGUAGES, TTS_VOICES, DocType …)
 *  lib/bot/session.ts   — per-user session & language store
 *  lib/bot/tts.ts       — TTS helpers (prepareForTts, fetchTtsAudio)
 *  lib/bot/helpers.ts   — keyboards, HTML utils, file downloader, runAnalysis
 *  lib/bot/pipelines.ts — sendAnalysis, sendComparison, sendFollowUp
 */

import { Bot, InputFile } from 'grammy'
import { LANGUAGES, LANG_CODES, TTS_VOICES, DOC_LABELS, type DocType } from './bot/config.ts'
import { getUserLang, setUserLang, getSession }                    from './bot/session.ts'
import { fetchTtsAudio }                                           from './bot/tts.ts'
import { buildLangKeyboard, buildDocTypeKeyboard, downloadTelegramFile } from './bot/helpers.ts'
import { sendAnalysis, sendComparison, sendFollowUp, sendInsurancePair } from './bot/pipelines.ts'

export function createBot(): Bot {
  const token = process.env.BOT_TOKEN
  if (!token) throw new Error('BOT_TOKEN environment variable is not set')

  const bot = new Bot(token)

  // /start
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

  // /help
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

  // /lang
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

  // /setlang [code]
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

  // /stop
  bot.command('stop', async (ctx) => {
    const userId = ctx.from?.id
    if (userId) {
      const s = getSession(userId)
      s.awaitingFollowUp      = false
      s.pendingComparison     = false
      s.pendingInsuranceDoc   = undefined
    }
    await ctx.reply(
      `✋ Session cleared. Send a new document any time to start again.\n\nUse /help to see all commands.`,
    )
  })

  // Inline: language selection
  bot.callbackQuery(/^setlang:(.+)$/, async (ctx) => {
    const userId = ctx.from.id
    const lang   = ctx.match[1]
    if (!LANG_CODES.includes(lang)) {
      await ctx.answerCallbackQuery({ text: '⚠ Unknown language' }).catch(() => null)
      return
    }
    setUserLang(userId, lang)
    const { name, flag } = LANGUAGES[lang]
    await ctx.answerCallbackQuery({ text: `✅ Language set to ${flag} ${name}` }).catch(() => null)
    await ctx.editMessageText(`✅ Language set to <b>${flag} ${name}</b>.`, { parse_mode: 'HTML' })
  })

  // Inline: document type selected
  bot.callbackQuery(/^doctype:(blood|medical|insurance)$/, async (ctx) => {
    const userId  = ctx.from.id
    const docType = ctx.match[1] as DocType
    const label   = DOC_LABELS[docType]

    await ctx.answerCallbackQuery({
      text: docType === 'insurance' ? '📎 Document 1 saved — send the second document!' : `Analysing as ${label}…`,
    }).catch(() => null)

    const originalMsg = ctx.callbackQuery.message?.reply_to_message
    if (!originalMsg) {
      await ctx.editMessageText('⚠ Original file not found. Please send it again.').catch(() => null)
      return
    }

    let fileId: string
    let hintMime: string | undefined
    if ('photo' in originalMsg && originalMsg.photo?.length) {
      fileId   = originalMsg.photo[originalMsg.photo.length - 1].file_id
      hintMime = 'image/jpeg'
    } else if ('document' in originalMsg && originalMsg.document) {
      fileId   = originalMsg.document.file_id
      hintMime = originalMsg.document.mime_type ?? undefined
    } else {
      await ctx.editMessageText('⚠ No file found. Please send the document again.').catch(() => null)
      return
    }

    const lang      = getUserLang(userId)
    const chatId    = ctx.chat!.id
    const progMsgId = ctx.callbackQuery.message!.message_id

    // Insurance needs two docs — store file ref (not buffer), prompt for second
    if (docType === 'insurance') {
      try {
        const session = getSession(userId)
        session.pendingInsuranceDoc = { fileId, mimeType: hintMime ?? 'application/octet-stream' }
        // Edit the keyboard message so the buttons disappear
        await ctx.editMessageText('🏥 <b>Insurance Claim — Document 1 received ✅</b>', {
          parse_mode: 'HTML',
        }).catch(() => null)
        // Send a fresh message at the bottom of chat so the user sees it immediately
        await bot.api.sendMessage(
          chatId,
          `📎 Now send the <b>second document</b> — your medical bill, lab report, prescription, or hospital estimate.`,
          { parse_mode: 'HTML' },
        )
      } catch (err) {
        console.error('[Bot] insurance doc1 store error:', err)
        await bot.api.sendMessage(chatId, '❌ Failed to save document 1. Please try again.')
      }
      return
    }

    await ctx.editMessageText(`📨 Receiving your document…`).catch(() => null)
    await sendAnalysis(bot, userId, fileId, hintMime, docType, lang, chatId, progMsgId)
  })

  // Inline: get audio
  bot.callbackQuery('action:audio', async (ctx) => {
    const userId  = ctx.from.id
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
    const gen    = await bot.api.sendMessage(chatId, '🔊 Generating audio summary…')
    try {
      const audioBuffer = await fetchTtsAudio(session.lastAnalysis.text, lang)
      await bot.api.deleteMessage(chatId, gen.message_id).catch(() => null)
      if (!audioBuffer) {
        await bot.api.sendMessage(chatId, '⚠ Audio generation failed. Please try again.')
        return
      }
      await bot.api.sendVoice(chatId, new InputFile(audioBuffer, `report_${lang}.mp3`))
    } catch (err) {
      console.error('[Bot] action:audio error:', err)
      await bot.api.deleteMessage(chatId, gen.message_id).catch(() => null)
      await bot.api.sendMessage(chatId, '⚠ Audio generation failed. Please try again.')
    }
  })

  // Inline: follow-up question
  bot.callbackQuery('action:followup', async (ctx) => {
    const userId  = ctx.from.id
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

  // Inline: compare with older report (both button IDs handled)
  bot.callbackQuery(['action:prevreport', 'action:compare'], async (ctx) => {
    const userId  = ctx.from.id
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

  // Photo handler
  bot.on('message:photo', async (ctx) => {
    const userId = ctx.from?.id
    if (!userId) return
    const session = getSession(userId)
    const fileId  = ctx.message.photo[ctx.message.photo.length - 1].file_id

    if (session.pendingInsuranceDoc) {
      const doc1 = session.pendingInsuranceDoc
      session.pendingInsuranceDoc = undefined
      await sendInsurancePair(bot, userId, fileId, 'image/jpeg', doc1, ctx.chat.id)
      return
    }

    if (session.pendingComparison && session.lastAnalysis) {
      session.pendingComparison = false
      await sendComparison(bot, userId, fileId, 'image/jpeg', session.lastAnalysis, ctx.chat.id)
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

  // Document handler
  bot.on('message:document', async (ctx) => {
    const userId  = ctx.from?.id
    if (!userId) return
    const doc     = ctx.message.document
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
    if (session.pendingInsuranceDoc) {
      const doc1 = session.pendingInsuranceDoc
      session.pendingInsuranceDoc = undefined
      await sendInsurancePair(bot, userId, doc.file_id, doc.mime_type ?? undefined, doc1, ctx.chat.id)
      return
    }

    if (session.pendingComparison && session.lastAnalysis) {
      session.pendingComparison = false
      await sendComparison(bot, userId, doc.file_id, doc.mime_type ?? undefined, session.lastAnalysis, ctx.chat.id)
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

  // Plain text — follow-up Q&A or prompt
  bot.on('message:text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) return
    const userId = ctx.from?.id
    if (!userId) return
    const session = getSession(userId)

    if (session.awaitingFollowUp && session.lastAnalysis) {
      session.awaitingFollowUp = false
      await sendFollowUp(bot, userId, ctx.message.text.trim(), session.lastAnalysis, ctx.chat.id)
      return
    }

    await ctx.reply(
      `📎 Send me a <b>photo</b> or <b>document (PDF / image)</b> and I'll analyse it.\n\n` +
      `Use /setlang to change the response language, or /help for all commands.`,
      { parse_mode: 'HTML' },
    )
  })

  // Error handler
  bot.catch((err) => {
    const ctx = err.ctx
    console.error(`[Bot] Unhandled error for update ${ctx.update.update_id}:`, err.error)
  })

  return bot
}
