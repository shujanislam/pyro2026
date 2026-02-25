export type TtsRequest = {
  text: string;
  voice?: string;
};

export async function fetchTtsMp3(request: TtsRequest): Promise<Blob> {
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
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
        throw new Error(parsed?.error || `TTS request failed (${response.status})`);
      } catch {
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
