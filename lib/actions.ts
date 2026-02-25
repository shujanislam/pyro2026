'use server'

import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai'

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', hi: 'Hindi', as: 'Assamese', bn: 'Bengali',
  ta: 'Tamil',   te: 'Telugu', kn: 'Kannada',  mr: 'Marathi',
  gu: 'Gujarati', pa: 'Punjabi',
}

const SCRIPT_HINTS: Record<string, string> = {
  as: `CRITICAL — You are writing in Assamese (Asamiya), NOT Bengali. Strictly follow Assamese orthography:
- Use ৰ (Assamese ra) — never র (Bengali ra)
- Use ৱ (Assamese wa) — never ব for the wa-sound
- Use হ'ব, কৰিব, যোৱা, আহিব style Assamese verb forms
- Do NOT use Bengali verb endings (-ছে, -বে) or Bengali-only vocabulary
- Write naturally in Assamese as spoken in Assam`,
}

function getLangName(language: string): string {
  return LANGUAGE_NAMES[language] ?? 'English'
}

function getScriptHint(language: string): string {
  return SCRIPT_HINTS[language] ?? ''
}

function getGeminiModel(modelName: string): GenerativeModel {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set')
  const client = new GoogleGenerativeAI(apiKey)
  return client.getGenerativeModel({ model: modelName })
}

function bufferToGenerativePart(fileBuffer: Buffer, mimeType: string) {
  return { inlineData: { data: fileBuffer.toString('base64'), mimeType } }
}

// ─────────────────────────────────────────────────────────────────────────────
// Blood Report Analyser — Buffer-based (Telegram bot)
// ─────────────────────────────────────────────────────────────────────────────

