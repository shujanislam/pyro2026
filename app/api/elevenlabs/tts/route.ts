import { NextRequest, NextResponse } from "next/server";
import { generateAudio } from "@/lib/elevenlabs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, language } = body as { text?: string; language?: string };

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'text' in request body" },
        { status: 400 }
      );
    }

    // Dynamic filename using ISO datetime (safe for filenames)
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `tts_${ts}.mp3`;

    // ============================================================
    // ⚠️  TESTING ONLY — REMOVE BEFORE PRODUCTION
    //     Gemini response is sliced to first 100 characters
    //     before being sent to ElevenLabs to conserve API quota.
    //     Remove `maxChars: 100` (or the whole option object) when
    //     you are ready to send the full explanation to TTS.
    // ============================================================
    const audioBuffer = await generateAudio(text, { language: language ?? "en", maxChars: 100 });

    return new NextResponse(new Uint8Array(audioBuffer), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Content-Length": String(audioBuffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/elevenlabs/tts]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
