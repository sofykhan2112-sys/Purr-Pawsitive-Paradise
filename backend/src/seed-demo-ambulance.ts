import { prisma } from './db.js'
import { assertLocalMaintenanceDatabase } from './local-database-safety.js'

type DemoSpecies = 'CAT' | 'DOG' | 'TURTLE'

type DemoAmbulance = {
  slug: string
  providerName: string
  description: string
  species: DemoSpecies[]
  animalRestrictions: string
  city: string
  state: string
  cityKey: string
  stateKey: string
}

const demoAmbulances: DemoAmbulance[] = [
  {
    slug: 'demo-mumbai-animal-transport',
    providerName: 'Demo Mumbai Animal Transport',
    description:
      'Fictional provider for testing the directory and simulated request flow. No real vehicle or transport service is available.',
    species: ['CAT', 'DOG', 'TURTLE'],
    animalRestrictions:
      'Demonstration only. This listing cannot receive or dispatch real transport requests.',
    city: 'Mumbai',
    state: 'Maharashtra',
    cityKey: 'mumbai',
    stateKey: 'maharashtra',
  },
  {
    slug: 'demo-pune-animal-transport',
    providerName: 'Demo Pune Animal Transport',
    description:
      'Fictional Pune provider for testing location filters and the simulated request flow. No real vehicle or transport service is available.',
    species: ['CAT', 'DOG', 'TURTLE'],
    animalRestrictions:
      'Demonstration only. This listing cannot receive or dispatch real transport requests.',
    city: 'Pune',
    state: 'Maharashtra',
    cityKey: 'pune',
    stateKey: 'maharashtra',
  },
]

async function main() {
  assertLocalMaintenanceDatabase()

  for (const demo of demoAmbulances) {
    await prisma.$transaction(async (tx) => {
      const now = new Date()
      const existing = await tx.ambulanceListing.findUnique({
        where: { slug: demo.slug },
        select: { id: true, publishedAt: true },
      })

      const listing = await tx.ambulanceListing.upsert({
        where: { slug: demo.slug },
        update: {
          providerName: demo.providerName,
          description: demo.description,
          species: demo.species,
          animalRestrictions: demo.animalRestrictions,
          city: demo.city,
          state: demo.state,
          countryCode: 'IN',
          phone: null,
          email: null,
          websiteUrl: null,
          openingHours: 'Demo listing — no real operating hours',
          timeZone: 'Asia/Kolkata',
          status: 'PUBLISHED',
          publishedAt:
            existing?.publishedAt && existing.publishedAt <= now
              ? existing.publishedAt
              : now,
          isDemo: true,
          availability: 'UNKNOWN',
          availabilityUpdatedAt: null,
          requestsEnabled: false,
          verificationStatus: 'NOT_SUBMITTED',
          verificationSubmittedAt: null,
          verificationReviewedAt: null,
          verificationReviewedById: null,
          verificationNotes: null,
          verificationEvidenceReferences: null,
          serviceAreas: {
            deleteMany: {},
            create: {
              city: demo.city,
              state: demo.state,
              countryCode: 'IN',
              cityKey: demo.cityKey,
              stateKey: demo.stateKey,
            },
          },
        },
        create: {
          slug: demo.slug,
          providerName: demo.providerName,
          description: demo.description,
          species: demo.species,
          animalRestrictions: demo.animalRestrictions,
          city: demo.city,
          state: demo.state,
          countryCode: 'IN',
          phone: null,
          email: null,
          websiteUrl: null,
          openingHours: 'Demo listing — no real operating hours',
          timeZone: 'Asia/Kolkata',
          status: 'PUBLISHED',
          publishedAt: now,
          isDemo: true,
          availability: 'UNKNOWN',
          requestsEnabled: false,
          serviceAreas: {
            create: {
              city: demo.city,
              state: demo.state,
              countryCode: 'IN',
              cityKey: demo.cityKey,
              stateKey: demo.stateKey,
            },
          },
        },
        select: { id: true },
      })

      if (!existing) {
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
              city: demo.city,
            },
          },
        })
      }

      console.log(
        `${demo.providerName}: ${existing ? 'updated' : 'created'}.`,
      )
    })
  }

  console.log('Demo ambulance listings are ready.')
}

main()
  .catch((error) => {
    console.error(
      'Demo seed failed:',
      error instanceof Error ? error.message : 'Unknown error',
    )
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
