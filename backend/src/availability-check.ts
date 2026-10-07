import type { Prisma } from './generated/prisma/client.js'

const weekdayNumbers: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
}

// Returns null when allowed, or an explanation when unavailable.
// Call inside the same transaction that creates or updates the appointment.
export async function checkAppointmentAvailability(
  tx: Prisma.TransactionClient,
  vetListingId: string,
  startsAt: Date,
  endsAt: Date,
): Promise<string | null> {
  const listing = await tx.vetListing.findUnique({
    where: { id: vetListingId },
    select: {
      availabilityEnabled: true,
      timeZone: true,
    },
  })

  if (!listing) {
    return 'Clinic not found.'
  }

  // Preserve existing behaviour until availability is activated.
  if (!listing.availabilityEnabled) {
    return null
  }

  const start = startsAt.getTime()
  const end = endsAt.getTime()
  const minute = 60 * 1000

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end - start !== 30 * minute ||
    start % minute !== 0
  ) {
    return 'Appointments must last 30 minutes and start on a whole minute.'
  }

  const block = await tx.vetAvailabilityBlock.findFirst({
    where: {
      vetListingId,
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
    select: { id: true },
  })

  if (block) {
    // Internal block reasons are deliberately not returned.
    return 'The clinic is unavailable during this period. Choose another time.'
  }

  const windows = await tx.vetAvailabilityWindow.findMany({
    where: { vetListingId },
    select: {
      weekday: true,
      startMinute: true,
      endMinute: true,
    },
  })

  if (windows.length === 0) {
    return 'The clinic has no working hours configured.'
  }

  let formatter: Intl.DateTimeFormat

  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: listing.timeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
  } catch {
    return 'The clinic time zone needs attention before booking.'
  }

  // Check every occupied minute in the clinic's time zone.
  // The end instant is excluded, so a visit may end at closing time.
  // Conversion from actual instants also handles daylight-saving changes.
  for (let instant = start; instant < end; instant += minute) {
    const parts = formatter.formatToParts(new Date(instant))

    const weekdayText =
      parts.find((part) => part.type === 'weekday')?.value ?? ''

    const weekday = weekdayNumbers[weekdayText]
    const hour = Number(
      parts.find((part) => part.type === 'hour')?.value ?? NaN,
    )
    const localMinute = Number(
      parts.find((part) => part.type === 'minute')?.value ?? NaN,
    )

    if (
      !weekday ||
      !Number.isInteger(hour) ||
      !Number.isInteger(localMinute) ||
      hour < 0 ||
      hour > 23 ||
      localMinute < 0 ||
      localMinute > 59
    ) {
      return 'Could not verify the clinic working hours.'
    }

    const minutesAfterMidnight = hour * 60 + localMinute

    const covered = windows.some(
      (window) =>
        window.weekday === weekday &&
        minutesAfterMidnight >= window.startMinute &&
        minutesAfterMidnight < window.endMinute,
    )

    if (!covered) {
      return 'The full appointment must fit within the clinic’s working hours.'
    }
  }

  return null
}