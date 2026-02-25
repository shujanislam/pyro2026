This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Text-to-Speech (Vercel Python Function)

This repo includes a Vercel Serverless Function at `POST /api/tts` that generates an MP3 using `edge-tts`.

- Endpoint: `POST /api/tts`
- Body (JSON): `{ "text": "Hello", "voice": "en-US-AriaNeural" }`
- Response: `audio/mpeg` (MP3 bytes)

Optional environment variables:

- `TTS_DEFAULT_VOICE` (default: `en-US-AriaNeural`)
- `TTS_MAX_CHARS` (default: `4000`)

Client-side example:

```ts
import { fetchTtsMp3 } from "./utils/tts";

const mp3 = await fetchTtsMp3({ text: "Hello", voice: "en-US-AriaNeural" });
const url = URL.createObjectURL(mp3);
const audio = new Audio(url);
audio.play();
```

Local note: `next dev` does not run Vercel Python functions. To test `/api/tts` locally, use the Vercel CLI:

```bash
npm i -g vercel
vercel dev
```

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
