import fs from "node:fs/promises";

export async function fileToGenerativePart(filePathOrUrlOrBuffer: any, mimeType: any) {
  // support multer file objects, remote URLs, or local file paths
  try {
    let buffer;

    // if it's a multer file object with a buffer property
    if (typeof filePathOrUrlOrBuffer === "object" && filePathOrUrlOrBuffer.buffer) {
      buffer = filePathOrUrlOrBuffer.buffer;
    }
    // if it's already a Buffer
    else if (Buffer.isBuffer(filePathOrUrlOrBuffer)) {
      buffer = filePathOrUrlOrBuffer;
    }
    // if it's a URL string
    else if (typeof filePathOrUrlOrBuffer === "string" && filePathOrUrlOrBuffer.match(/^https?:\/\//i)) {
      const resp = await fetch(filePathOrUrlOrBuffer);
      if (!resp.ok) throw new Error(`Failed to fetch ${filePathOrUrlOrBuffer}: ${resp.status}`);
      const ab = await resp.arrayBuffer();
      buffer = Buffer.from(ab);
    }
    // if it's a local file path string
    else if (typeof filePathOrUrlOrBuffer === "string") {
      buffer = await fs.readFile(filePathOrUrlOrBuffer);
    }
    else {
      throw new Error(`Invalid input: expected buffer, URL, file path, or multer file object`);
    }

    return {
      inlineData: {
        data: buffer.toString("base64"),
        mimeType,
      },
    };
  } catch (err) {
    const error = err as Error
    error.message = `fileToGenerativePart error: ${error.message}`
    throw error
  }
}
