'use server'

import { GoogleGenerativeAI } from '@google/generative-ai'

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

export async function analyzeFoodLabel(formData: FormData, language = 'en') {
  // Map BCP-47 code → full language name for the prompt
  const LANGUAGE_NAMES: Record<string, string> = {
    en: 'English',
    hi: 'Hindi',
    as: 'Assamese',
    bn: 'Bengali',
    ta: 'Tamil',
    te: 'Telugu',
    kn: 'Kannada',
    mr: 'Marathi',
    gu: 'Gujarati',
    pa: 'Punjabi',
  }
  const languageName = LANGUAGE_NAMES[language] ?? 'English'

  // Assamese-specific orthography hint — prevents Gemini from defaulting
  // to Bengali conventions (same script, different letters/vocabulary).
  const SCRIPT_HINTS: Record<string, string> = {
    as: `You are writing in Assamese (Asamiya), NOT Bengali. Strictly follow Assamese orthography:
- Use ৰ (Assamese ra) — never র (Bengali ra)
- Use ৱ (Assamese wa) — never ব for the wa-sound
- Use হ'ব, কৰিব, যোৱা, আহিব style Assamese verb forms
- Do NOT use Bengali verb endings (-ছে, -বে) or Bengali-only vocabulary
- Write naturally in Assamese as spoken in Assam`,
  }
  const scriptHint = SCRIPT_HINTS[language] ?? ''

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

        // Create the prompt for food label analysis
        const prompt = `You are a nutritionist AI assistant. Please analyze this food label image and provide:

1. **Product Name**: The name of the product
2. **Nutritional Summary**: Key nutritional information (calories, protein, fat, carbs, fiber, sugar)
3. **Ingredients**: List of main ingredients
4. **Allergens**: Any allergens present
5. **Health Score**: Rate the healthiness on a scale of 1-10 with brief reasoning
6. **Key Insights**: 2-3 bullet points about the product's nutritional profile
7. **Recommendations**: Suggestions for consumption or alternatives if needed

IMPORTANT: Respond ENTIRELY in ${languageName}. Every word of your response must be in ${languageName}.
${scriptHint ? `\n${scriptHint}` : ''}
Please be concise and practical in your analysis.`

        // Call Gemini API with the image
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
      message: `Analyzed ${files.length} file(s)`,
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
