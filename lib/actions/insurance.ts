'use server'

import { getGeminiModel, bufferToGenerativePart } from './shared.ts'

// ─────────────────────────────────────────────────────────────────────────────
// Medical Insurance Document Analyser — FormData (Next.js server action / web UI)
// ─────────────────────────────────────────────────────────────────────────────

const INSURANCE_PROMPT_FORMDATA = `You are an expert Health Insurance Claims Auditor. Your goal is to help users understand if their medical bills/reports will be covered by their insurance policy and to flag potential rejections before they happen.

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

export async function analyzeMedicalInsuranceDocs(formData: FormData) {
  try {
    const model = getGeminiModel('gemini-2.5-flash')

    const files = formData.getAll('files') as File[]
    if (!files || files.length === 0) throw new Error('No files provided')

    const analysisResults = []

    for (const file of files) {
      try {
        const arrayBuffer    = await file.arrayBuffer()
        const buffer         = Buffer.from(arrayBuffer)
        const mimeType       = file.type || 'application/octet-stream'
        const generativePart = bufferToGenerativePart(buffer, mimeType)

        const result = await model.generateContent([INSURANCE_PROMPT_FORMDATA, generativePart])
        const responseText = result.response.text() || 'No analysis available'
        analysisResults.push({ fileName: file.name, analysis: responseText, success: true })
      } catch (fileError) {
        const error = fileError as Error
        analysisResults.push({ fileName: file.name, error: error.message, success: false })
      }
    }

    return { success: true, data: analysisResults, message: `Analyzed ${files.length} document(s)` }
  } catch (err) {
    const error = err as Error
    return { success: false, error: error.message, data: null }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Medical Insurance Document Analyser — Buffer-based (used by Telegram bot)
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
    const analysis = result.response.text() || 'No analysis available'
    return { success: true, analysis }
  } catch (err) {
    const error = err as Error
    return { success: false, error: error.message }
  }
}
