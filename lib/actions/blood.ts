import { getLangName, getScriptHint, getGeminiModel, bufferToGenerativePart } from './shared.ts'

// ─────────────────────────────────────────────────────────────────────────────
// Blood Report Analyser — Buffer-based (used by the Telegram bot)
// ─────────────────────────────────────────────────────────────────────────────

export async function analyzeBloodReportBuffer(
  fileBuffer: Buffer,
  mimeType: string,
  language = 'en',
): Promise<{ success: boolean; analysis?: string; error?: string }> {
  const languageName = getLangName(language)
  const scriptHint  = getScriptHint(language)

  try {
    const model = getGeminiModel('gemini-2.5-flash')
    const generativePart = bufferToGenerativePart(fileBuffer, mimeType)

    const prompt = `You are a healthcare assistant helping a patient quickly understand their blood test report.

YOUR STYLE — two rules always applied together:

1. THE "SO WHAT?" RULE — never just state a number or define a test. Always say what it means for the patient.
   BAD: "Your HbA1c is 7.5%."
   GOOD: "Your average blood sugar is above the target range — this usually means diabetes management needs a review."

2. THE "NUDGE NOT DIAGNOSE" RULE — you cannot diagnose, but you can connect a finding to a possible symptom and prompt a question.
   BAD: "You have anemia."
   GOOD: "Your haemoglobin appears low — worth asking your doctor if this could explain any recent tiredness."

FORMAT RULES:
- Start each bullet with EXACTLY ONE of: 🟢 (normal / within range), 🟡 (mild concern / borderline), or 🔴 (significant concern / needs attention) — pick based on clinical significance — then a space, then ONE sentence. Do NOT use markdown like **bold** or *italic*.
- Max 7 bullets total.
- Each bullet: max 22 words.
- Plain everyday words only — if a medical term is unavoidable, add a plain explanation in brackets immediately after.
- Do NOT recommend any specific treatment, drug, or dosage.
- Write ENTIRELY in ${languageName}.
${scriptHint ? `\n${scriptHint}` : ''}

Blood report: [attached image]`

    const result = await model.generateContent([prompt, generativePart])
    const analysis = result.response.text() || 'No analysis available'
    return { success: true, analysis }
  } catch (err) {
    const error = err as Error
    return { success: false, error: error.message }
  }
}
