/**
 * Language → edge-tts voice mapping.
 * Assamese (as) is NOT here — it uses ElevenLabs instead.
 */
const EDGE_TTS_VOICES: Record<string, string> = {
  en: "en-US-AriaNeural",
  hi: "hi-IN-SwaraNeural",
  bn: "bn-IN-TanishaaNeural",
  ta: "ta-IN-PallaviNeural",
  te: "te-IN-ShrutiNeural",
  kn: "kn-IN-SapnaNeural",
  mr: "mr-IN-AarohiNeural",
  gu: "gu-IN-DhwaniNeural",
  pa: "pa-IN-GurpreetNeural",
};

export type TtsRequest = {
  text: string;
  /** BCP-47 language code, e.g. "en", "hi", "as" */
  language?: string;
  /** Override edge-tts voice name (ignored for ElevenLabs) */
  voice?: string;
};

/**
 * Fetch TTS audio as an MP3 Blob.
 * - language === "as" (Assamese) → POST /api/elevenlabs/tts
 * - everything else              → POST /api/tts  (Python edge-tts)
 */
export async function fetchTtsMp3(request: TtsRequest): Promise<Blob> {
  const lang = request.language ?? "en";
  const useElevenLabs = lang === "as";

  const endpoint = useElevenLabs ? "/api/elevenlabs/tts" : "/api/tts";

  const body: Record<string, string> = { text: request.text };

  if (useElevenLabs) {
    body.language = lang;
  } else {
    body.voice = request.voice ?? EDGE_TTS_VOICES[lang] ?? EDGE_TTS_VOICES.en;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    const rawText = await response.text().catch(() => "");

    const looksLikeHtml =
      rawText.trimStart().toLowerCase().startsWith("<!doctype html") ||
      rawText.trimStart().toLowerCase().startsWith("<html");

    if (contentType.includes("application/json")) {
      try {
        const parsed = JSON.parse(rawText) as { error?: string };
        throw new Error(
          parsed?.error || `TTS request failed (${response.status})`
        );
      } catch (e) {
        if (e instanceof Error) throw e;
        throw new Error(`TTS request failed (${response.status})`);
      }
    }

    if (looksLikeHtml) {
      throw new Error(
        `TTS endpoint not available (HTTP ${response.status}). ` +
          `For local dev, run \`vercel dev\` from the project root (not \`npm run dev\`).`
      );
    }

    throw new Error(rawText || `TTS request failed (${response.status})`);
  }

  return await response.blob();
}
