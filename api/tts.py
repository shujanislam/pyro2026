import asyncio
import json
import os
import tempfile
from http.server import BaseHTTPRequestHandler

import edge_tts

DEFAULT_VOICE = os.environ.get("TTS_DEFAULT_VOICE", "en-US-AriaNeural")
MAX_CHARS = int(os.environ.get("TTS_MAX_CHARS", "4000"))


def _read_json_body(handler: BaseHTTPRequestHandler):
    content_length = handler.headers.get("content-length")
    if not content_length:
        return {}

    try:
        length = int(content_length)
    except ValueError:
        raise ValueError("Invalid Content-Length")

    raw = handler.rfile.read(length) if length > 0 else b""
    if not raw:
        return {}

    try:
        return json.loads(raw.decode("utf-8"))
    except Exception as exc:
        raise ValueError("Invalid JSON body") from exc


def _send_json(handler: BaseHTTPRequestHandler, status: int, payload: dict):
    data = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(data)))
    handler.end_headers()
    handler.wfile.write(data)


async def _synthesize_to_file(text: str, voice: str, output_path: str):
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_path)


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        # Helpful for browser preflight when calling from other origins.
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        path_only = self.path.split("?", 1)[0]
        if path_only not in ("/api/tts", "/tts"):
            return _send_json(self, 404, {"error": "Not found"})

        try:
            body = _read_json_body(self)
            text = (body.get("text") or "").strip()
            voice = (body.get("voice") or DEFAULT_VOICE).strip()

            if not text:
                return _send_json(self, 400, {"error": "Missing 'text'"})

            if len(text) > MAX_CHARS:
                return _send_json(self, 413, {"error": f"Text too long (max {MAX_CHARS} chars)"})

            if not voice:
                return _send_json(self, 400, {"error": "Missing 'voice'"})

            tmp_path = None
            try:
                with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
                    tmp_path = tmp.name

                asyncio.run(_synthesize_to_file(text=text, voice=voice, output_path=tmp_path))

                with open(tmp_path, "rb") as f:
                    audio = f.read()
            finally:
                if tmp_path and os.path.exists(tmp_path):
                    try:
                        os.remove(tmp_path)
                    except OSError:
                        pass

            self.send_response(200)
            self.send_header("Content-Type", "audio/mpeg")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(audio)))
            self.end_headers()
            self.wfile.write(audio)

        except Exception:
            return _send_json(self, 500, {"error": "TTS failed"})

    def do_GET(self):
        # Simple health check
        path_only = self.path.split("?", 1)[0]
        if path_only in ("/api/tts", "/tts"):
            return _send_json(self, 200, {"ok": True, "defaultVoice": DEFAULT_VOICE})

        return _send_json(self, 404, {"error": "Not found"})
