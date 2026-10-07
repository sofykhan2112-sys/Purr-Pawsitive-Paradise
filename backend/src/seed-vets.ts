import { prisma } from './db.js'

async function main() {
  await prisma.vetListing.upsert({
    where: {
      slug: 'demo-mumbai-companion-clinic',
    },
    update: {},
    create: {
      slug: 'demo-mumbai-companion-clinic',
      vetName: 'Demo veterinarian — not a real provider',
      clinicName: 'Demo Companion Clinic',
      description:
        'Fictional listing for testing the directory. This is not a real clinic and does not provide veterinary services.',
      species: ['CAT', 'DOG'],
      addressLine1: 'Demo address — no physical clinic',
      city: 'Mumbai',
      state: 'Maharashtra',
      countryCode: 'IN',
      status: 'PUBLISHED',
      isDemo: true,
      publishedAt: new Date(),
    },
  })

  await prisma.vetListing.upsert({
    where: {
      slug: 'demo-pune-turtle-clinic',
    },
    update: {},
    create: {
      slug: 'demo-pune-turtle-clinic',
      vetName: 'Demo veterinarian — not a real provider',
      clinicName: 'Demo Turtle Clinic',
      description:
        'Fictional listing for testing turtle and location filters. This is not a real clinic and does not provide veterinary services.',
      species: ['TURTLE'],
      addressLine1: 'Demo address — no physical clinic',
      city: 'Pune',
      state: 'Maharashtra',
      countryCode: 'IN',
      status: 'PUBLISHED',
      isDemo: true,
      publishedAt: new Date(),
    },
  })

  console.log('Demo vet listings are ready.')
  console.log('Existing listings with these slugs were left unchanged.')
}

async function run() {
  try {
    await main()
  } catch (error) {
    console.error('Could not create demo vet listings:', error)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

void run()