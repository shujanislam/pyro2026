const API_KEY = "sk_9b4004b082fd8c51e021ea89f3fb84c600045cc28780079f";

// Hardcoded voice ID per project requirement
const VOICE_ID = "cgSgspJ2msm6clMCkdW9";

export interface TTSOptions {
  language?: string; // BCP-47 code e.g. "en", "hi", "as", "bn"
}

/**
 * Calls ElevenLabs TTS API and returns raw audio as a Buffer.
 * No disk I/O — caller decides how to use the buffer.
 */
export async function generateAudio(
  text: string,
  options: TTSOptions = {}
): Promise<Buffer> {
  if (!API_KEY) {
    throw new Error("ELEVENLABS_API_KEY environment variable is not set");
  }

  const trimmedKey = API_KEY.trim();
  const trimmedText = text.trim();

  if (!trimmedText) {
    throw new Error("Text is empty");
  }

  const language = options.language ?? "en";

  // ElevenLabs character-limit safeguard for Assamese only.
  // Keep other languages untrimmed.
  const ELEVENLABS_ASSAMESE_MAX_CHARS = 500;
  const textForTts =
    language === "as" && trimmedText.length > ELEVENLABS_ASSAMESE_MAX_CHARS
      ? trimmedText.slice(0, ELEVENLABS_ASSAMESE_MAX_CHARS)
      : trimmedText;

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": trimmedKey,
      },
      body: JSON.stringify({
        text: textForTts,
        model_id: "eleven_v3",
        language_code: language,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.90,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(
      `ElevenLabs API error: ${response.status} ${response.statusText} — ${errBody}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/** Supported languages exposed to the UI */
export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "as", label: "Assamese" },
  { code: "bn", label: "Bengali" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "kn", label: "Kannada" },
  { code: "mr", label: "Marathi" },
  { code: "gu", label: "Gujarati" },
  { code: "pa", label: "Punjabi" },
] as const;
