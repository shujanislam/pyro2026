/**
 * Local development script — runs the Telegram bot using long polling.
 * Does NOT require a public URL or ngrok.
 *
 * Usage (in a separate terminal while `npm run dev` is running on port 3000):
 *   npm run bot:dev
 *
 * Requires .env.local with:
 *   BOT_TOKEN=...
 *   GEMINI_API_KEY=...
 *   APP_URL=http://localhost:3000
 */

import { createBot } from '../lib/telegram-bot'

async function main() {
  const bot = createBot()

  // Remove any existing webhook so polling works
  await bot.api.deleteWebhook()

  console.log('🤖 Bot is running in long-polling mode...')
  console.log('   Make sure `npm run dev` is also running on port 3000')
  console.log('   Press Ctrl+C to stop\n')

  bot.start({
    onStart: (info) => console.log(`✅ Polling started as @${info.username}`),
  })
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
