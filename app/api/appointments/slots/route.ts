import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuthAndRole } from '@/lib/api-helpers'

const DEFAULT_WORKING_HOURS = {
  start: '09:00',
  end: '21:00',
  lunchStart: '13:00',
  lunchEnd: '14:00',
}

function normalizeTime(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return fallback
  const [hour, minute] = value.split(':').map(Number)
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? value : fallback
}

function timeToMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

// GET - Get available time slots for a doctor on a specific date
export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const doctorId = searchParams.get('doctorId')
    const date = searchParams.get('date')
    const requestedDuration = parseInt(searchParams.get('duration') || '30')
    const duration =
      Number.isFinite(requestedDuration) && requestedDuration > 0 ? requestedDuration : 30

    if (!doctorId || !date) {
      return NextResponse.json({ error: 'Doctor ID and date are required' }, { status: 400 })
    }

    // Get hospital working hours (default 9 AM to 9 PM)
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { workingHours: true },
    })

    let workingHours = { ...DEFAULT_WORKING_HOURS }

    if (hospital?.workingHours) {
      try {
        const savedHours = JSON.parse(hospital.workingHours)
        workingHours = {
          start: normalizeTime(savedHours?.start, DEFAULT_WORKING_HOURS.start),
          end: normalizeTime(savedHours?.end, DEFAULT_WORKING_HOURS.end),
          lunchStart: normalizeTime(savedHours?.lunchStart, DEFAULT_WORKING_HOURS.lunchStart),
          lunchEnd: normalizeTime(savedHours?.lunchEnd, DEFAULT_WORKING_HOURS.lunchEnd),
        }
      } catch (e) {
        // Use defaults
      }
    }

    // Check if it's a holiday for this hospital
    const dateObj = new Date(date)
    if (Number.isNaN(dateObj.getTime())) {
      return NextResponse.json({ error: 'A valid date is required' }, { status: 400 })
    }
    const holiday = await prisma.holiday.findFirst({
      where: {
        hospitalId,
        date: dateObj,
      },
    })

    if (holiday) {
      return NextResponse.json({
        available: false,
        reason: `Holiday: ${holiday.name}`,
        slots: [],
      })
    }

    // Verify doctor belongs to this hospital
    const doctor = await prisma.staff.findFirst({
      where: { id: doctorId, hospitalId },
    })

    if (!doctor) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }

    // Get doctor's shift for the day of week
    const dayOfWeek = dateObj.getDay()
    const doctorShift = await prisma.staffShift.findUnique({
      where: {
        staffId_dayOfWeek: {
          staffId: doctorId,
          dayOfWeek,
        },
      },
    })

    // Get existing appointments for the doctor on this date
    const existingAppointments = await prisma.appointment.findMany({
      where: {
        hospitalId,
        doctorId,
        scheduledDate: dateObj,
        status: {
          notIn: ['CANCELLED', 'NO_SHOW', 'RESCHEDULED'],
        },
      },
      select: {
        scheduledTime: true,
        duration: true,
      },
    })

    // Generate all possible slots
    const slots: { time: string; available: boolean }[] = []

    const shiftStart = normalizeTime(doctorShift?.startTime, workingHours.start)
    const shiftEnd = normalizeTime(doctorShift?.endTime, workingHours.end)
    const [startHour, startMin] = shiftStart.split(':').map(Number)
    const [endHour, endMin] = shiftEnd.split(':').map(Number)
    const lunchStartMinutes = timeToMinutes(workingHours.lunchStart)
    const lunchEndMinutes = timeToMinutes(workingHours.lunchEnd)

    // Generate slots in 30-minute intervals
    let currentHour = startHour
    let currentMin = startMin

    while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
      const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`

      // Check if slot is during lunch break
      const slotStartMins = currentHour * 60 + currentMin
      const isLunchTime = slotStartMins >= lunchStartMinutes && slotStartMins < lunchEndMinutes

      // Check if slot overlaps with existing appointments
      const isBooked = existingAppointments.some((apt) => {
        if (typeof apt.scheduledTime !== 'string' || !/^\d{2}:\d{2}$/.test(apt.scheduledTime)) {
          return false
        }
        const aptStartMins = timeToMinutes(apt.scheduledTime)
        const aptEndMins = aptStartMins + (apt.duration || 30)

        const slotEndMins = slotStartMins + duration

        // Check for overlap
        return slotStartMins < aptEndMins && slotEndMins > aptStartMins
      })

      // Check if slot is in the past (for today)
      const now = new Date()
      const isToday = dateObj.toDateString() === now.toDateString()
      const isPast =
        isToday &&
        (currentHour < now.getHours() ||
          (currentHour === now.getHours() && currentMin <= now.getMinutes()))

      slots.push({
        time: timeStr,
        available: !isLunchTime && !isBooked && !isPast,
      })

      // Increment by 30 minutes
      currentMin += 30
      if (currentMin >= 60) {
        currentHour += 1
        currentMin = 0
      }
    }

    return NextResponse.json({
      available: true,
      date,
      doctorId,
      slots,
      workingHours: doctorShift
        ? {
            start: shiftStart,
            end: shiftEnd,
          }
        : workingHours,
    })
  } catch (error) {
    console.error('Error fetching time slots:', error)
    return NextResponse.json({ error: 'Failed to fetch time slots' }, { status: 500 })
  }
}