export async function analyzeBloodReportBuffer(
  fileBuffer: Buffer,
  mimeType: string,
  language = 'en',
): Promise<{ success: boolean; analysis?: string; error?: string }> {
  const languageName = getLangName(language)
  const scriptHint  = getScriptHint(language)

  try {
    const apiKey = 'AIzaSyCR18goQwX4xKjctMie4tLpcpH6zPjFuZE'

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
- Start each bullet with EXACTLY ONE of: 🟢 (normal / within range), 🟡 (mild concern / borderline), or 🔴 (significant concern / needs attention) — pick based on clinical significance — then a space, then ONE sentence. Do NOT use markdown like **bold** or *italic*.
- Max 7 bullets total.
- Each bullet: max 22 words.
- Plain everyday words only — if a medical term is unavoidable, add a plain explanation in brackets immediately after.
- Do NOT recommend any specific treatment, drug, or dosage.
- Write ENTIRELY in ${languageName}.
${scriptHint ? `\n${scriptHint}` : ''}

Blood report: [attached image]`

    const result = await model.generateContent([prompt, generativePart])
    return { success: true, analysis: result.response.text() || 'No analysis available' }
  } catch (err) {
    const error = err as Error
    return { success: false, error: error.message }
  }
}

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
    const apiKey = 'AIzaSyCR18goQwX4xKjctMie4tLpcpH6zPjFuZE'

    const client = new GoogleGenerativeAI(apiKey)
    const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const files = formData.getAll('files') as File[]
    if (!files || files.length === 0) throw new Error('No files provided')

    const analysisResults = []

    for (const file of files) {
      try {
        const arrayBuffer    = await file.arrayBuffer()
        const buffer         = Buffer.from(arrayBuffer)
        const mimeType       = file.type || 'application/octet-stream'
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
// Medical Document Explainer — Buffer-based (Telegram bot)
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
    return { success: true, analysis: result.response.text() || 'No explanation available' }
  } catch (err) {
    const error = err as Error
    return { success: false, error: error.message }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Insurance Prompts
// ─────────────────────────────────────────────────────────────────────────────

const INSURANCE_PROMPT_FORMDATA = `Act as a senior Medical Claims Officer specialized in Indian Government Health Schemes (PM-JAY, AB-PMJAY, and State Schemes like Atal Amrit Abhiyan). Your goal is to analyze the complete set of medical insurance documents provided to determine if a treatment is covered and cashless.

You have been provided with multiple documents (insurance cards, medical reports, hospital bills, etc.). Analyze them collectively as a complete medical insurance case, rather than separately.

INSTRUCTIONS:
1. First, extract the patient's identity and card status from any Health Card image(s). Identify the primary scheme (e.g., Ayushman Bharat or State-specific), the unique ID (PM-JAY ID/ABHA ID), and the home state.

2. Second, parse the Medical Report(s) to identify the specific diagnosis and the advised treatment or surgery. Map these findings to the official Health Benefit Packages (HBP) for 2026. Determine if the disease falls under secondary or tertiary care specialties such as Oncology, Cardiology, Nephrology, or General Surgery, which are typically covered under these schemes.

3. Third, evaluate the Hospital Bill(s) or Estimate(s). Specifically check if the patient is marked as an "In-Patient" (IPD), as these cards generally do not cover Out-Patient (OPD) consultations or external lab tests unless they lead to an admission.

4. Cross-reference all documents together to provide a comprehensive analysis. If documents appear to be from the same case, analyze them as a cohesive whole.

YOUR FINAL RESPONSE MUST INCLUDE:

Coverage Verdict: A clear "YES," "NO," or "PARTIAL" statement regarding bill coverage.

Reasoning: A detailed explanation of the decision based on all provided documents (e.g., matching the diagnosis to a specific government package, identifying hospital empanelment status, or noting mismatches).

Document Summary: Brief overview of what each document shows and how they relate to each other in the context of this insurance claim.

Actionable Steps: Specific instructions based on the verdict (finding nearest empanelled hospital, locating "Arogya Mitra" help desk, required documents, etc.).

Hinglish Summary: A 2-3 line empathetic summary in Hinglish that simplifies the technical verdict for the user.

CONSTRAINTS:
- Do not provide medical advice.
- If documents include non-medical consumables (gloves, masks, etc.), clearly state that these might be out-of-pocket expenses even if the primary treatment is covered.
- If any Card or Report is unclear, specify exactly which piece of information is missing to make a final determination.
- Analyze all documents as parts of one cohesive case, not as separate claims.
- Provide a human readable, simple, brief and short response. Do not use markdown symbols like ** or *, only plain text.`

const INSURANCE_PROMPT_BUFFER = `You are an expert Health Insurance Claims Auditor. You have been given TWO documents:
- Document 1: The user's Insurance Policy
- Document 2: A Medical Bill, Lab Report, Prescription, or Hospital Estimate

Your goal is to cross-check Document 2 against Document 1 and tell the user if the claim will be covered.

Task Steps:
1. Validation: Check if the hospital/procedure in Document 2 is covered under Document 1 (Cashless or Reimbursement).
2. Room Rent Audit: Compare the room charge in Document 2 against the Policy Limit in Document 1 (usually 1% of Sum Insured).
3. Medical Necessity: Verify if the procedure/test in Document 2 is "Medically Necessary" as per Document 1 terms.
4. Waiting Period Check: Check if the diagnosis in Document 2 falls under any waiting period clause in Document 1.
5. Deduction Alert: Flag "Non-medical consumables" (Gloves, Masks, Gowns) in Document 2 that won't be covered.

Output Format:
Status: Use exactly one of — 🟢 Covered / 🟡 Partial / 🔴 Rejected — write the full status line with the correct emoji.
Brief Summary: One sentence explanation referencing both documents.
Checklist: Prefix each of the 3 action items with ✅.

Guardrails:
- DO NOT provide medical advice.
- If a document is missing or unclear, say which one and what to resubmit.`

// ─────────────────────────────────────────────────────────────────────────────
// Medical Insurance Analyser — FormData (Next.js server action / web UI)
// ─────────────────────────────────────────────────────────────────────────────

export async function analyzeMedicalInsuranceDocs(formData: FormData) {
  try {
    const apiKey = 'AIzaSyCR18goQwX4xKjctMie4tLpcpH6zPjFuZE'

    const client = new GoogleGenerativeAI(apiKey)
    const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const files = formData.getAll('files') as File[]
    if (!files || files.length === 0) throw new Error('No files provided')

    // Convert all files to generative parts
    const generativeParts = await Promise.all(
      files.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer()
        const buffer      = Buffer.from(arrayBuffer)
        const mimeType    = file.type || 'application/octet-stream'
        return bufferToGenerativePart(buffer, mimeType)
      }),
    )

    // Send all documents together so Gemini analyses them as one cohesive case
    const result = await model.generateContent([INSURANCE_PROMPT_FORMDATA, ...generativeParts])
    const responseText = result.response.text() || 'No analysis available'

    return {
      success: true,
      data: [{
        fileName: `Insurance Claim Analysis (${files.length} document${files.length > 1 ? 's' : ''})`,
        analysis: responseText,
        success: true,
      }],
      message: `Analyzed ${files.length} document(s) collectively`,
    }
  } catch (err) {
    const error = err as Error
    return { success: false, error: error.message, data: null }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Medical Insurance Analyser — Buffer-based (Telegram bot)
// ─────────────────────────────────────────────────────────────────────────────

export async function analyzeMedicalInsuranceBuffer(
  doc1Buffer: Buffer,
  doc1Mime: string,
  doc2Buffer: Buffer,
  doc2Mime: string,
): Promise<{ success: boolean; analysis?: string; error?: string }> {
  try {
    const model = getGeminiModel('gemini-2.5-flash')
    const part1 = bufferToGenerativePart(doc1Buffer, doc1Mime)
    const part2 = bufferToGenerativePart(doc2Buffer, doc2Mime)

    const result = await model.generateContent([INSURANCE_PROMPT_BUFFER, part1, part2])
    return { success: true, analysis: result.response.text() || 'No analysis available' }
  } catch (err) {
    const error = err as Error
    return { success: false, error: error.message }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Follow-up Q&A — text-only, cheap Flash call
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
// Report Comparison — 1 new image + previous summary as text
// Token-efficient: only ONE image goes to Gemini; old report passed as ~400-600 chars of text.
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

// ─────────────────────────────────────────────────────────────────────────────
// Prescription Medicine Extractor  (structured JSON output for ICS export)
// ─────────────────────────────────────────────────────────────────────────────

export interface MedicineSchedule {
  /** Full medicine name with dosage, e.g. "Amoxicillin 500mg" */
  name: string
  /** Human-readable duration, e.g. "7 days" */
  duration: string
  /** Duration as integer days (used for RRULE COUNT) */
  durationDays: number
  /** Human-readable frequency, e.g. "Twice daily" */
  frequency: string
  /**
   * Timings in 24-hour HH:MM format.
   * Extracted from prescription text or inferred from frequency.
   * Empty array → no calendar event should be created.
   */
  timings: string[]
}

export interface PrescriptionAnalysisResult {
  success: boolean
  medicines?: MedicineSchedule[]
  error?: string
}

export async function analyzePrescription(
  formData: FormData,
): Promise<PrescriptionAnalysisResult> {
  try {
    const apiKey = 'AIzaSyCR18goQwX4xKjctMie4tLpcpH6zPjFuZE'

    const client = new GoogleGenerativeAI(apiKey)
    const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const files = formData.getAll('files') as File[]
    if (!files || files.length === 0) throw new Error('No files provided')

    // Combine all uploaded prescription pages into one request
    const generativeParts = await Promise.all(
      files.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        return fileToGenerativePart(buffer, file.type || 'application/octet-stream')
      }),
    )

    const prompt = `You are a medical prescription parser. Extract every medicine from the attached prescription and return ONLY a single valid JSON object — no markdown, no code fences, no explanation.

Return this exact structure:
{
  "medicines": [
    {
      "name": "Full medicine name with dosage (e.g. Amoxicillin 500mg)",
      "duration": "Duration as written (e.g. '7 days', '2 weeks', '1 month')",
      "durationDays": <integer — 7 for 7 days, 14 for 2 weeks, 30 for 1 month, 90 for 3 months>,
      "frequency": "Human-readable frequency (e.g. 'Twice daily', '3 times a day', 'Once daily at bedtime')",
      "timings": ["HH:MM", "HH:MM"]
    }
  ]
}

TIMING RULES (strictly follow):
1. If exact clock times are written (e.g. "8am, 2pm, 8pm"), convert to 24-hour HH:MM and use those exact values.
2. If only a frequency/instruction is given (no clock times), infer standard pharmacy times:
   - Once daily  → ["08:00"]
   - Twice daily  → ["08:00", "20:00"]
   - Three times daily → ["08:00", "14:00", "20:00"]
   - Four times daily  → ["06:00", "12:00", "18:00", "22:00"]
   - Before meals (3x) → ["07:30", "12:30", "19:00"]
   - After meals (3x)  → ["09:00", "14:00", "21:00"]
   - At bedtime        → ["22:00"]
   - Morning only      → ["08:00"]
   - Evening only      → ["20:00"]
3. If there is truly NO timing or frequency information for a medicine, set timings to [].
4. Never omit the timings field. Never set it to null.

durationDays rules:
- "X days"   → X
- "X weeks"  → X × 7
- "X months" → X × 30
- "as needed" / "SOS" / unknown → 30

Return ONLY the JSON. Nothing else.`

    const result = await model.generateContent([prompt, ...generativeParts])
    let responseText = result.response.text().trim()

    // Strip markdown code fences if the model added them anyway
    responseText = responseText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    const parsed = JSON.parse(responseText)
    const medicines: MedicineSchedule[] = (parsed.medicines ?? []).map(
      (m: Partial<MedicineSchedule>) => ({
        name: m.name ?? 'Unknown medicine',
        duration: m.duration ?? 'Unknown',
        durationDays: typeof m.durationDays === 'number' ? m.durationDays : 30,
        frequency: m.frequency ?? 'As prescribed',
        timings: Array.isArray(m.timings) ? m.timings : [],
      }),
    )

    return { success: true, medicines }
  } catch (err) {
    const error = err as Error
    return { success: false, error: error.message }
  }
}
