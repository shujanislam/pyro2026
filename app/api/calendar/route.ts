import { NextRequest, NextResponse } from 'next/server'
import { generateICS } from '@/utils/ics'
import type { MedicineSchedule } from '@/utils/ics'

/**
 * POST /api/calendar
 *
 * Body (JSON):
 *   { medicines: MedicineSchedule[], startDate?: string (ISO 8601) }
 *
 * Returns:
 *   A standards-compliant .ics file as an attachment download.
 *   No OAuth, no external calendar API, no credentials required.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const medicines: MedicineSchedule[] = body.medicines ?? []

    if (!Array.isArray(medicines) || medicines.length === 0) {
      return NextResponse.json(
        { error: 'No medicine data provided' },
        { status: 400 },
      )
    }

    // Validate each medicine has at least the required fields
    const validated = medicines.map((m) => ({
      name: String(m.name ?? 'Unknown medicine'),
      duration: String(m.duration ?? 'Unknown'),
      durationDays: typeof m.durationDays === 'number' ? m.durationDays : 30,
      frequency: String(m.frequency ?? 'As prescribed'),
      timings: Array.isArray(m.timings) ? m.timings : [],
    }))

    const startDate = body.startDate ? new Date(body.startDate) : new Date()
    if (isNaN(startDate.getTime())) {
      return NextResponse.json({ error: 'Invalid startDate' }, { status: 400 })
    }

    const icsContent = generateICS(validated, startDate)

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="medicine-reminders.ics"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const error = err as Error
    return NextResponse.json(
      { error: `Failed to generate calendar: ${error.message}` },
      { status: 500 },
    )
  }
}
