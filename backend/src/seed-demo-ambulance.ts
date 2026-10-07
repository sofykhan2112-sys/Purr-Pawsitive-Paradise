import { prisma } from './db.js'

async function main() {
  const slug = 'demo-mumbai-animal-transport'

  await prisma.$transaction(async (tx) => {
    const existing = await tx.ambulanceListing.findUnique({
      where: { slug },
      select: { id: true },
    })

    if (existing) {
      console.log('Demo slug already exists. No changes made.')
      return
    }

    const listing = await tx.ambulanceListing.create({
      data: {
        slug,
        providerName: 'Demo Mumbai Animal Transport',
        description:
          'Fictional provider for testing the directory. No real vehicle or transport service is available.',
        species: ['CAT', 'DOG', 'TURTLE'],
        animalRestrictions:
          'Demonstration only. Real transport suitability must be confirmed with a participating provider.',
        city: 'Mumbai',
        state: 'Maharashtra',
        countryCode: 'IN',
        phone: null,
        email: null,
        websiteUrl: null,
        openingHours: 'Demo listing — no real operating hours',
        timeZone: 'Asia/Kolkata',
        status: 'PUBLISHED',
        publishedAt: new Date(),
        isDemo: true,
        availability: 'UNKNOWN',
        requestsEnabled: false,
        serviceAreas: {
          create: {
            city: 'Mumbai',
            state: 'Maharashtra',
            countryCode: 'IN',
            cityKey: 'mumbai',
            stateKey: 'maharashtra',
          },
        },
      },
      select: { id: true },
    })

    await tx.auditEvent.create({
      data: {
        actorId: null,
        actorLabel: 'Local demo seed',
        action: 'AMBULANCE_DEMO_CREATED',
        entityType: 'AmbulanceListing',
        entityId: listing.id,
        details: {
          isDemo: true,
          requestsEnabled: false,
        },
      },
    })

    console.log('Demo ambulance listing created.')
  })
}

main()
  .catch((error) => {
    console.error(
      'Demo seed failed:',
      error instanceof Error ? error.name : 'Unknown error',
    )
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })