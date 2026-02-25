'use server'

import { getLangName, getScriptHint, getGeminiModel, bufferToGenerativePart } from './shared.ts'

// ─────────────────────────────────────────────────────────────────────────────
// Medical Document Explainer — FormData (Next.js server action / web UI)
// ─────────────────────────────────────────────────────────────────────────────

export async function analyzeMedicalDocument(
  formData: FormData,
  language = 'en',
  context = '',
) {
  const languageName = getLangName(language)
  const scriptHint  = getScriptHint(language)

  try {
    const model = getGeminiModel('gemini-2.5-flash')

    const files = formData.getAll('files') as File[]
    if (!files || files.length === 0) throw new Error('No files provided')

    const analysisResults = []

    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const buffer      = Buffer.from(arrayBuffer)
        const mimeType    = file.type || 'application/octet-stream'
        const generativePart = bufferToGenerativePart(buffer, mimeType)

        const prompt = `You are a healthcare assistant helping a patient quickly understand their medical document.
Look at the document and respond with SHORT, PLAIN bullet points ONLY.

YOUR STYLE — two rules that must always be applied together:

1. THE "SO WHAT?" RULE — never just state a number or define a test. Always say what it means for the patient.
   BAD: "Your HbA1c is 7.5%."
   GOOD: "Your average blood sugar is above the target range, which usually means your diabetes management needs a review."

2. THE "NUDGE NOT DIAGNOSE" RULE — you cannot make a diagnosis, but you can connect a finding to a possible symptom and prompt a question.
   BAD: "You have anemia."
   GOOD: "Your iron levels appear low — worth asking your doctor if this could explain any recent tiredness."

FORMAT RULES:
- Bullet points only. Do NOT use bullet symbols (•, -, *) or markdown formatting like **bold**.
- Max 6 bullets total.
- Each bullet: ONE sentence, max 20 words.
- Plain everyday words only — if a medical term is unavoidable, add a plain explanation in brackets immediately after.
- Do NOT recommend any specific treatment, drug, or dosage.
- Write ENTIRELY in ${languageName}.
${scriptHint ? `\n${scriptHint}` : ''}
${context ? `\nPatient note: ${context}` : ''}

Document: [attached image]`

        const result = await model.generateContent([prompt, generativePart])
        const responseText = result.response.text() || 'No explanation available'
        analysisResults.push({ fileName: file.name, analysis: responseText, success: true })
      } catch (fileError) {
        const error = fileError as Error
        analysisResults.push({ fileName: file.name, error: error.message, success: false })
      }
    }

    return { success: true, data: analysisResults, message: `Explained ${files.length} document(s)` }
  } catch (err) {
    const error = err as Error
    return { success: false, error: error.message, data: null }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Medical Document Explainer — Buffer-based (used by Telegram bot)
// ─────────────────────────────────────────────────────────────────────────────

export async function analyzeMedicalDocumentBuffer(
  fileBuffer: Buffer,
  mimeType: string,
  language = 'en',
  context = '',
): Promise<{ success: boolean; analysis?: string; error?: string }> {
  const languageName = getLangName(language)
  const scriptHint  = getScriptHint(language)

  try {
    const model = getGeminiModel('gemini-2.5-flash')
    const generativePart = bufferToGenerativePart(fileBuffer, mimeType)

    const prompt = `You are a healthcare assistant helping a patient quickly understand their medical document.
Look at the document and respond with SHORT, PLAIN bullet points ONLY.

YOUR STYLE — two rules that must always be applied together:

1. THE "SO WHAT?" RULE — never just state a number or define a test. Always say what it means for the patient.
   BAD: "Your HbA1c is 7.5%."
   GOOD: "Your average blood sugar is above the target range, which usually means your diabetes management needs a review."

2. THE "NUDGE NOT DIAGNOSE" RULE — you cannot make a diagnosis, but you can connect a finding to a possible symptom and prompt a question.
   BAD: "You have anemia."
   GOOD: "Your iron levels appear low — worth asking your doctor if this could explain any recent tiredness."

FORMAT RULES:
- Start each bullet with EXACTLY ONE of: 🟢 (normal / within range), 🟡 (mild concern / borderline), or 🔴 (significant concern / needs attention) — pick based on clinical significance — then a space, then ONE sentence. Do NOT use markdown like **bold** or *italic*.
- Max 6 bullets total.
- Each bullet: max 20 words.
- Plain everyday words only — if a medical term is unavoidable, add a plain explanation in brackets immediately after.
- Do NOT recommend any specific treatment, drug, or dosage.
- Write ENTIRELY in ${languageName}.
${scriptHint ? `\n${scriptHint}` : ''}
${context ? `\nPatient note: ${context}` : ''}

Document: [attached image]`

    const result = await model.generateContent([prompt, generativePart])
    const analysis = result.response.text() || 'No explanation available'
    return { success: true, analysis }
  } catch (err) {
    const error = err as Error
    return { success: false, error: error.message }
  }
}
