import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

const DEFAULT_VOICE = process.env.TTS_DEFAULT_VOICE ?? "en-US-AriaNeural";
const MAX_CHARS = parseInt(process.env.TTS_MAX_CHARS ?? "4000", 10);

export async function GET() {
  return NextResponse.json({ ok: true, defaultVoice: DEFAULT_VOICE });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, string>;
    const text = (body.text ?? "").trim();
    const voice = (body.voice ?? DEFAULT_VOICE).trim();

    if (!text) {
      return NextResponse.json({ error: "Missing 'text'" }, { status: 400 });
    }
    if (text.length > MAX_CHARS) {
      return NextResponse.json(
        { error: `Text too long (max ${MAX_CHARS} chars)` },
        { status: 413 }
      );
    }
    if (!voice) {
      return NextResponse.json({ error: "Missing 'voice'" }, { status: 400 });
    }

    const tmpFile = path.join(os.tmpdir(), `tts_${Date.now()}.mp3`);

    await new Promise<void>((resolve, reject) => {
      const proc = spawn("edge-tts", [
        "--voice", voice,
        "--text", text,
        "--write-media", tmpFile,
      ]);
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`edge-tts exited with code ${code}`));
      });
      proc.on("error", reject);
    });

    const audio = await fs.readFile(tmpFile);
    await fs.unlink(tmpFile).catch(() => null);

    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "Content-Length": String(audio.byteLength),
      },
    });
  } catch (err) {
    console.error("[/api/tts]", err);
    return NextResponse.json({ error: "TTS failed" }, { status: 500 });
  }
}
