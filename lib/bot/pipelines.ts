import { Bot, InputFile } from 'grammy'
import { answerFollowUpQuestion, compareReports, analyzeMedicalInsuranceBuffer } from '../actions.ts'
import { type DocType, DOC_LABELS, LANGUAGES } from './config.ts'
import { getUserLang, getSession, type AnalysisRecord } from './session.ts'
import {
  escapeHtml,
  stripMarkdown,
  downloadTelegramFile,
  runAnalysis,
  buildPostAnalysisKeyboard,
} from './helpers.ts'

// ─────────────────────────────────────────────────────────────────────────────
// sendAnalysis
// 1. Animated progress   2. Download   3. Gemini analysis
// 4. 🚨 Critical alert   5. Send text  6. Store context
// 7. Post-analysis keyboard   8. On-demand TTS
// ─────────────────────────────────────────────────────────────────────────────

export async function sendAnalysis(
  bot: Bot,
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

    // Append disclaimer (removed from prompt to save tokens)
    const DISCLAIMER = docType === 'insurance'
      ? '\n\n<i>This is an AI estimate. Please verify with your TPA for the final decision.</i>'
      : '\n\n<i>⚠ This is not medical advice — please discuss these results with your doctor.</i>'

    const safeAnalysis = escapeHtml(stripMarkdown(analysis)) + DISCLAIMER
    const header       = `<b>${label} Analysis</b>${langDisplay}\n\n`
    const MAX          = 4096
    const fullText     = header + safeAnalysis

    if (fullText.length <= MAX) {
      await bot.api.sendMessage(chatId, fullText, { parse_mode: 'HTML' })
    } else {
      const chunkSize = MAX - header.length
      let remaining = safeAnalysis
      let first = true
      while (remaining.length > 0) {
        const chunk = remaining.slice(0, chunkSize)
        remaining   = remaining.slice(chunkSize)
        await bot.api.sendMessage(chatId, first ? header + chunk : chunk, { parse_mode: 'HTML' })
        first = false
      }
    }

    // Store compact context for follow-up / comparison
    const session = getSession(userId)
    session.previousAnalysis = session.lastAnalysis
    session.lastAnalysis     = { docType, text: analysis, timestamp: Date.now() }
    session.awaitingFollowUp = false
    session.pendingComparison = false

    // Post-analysis keyboard for blood and medical (not insurance)
    if (docType !== 'insurance') {
      await bot.api.sendMessage(
        chatId,
        `💡 <b>What would you like to do next?</b>`,
        { parse_mode: 'HTML', reply_markup: buildPostAnalysisKeyboard() },
      )
    }
  } catch (err) {
    console.error(`[Bot] sendAnalysis error (userId=${userId}, type=${docType}):`, err)
    await bot.api.deleteMessage(chatId, progMsgId).catch(() => null)
    await bot.api.sendMessage(chatId, '❌ Something went wrong. Please try again.')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// sendInsurancePair
// Called after the user sends the 2nd insurance doc (policy + bill/report together).
// ─────────────────────────────────────────────────────────────────────────────

export async function sendInsurancePair(
  bot: Bot,
  userId: number,
  file2Id: string,
  file2HintMime: string | undefined,
  doc1: { fileId: string; mimeType: string },
  chatId: number,
) {
  const prog     = await bot.api.sendMessage(chatId, `📨 Receiving second document…`)
  const editProg = (text: string) =>
    bot.api.editMessageText(chatId, prog.message_id, text, { parse_mode: 'HTML' }).catch(() => null)

  try {
    await editProg(`🧠 Analysing your <b>🏥 Insurance Claim</b>…`)
    // Download both files now (doc1 was saved as a Telegram fileId, still on CDN)
    const [{ buffer: buf1, mimeType: mime1 }, { buffer: buf2, mimeType: mime2 }] = await Promise.all([
      downloadTelegramFile(bot, doc1.fileId, doc1.mimeType),
      downloadTelegramFile(bot, file2Id, file2HintMime),
    ])
    await editProg(`🔬 Cross-checking policy against medical documents…`)
    const { success, analysis, error } = await analyzeMedicalInsuranceBuffer(
      buf1, mime1, buf2, mime2,
    )

    await bot.api.deleteMessage(chatId, prog.message_id).catch(() => null)

    if (!success || !analysis) {
      await bot.api.sendMessage(chatId, `❌ Analysis failed: ${error ?? 'Please try again.'}`)
      return
    }

    const DISCLAIMER = '\n\n<i>This is an AI estimate. Please verify with your TPA for the final decision.</i>'
    await bot.api.sendMessage(
      chatId,
      `<b>🏥 Insurance Claim Analysis</b>\n\n${escapeHtml(stripMarkdown(analysis))}${DISCLAIMER}`,
      { parse_mode: 'HTML' },
    )

    const session = getSession(userId)
    session.previousAnalysis = session.lastAnalysis
    session.lastAnalysis     = { docType: 'insurance', text: analysis, timestamp: Date.now() }
  } catch (err) {
    console.error(`[Bot] sendInsurancePair error (userId=${userId}):`, err)
    await bot.api.deleteMessage(chatId, prog.message_id).catch(() => null)
    await bot.api.sendMessage(chatId, '❌ Something went wrong. Please try again.')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// sendComparison
// Token-efficient: only 1 new image is sent to Gemini.
// ─────────────────────────────────────────────────────────────────────────────

export async function sendComparison(
  bot: Bot,
  userId: number,
  fileId: string,
  hintMime: string | undefined,
  prev: AnalysisRecord,
  chatId: number,
) {
  const lang = getUserLang(userId)
  const { name: langName, flag } = LANGUAGES[lang]

  const prog     = await bot.api.sendMessage(chatId, `📨 Receiving report…`)
  const editProg = (text: string) =>
    bot.api.editMessageText(chatId, prog.message_id, text, { parse_mode: 'HTML' }).catch(() => null)

  try {
    await editProg(`🧠 Comparing with your previous ${DOC_LABELS[prev.docType]}…`)
    const { buffer, mimeType } = await downloadTelegramFile(bot, fileId, hintMime)
    await editProg(`🔬 Finding what changed…`)
    const result = await compareReports(buffer, mimeType, prev.text, prev.docType as 'blood' | 'medical', lang)

    await bot.api.deleteMessage(chatId, prog.message_id).catch(() => null)

    if (!result.success || !result.analysis) {
      await bot.api.sendMessage(chatId, `❌ Comparison failed: ${result.error ?? 'Please try again.'}`)
      return
    }

    const compDisclaimer = '\n\n<i>⚠ This is not medical advice — discuss any changes with your doctor.</i>'
    await bot.api.sendMessage(
      chatId,
      `<b>📊 Progress Report</b> <i>(${flag} ${langName})</i>\n<i>Older report vs your latest results</i>\n\n${escapeHtml(stripMarkdown(result.analysis))}${compDisclaimer}`,
      { parse_mode: 'HTML' },
    )

    const session = getSession(userId)
    session.previousAnalysis = session.lastAnalysis
    session.lastAnalysis     = { docType: prev.docType, text: result.analysis, timestamp: Date.now() }

    await bot.api.sendMessage(
      chatId,
      `💡 <b>What would you like to do next?</b>`,
      { parse_mode: 'HTML', reply_markup: buildPostAnalysisKeyboard() },
    )
  } catch (err) {
    console.error(`[Bot] sendComparison error (userId=${userId}):`, err)
    await bot.api.deleteMessage(chatId, prog.message_id).catch(() => null)
    await bot.api.sendMessage(chatId, '❌ Comparison failed. Please try again.')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// sendFollowUp
// Text-only Gemini Flash call — no image resent.
// ─────────────────────────────────────────────────────────────────────────────

export async function sendFollowUp(
  bot: Bot,
  userId: number,
  question: string,
  prev: AnalysisRecord,
  chatId: number,
) {
  if (!question) {
    await bot.api.sendMessage(chatId, 'Please type your question.')
    return
  }
  const lang   = getUserLang(userId)
  const typing = await bot.api.sendMessage(chatId, `💭 Looking that up…`)

  try {
    const { success, answer, error } = await answerFollowUpQuestion(prev.text, question, lang)
    await bot.api.deleteMessage(chatId, typing.message_id).catch(() => null)

    if (!success || !answer) {
      await bot.api.sendMessage(chatId, `❌ Could not answer: ${error ?? 'Please try again.'}`)
      return
    }

    const followupDisclaimer = '\n\n<i>Please consult your doctor for personalised advice.</i>'
    await bot.api.sendMessage(
      chatId,
      `💬 <b>Follow-up Answer</b>\n\n${escapeHtml(stripMarkdown(answer))}${followupDisclaimer}`,
      { parse_mode: 'HTML' },
    )

    // Re-show keyboard so user can keep asking
    const session = getSession(userId)
    if (session.lastAnalysis) {
      await bot.api.sendMessage(
        chatId,
        `💡 <b>Anything else?</b>`,
        { parse_mode: 'HTML', reply_markup: buildPostAnalysisKeyboard() },
      )
    }
  } catch (err) {
    console.error(`[Bot] sendFollowUp error (userId=${userId}):`, err)
    await bot.api.deleteMessage(chatId, typing.message_id).catch(() => null)
    await bot.api.sendMessage(chatId, '❌ Something went wrong. Please try again.')
  }
}
