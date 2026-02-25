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

export async function analyzeFoodLabel(formData: FormData) {
  try {
    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set')
    }

    const client = new GoogleGenerativeAI(apiKey)
    const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' })

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
