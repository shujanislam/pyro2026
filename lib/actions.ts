'use server'

import { GoogleGenerativeAI } from '@google/generative-ai'

// ─────────────────────────────────────────────────────────────────────────────
// Blood Report Analyser (Buffer-based — used by the Telegram bot)
// ─────────────────────────────────────────────────────────────────────────────

export async function analyzeBloodReportBuffer(
  fileBuffer: Buffer,
  mimeType: string,
  language = 'en',
): Promise<{ success: boolean; analysis?: string; error?: string }> {
  const LANGUAGE_NAMES: Record<string, string> = {
    en: 'English', hi: 'Hindi', as: 'Assamese', bn: 'Bengali',
    ta: 'Tamil', te: 'Telugu', kn: 'Kannada', mr: 'Marathi',
    gu: 'Gujarati', pa: 'Punjabi',
  }
  const languageName = LANGUAGE_NAMES[language] ?? 'English'

  const SCRIPT_HINTS: Record<string, string> = {
    as: `CRITICAL — You are writing in Assamese (Asamiya), NOT Bengali. Strictly follow Assamese orthography:
- Use ৰ (Assamese ra) — never র (Bengali ra)
- Use ৱ (Assamese wa) — never ব for the wa-sound
- Use হ'ব, কৰিব, যোৱা, আহিব style Assamese verb forms
- Do NOT use Bengali verb endings (-ছে, -বে) or Bengali-only vocabulary
- Write naturally in Assamese as spoken in Assam`,
  }
  const scriptHint = SCRIPT_HINTS[language] ?? ''

  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set')

    const client = new GoogleGenerativeAI(apiKey)
    const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const generativePart = {
      inlineData: {
        data: fileBuffer.toString('base64'),
        mimeType,
      },
    }

    const prompt = `You are a healthcare assistant helping a patient quickly understand their blood test report.

YOUR STYLE — two rules always applied together:

1. THE "SO WHAT?" RULE — never just state a number or define a test. Always say what it means for the patient.
   BAD: "Your HbA1c is 7.5%."
   GOOD: "Your average blood sugar is above the target range — this usually means diabetes management needs a review."

2. THE "NUDGE NOT DIAGNOSE" RULE — you cannot diagnose, but you can connect a finding to a possible symptom and prompt a question.
   BAD: "You have anemia."
   GOOD: "Your haemoglobin appears low — worth asking your doctor if this could explain any recent tiredness."

FORMAT RULES:
- Start each bullet with EXACTLY ONE of: 🟢 (normal / within range), 🟡 (mild concern / borderline), or 🔴 (significant concern / needs attention) — pick based on clinical significance — then a space, then ONE sentence.
- Max 7 bullets total (excluding the final disclaimer bullet).
- Each bullet: max 22 words.
- Plain everyday words only — if a medical term is unavoidable, add a plain explanation in brackets immediately after.
- Do NOT recommend any specific treatment, drug, or dosage.
- End with exactly this disclaimer bullet: "⚠ This is not medical advice — please discuss these results with your doctor."
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

async function fileToGenerativePart(
  fileBuffer: Buffer,
  mimeType: string
) {
  try {
    return {
      inlineData: {
        data: fileBuffer.toString('base64'),
        mimeType,
      },
    }
  } catch (err) {
    const error = err as Error
    throw new Error(`fileToGenerativePart error: ${error.message}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Medical Document Explainer
// ─────────────────────────────────────────────────────────────────────────────

export async function analyzeMedicalDocument(
  formData: FormData,
  language = 'en',
  context = ''
) {
  const LANGUAGE_NAMES: Record<string, string> = {
    en: 'English', hi: 'Hindi', as: 'Assamese', bn: 'Bengali',
    ta: 'Tamil', te: 'Telugu', kn: 'Kannada', mr: 'Marathi',
    gu: 'Gujarati', pa: 'Punjabi',
  }
  const languageName = LANGUAGE_NAMES[language] ?? 'English'

  const SCRIPT_HINTS: Record<string, string> = {
    as: `CRITICAL — You are writing in Assamese (Asamiya), NOT Bengali. Strictly follow Assamese orthography:
- Use ৰ (Assamese ra) — never র (Bengali ra)
- Use ৱ (Assamese wa) — never ব for the wa-sound
- Use হ'ব, কৰিব, যোৱা, আহিব style Assamese verb forms
- Do NOT use Bengali verb endings (-ছে, -বে) or Bengali-only vocabulary
- Write naturally in Assamese as spoken in Assam`,
  }
  const scriptHint = SCRIPT_HINTS[language] ?? ''

  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set')

    const client = new GoogleGenerativeAI(apiKey)
    const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const files = formData.getAll('files') as File[]
    if (!files || files.length === 0) throw new Error('No files provided')

    const analysisResults = []

    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const mimeType = file.type || 'application/octet-stream'
        const generativePart = await fileToGenerativePart(buffer, mimeType)

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
- Bullet points only. Do NOT use bullet symbols (•, -, *).
- Max 6 bullets total (excluding the final disclaimer bullet).
- Each bullet: ONE sentence, max 20 words.
- Plain everyday words only — if a medical term is unavoidable, add a plain explanation in brackets immediately after.
- Do NOT recommend any specific treatment, drug, or dosage.
- End with exactly this disclaimer bullet: "⚠ This is not medical advice — please discuss these results with your doctor."
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

export async function analyzeMedicalInsuranceDocs(formData: FormData) {
  try {
    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set')
    }

    const client = new GoogleGenerativeAI(apiKey)
    const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      throw new Error('No files provided')
    }

    const analysisResults = []

    for (const file of files) {
      try {
        // Convert File to Buffer
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Get the MIME type
        const mimeType = file.type || 'application/octet-stream'

        // Convert to generative part format
        const generativePart = await fileToGenerativePart(buffer, mimeType)

        // Create the prompt for medical insurance document analysis
        const prompt = `You are an expert Health Insurance Claims Auditor. Your goal is to help users understand if their medical bills/reports will be covered by their insurance policy and to flag potential rejections before they happen.

Data Inputs

[POLICY_DATA]: Extracted text from the user's Insurance Policy PDF.

[MEDICAL_DATA]: Extracted text from Lab Reports, Doctor's Prescriptions, or Hospital Estimates.

Task Steps

Validation: Check if the hospital is "Cashless" or "Reimbursement" (if hospital name is provided).

Room Rent Audit: Compare the Hospital Estimate's room charge against the Policy Limit (usually 1% of Sum Insured).

Medical Necessity: Verify if the Lab Test or Surgery is "Medically Necessary" based on the Doctor's Note.

Waiting Period Check: Identify if the diagnosis falls under the "2-year waiting period" based on the Policy Start Date.

Deduction Alert: Flag "Non-medical consumables" (Gloves, Masks, Gowns) that the user will have to pay out-of-pocket.

Output Format (Telegram Style)

Status: [Covered / Partial / Rejected]

Brief Summary: (One sentence explanation).

The "Checklist": 3 bullet points of what to do next.

Hinglish Voice Script: A 2-sentence empathetic summary in Hinglish.

Guardrails

DO NOT provide medical advice.

ALWAYS include: "This is an AI estimate. Please verify with your TPA for the final decision."

If data is missing, politely ask for the "Policy Schedule."`

        // Call Gemini API with the document image
        const result = await model.generateContent([
          prompt,
          generativePart,
        ])

        const responseText =
          result.response.text() || 'No analysis available'

        analysisResults.push({
          fileName: file.name,
          analysis: responseText,
          success: true,
        })
      } catch (fileError) {
        const error = fileError as Error
        analysisResults.push({
          fileName: file.name,
          error: error.message,
          success: false,
        })
      }
    }

    return {
      success: true,
      data: analysisResults,
      message: `Analyzed ${files.length} document(s)`,
    }
  } catch (err) {
    const error = err as Error
    return {
      success: false,
      error: error.message,
      data: null,
    }
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
  const LANGUAGE_NAMES: Record<string, string> = {
    en: 'English', hi: 'Hindi', as: 'Assamese', bn: 'Bengali',
    ta: 'Tamil', te: 'Telugu', kn: 'Kannada', mr: 'Marathi',
    gu: 'Gujarati', pa: 'Punjabi',
  }
  const languageName = LANGUAGE_NAMES[language] ?? 'English'

  const SCRIPT_HINTS: Record<string, string> = {
    as: `CRITICAL — You are writing in Assamese (Asamiya), NOT Bengali. Strictly follow Assamese orthography:
- Use ৰ (Assamese ra) — never র (Bengali ra)
- Use ৱ (Assamese wa) — never ব for the wa-sound
- Use হ'ব, কৰিব, যোৱা, আহিব style Assamese verb forms
- Do NOT use Bengali verb endings (-ছে, -বে) or Bengali-only vocabulary
- Write naturally in Assamese as spoken in Assam`,
  }
  const scriptHint = SCRIPT_HINTS[language] ?? ''

  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set')

    const client = new GoogleGenerativeAI(apiKey)
    const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const generativePart = {
      inlineData: {
        data: fileBuffer.toString('base64'),
        mimeType,
      },
    }

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
- Start each bullet with EXACTLY ONE of: 🟢 (normal / within range), 🟡 (mild concern / borderline), or 🔴 (significant concern / needs attention) — pick based on clinical significance — then a space, then ONE sentence.
- Max 6 bullets total (excluding the final disclaimer bullet).
- Each bullet: max 20 words.
- Plain everyday words only — if a medical term is unavoidable, add a plain explanation in brackets immediately after.
- Do NOT recommend any specific treatment, drug, or dosage.
- End with exactly this disclaimer bullet: "⚠ This is not medical advice — please discuss these results with your doctor."
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

// ─────────────────────────────────────────────────────────────────────────────
// Medical Insurance Document Analyser — Buffer-based (used by Telegram bot)
// ─────────────────────────────────────────────────────────────────────────────

export async function analyzeMedicalInsuranceBuffer(
  fileBuffer: Buffer,
  mimeType: string,
): Promise<{ success: boolean; analysis?: string; error?: string }> {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set')

    const client = new GoogleGenerativeAI(apiKey)
    const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const generativePart = {
      inlineData: {
        data: fileBuffer.toString('base64'),
        mimeType,
      },
    }

    const prompt = `You are an expert Health Insurance Claims Auditor. Your goal is to help users understand if their medical bills/reports will be covered by their insurance policy and to flag potential rejections before they happen.

Task Steps:
1. Validation: Check if the hospital is "Cashless" or "Reimbursement" (if hospital name is provided).
2. Room Rent Audit: Compare the Hospital Estimate's room charge against the Policy Limit (usually 1% of Sum Insured).
3. Medical Necessity: Verify if the Lab Test or Surgery is "Medically Necessary" based on the Doctor's Note.
4. Waiting Period Check: Identify if the diagnosis falls under the "2-year waiting period" based on the Policy Start Date.
5. Deduction Alert: Flag "Non-medical consumables" (Gloves, Masks, Gowns) that the user will have to pay out-of-pocket.

Output Format:
Status: Use exactly one of — 🟢 Covered / 🟡 Partial / 🔴 Rejected — write the full status line with the correct emoji.
Brief Summary: One sentence explanation.
Checklist: Prefix each of the 3 action items with ✅.

Guardrails:
- DO NOT provide medical advice.
- ALWAYS include: "This is an AI estimate. Please verify with your TPA for the final decision."
- If data is missing, politely ask for the "Policy Schedule."`

    const result = await model.generateContent([prompt, generativePart])
    const analysis = result.response.text() || 'No analysis available'
    return { success: true, analysis }
  } catch (err) {
    const error = err as Error
    return { success: false, error: error.message }
  }
}

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
  const LANGUAGE_NAMES: Record<string, string> = {
    en: 'English', hi: 'Hindi', as: 'Assamese', bn: 'Bengali',
    ta: 'Tamil', te: 'Telugu', kn: 'Kannada', mr: 'Marathi',
    gu: 'Gujarati', pa: 'Punjabi',
  }
  const languageName = LANGUAGE_NAMES[language] ?? 'English'

  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set')

    const client = new GoogleGenerativeAI(apiKey)
    const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const prompt = `You are a healthcare assistant. A patient received the following summary of their medical report and now has a follow-up question.

REPORT SUMMARY:
${reportSummary}

PATIENT'S QUESTION: ${question}

Rules:
- Answer ONLY based on what is in the report summary above — do not invent or assume information.
- 2-3 sentences MAX. Plain, everyday language.
- If the question cannot be answered from the summary, say so politely.
- NEVER diagnose, prescribe, or recommend specific medications or treatments.
- End with: "Please consult your doctor for personalised advice."
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
  const LANGUAGE_NAMES: Record<string, string> = {
    en: 'English', hi: 'Hindi', as: 'Assamese', bn: 'Bengali',
    ta: 'Tamil', te: 'Telugu', kn: 'Kannada', mr: 'Marathi',
    gu: 'Gujarati', pa: 'Punjabi',
  }
  const languageName = LANGUAGE_NAMES[language] ?? 'English'

  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set')

    const client = new GoogleGenerativeAI(apiKey)
    const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const generativePart = {
      inlineData: { data: newBuffer.toString('base64'), mimeType: newMimeType },
    }

    const prompt = `You are a healthcare assistant comparing two ${docType === 'blood' ? 'blood test reports' : 'medical documents'} from the same patient.

PREVIOUS REPORT SUMMARY (older date):
${previousSummary}

NEW REPORT: [attached image]

Compare the two and identify what has CHANGED. Focus only on meaningful differences.

FORMAT RULES:
- Start each bullet with exactly: 📈 (improved toward normal), 📉 (worsened), 🆕 (new finding not in previous report), or ➡️ (no significant change).
- Max 6 bullets (excluding disclaimer).
- Each bullet: ONE sentence, max 20 words, plain everyday language.
- Do NOT recommend any treatment or medication.
- End with: "⚠ This is not medical advice — discuss any changes with your doctor."
- Respond entirely in ${languageName}.`

    const result = await model.generateContent([prompt, generativePart])
    return { success: true, analysis: result.response.text() }
  } catch (err) {
    const error = err as Error
    return { success: false, error: error.message }
  }
}
