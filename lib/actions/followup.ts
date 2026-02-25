import { getLangName, getGeminiModel, bufferToGenerativePart } from './shared.ts'

// ─────────────────────────────────────────────────────────────────────────────
// Follow-up Q&A — text-only Gemini call, zero images.
// Uses the stored analysis (~400-600 chars) as context ≈ 600 tokens total.
// Fast and cheap: Flash model.
// ─────────────────────────────────────────────────────────────────────────────

export async function answerFollowUpQuestion(
  reportSummary: string,
  question: string,
  language = 'en',
): Promise<{ success: boolean; answer?: string; error?: string }> {
  const languageName = getLangName(language)

  try {
    const model = getGeminiModel('gemini-2.0-flash')

    const prompt = `You are a healthcare assistant. A patient received the following summary of their medical report and now has a follow-up question.

REPORT SUMMARY:
${reportSummary}

PATIENT'S QUESTION: ${question}

Rules:
- Answer ONLY based on what is in the report summary above — do not invent or assume information.
- 2-3 sentences MAX. Plain, everyday language.
- If the question cannot be answered from the summary, say so politely.
- NEVER diagnose, prescribe, or recommend specific medications or treatments.
- Respond entirely in ${languageName}.`

    const result = await model.generateContent(prompt)
    return { success: true, answer: result.response.text() }
  } catch (err) {
    const error = err as Error
    return { success: false, error: error.message }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Report Comparison — 1 new image + previous summary as plain text.
// Token-efficient: only ONE image goes to Gemini; the old report is passed as
// ~400-600 chars of text (≈ 100-150 extra tokens). No re-analysis of old image.
// ─────────────────────────────────────────────────────────────────────────────

export async function compareReports(
  newBuffer: Buffer,
  newMimeType: string,
  previousSummary: string,
  docType: 'blood' | 'medical',
  language = 'en',
): Promise<{ success: boolean; analysis?: string; error?: string }> {
  const languageName = getLangName(language)

  try {
    const model = getGeminiModel('gemini-2.5-flash')
    const generativePart = bufferToGenerativePart(newBuffer, newMimeType)

    const prompt = `You are a healthcare assistant comparing two ${docType === 'blood' ? 'blood test reports' : 'medical documents'} from the same patient.

PREVIOUS REPORT SUMMARY (older date):
${previousSummary}

NEW REPORT: [attached image]

Compare the two and identify what has CHANGED. Focus only on meaningful differences.

FORMAT RULES:
- Start each bullet with exactly: 📈 (improved toward normal), 📉 (worsened), 🆕 (new finding not in previous report), or ➡️ (no significant change). Do NOT use markdown like **bold** or *italic*.
- Max 6 bullets.
- Each bullet: ONE sentence, max 20 words, plain everyday language.
- Do NOT recommend any treatment or medication.
- Respond entirely in ${languageName}.`

    const result = await model.generateContent([prompt, generativePart])
    return { success: true, analysis: result.response.text() }
  } catch (err) {
    const error = err as Error
    return { success: false, error: error.message }
  }
}
