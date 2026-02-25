import { NextRequest, NextResponse } from 'next/server'
import { generateICS } from '@/utils/ics'
import type { MedicineSchedule } from '@/utils/ics'
import { sendICSEmail, isValidEmail } from '@/lib/mailer'

/**
 * POST /api/calendar/email
 *
 * Body (JSON):
 *   {
 *     email:      string            — recipient address (required)
 *     medicines:  MedicineSchedule[] — structured medicine data (required)
 *     startDate?: string            — ISO 8601 date string (optional, defaults to today)
 *   }
 *
 * Returns:
 *   { success: true,  messageId: string }
 *   { success: false, error: string }
 *
 * No OAuth, no external calendar API, no stored files.
 * The .ics content is generated in-memory and attached to the outgoing email.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // ── Input validation ─────────────────────────────────────────────────
    const email: string = (body.email ?? '').trim()
    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Recipient email is required' },
        { status: 400 },
      )
    }
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid recipient email address' },
        { status: 400 },
      )
    }

    const medicines: MedicineSchedule[] = body.medicines ?? []
    if (!Array.isArray(medicines) || medicines.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No medicine data provided' },
        { status: 400 },
      )
    }

    // Normalise fields to prevent runtime surprises
    const validated = medicines.map((m) => ({
      name: String(m.name ?? 'Unknown medicine'),
      duration: String(m.duration ?? 'Unknown'),
      durationDays: typeof m.durationDays === 'number' ? m.durationDays : 30,
      frequency: String(m.frequency ?? 'As prescribed'),
      timings: Array.isArray(m.timings) ? m.timings : [],
    }))

    // Ensure at least one medicine has timings
    const eligible = validated.filter((m) => m.timings.length > 0)
    if (eligible.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No medicines with timing information found' },
        { status: 400 },
      )
    }

    const startDate = body.startDate ? new Date(body.startDate) : new Date()
    if (isNaN(startDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid startDate' },
        { status: 400 },
      )
    }

    // ── Generate ICS in memory ──────────────────────────────────────────
    const icsContent = generateICS(validated, startDate)

    // ── Send via SMTP ───────────────────────────────────────────────────
    const result = await sendICSEmail({ to: email, icsContent })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error ?? 'Failed to send email' },
        { status: 502 },
      )
    }

    return NextResponse.json({ success: true, messageId: result.messageId })
  } catch (err) {
    const error = err as Error
    console.error('[/api/calendar/email]', error.message)
    return NextResponse.json(
      { success: false, error: `Server error: ${error.message}` },
      { status: 500 },
    )
  }
}
