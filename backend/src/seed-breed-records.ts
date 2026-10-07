import { prisma } from './db.js'

const records = [
  {
    slug: 'domestic-shorthair',
    petGroup: 'CAT' as const,
    name: 'Domestic Shorthair',
    characteristics:
      'A broad mixed-ancestry cat type rather than a single pedigree breed. Appearance, coat pattern, size, and temperament can vary widely between individuals.',
    careSummary:
      'Use this record as a starting point for general cat-care navigation. Individual feeding, grooming, preventive-care, and health needs depend on the cat and should be discussed with an appropriate veterinary professional when needed.',
    articleSlugs: [],
  },
  {
    slug: 'persian-cat',
    petGroup: 'CAT' as const,
    name: 'Persian',
    characteristics:
      'A long-haired pedigree cat known for a dense coat and distinctive facial features. Grooming needs can be greater than for short-haired cats.',
    careSummary:
      'Regular coat care and routine preventive veterinary care are important topics to review. This library entry is educational and does not replace individual veterinary advice.',
    articleSlugs: [],
  },
  {
    slug: 'siamese-cat',
    petGroup: 'CAT' as const,
    name: 'Siamese',
    characteristics:
      'A short-haired pedigree cat commonly recognised by a colour-point coat pattern and a social, vocal reputation.',
    careSummary:
      'Use the care collection for feeding, enrichment, grooming, and preventive-care information that applies to the individual cat.',
    articleSlugs: [],
  },
  {
    slug: 'labrador-retriever',
    petGroup: 'DOG' as const,
    name: 'Labrador Retriever',
    characteristics:
      'A medium-to-large retriever breed commonly associated with sociability, trainability, and an active lifestyle.',
    careSummary:
      'Exercise, enrichment, nutrition, grooming, and routine preventive care should be matched to the individual dog’s age, condition, and lifestyle.',
    articleSlugs: [],
  },
  {
    slug: 'indian-pariah-dog',
    petGroup: 'DOG' as const,
    name: 'Indian Pariah Dog',
    characteristics:
      'A naturally occurring landrace dog found across the Indian subcontinent. Individual size, colour, behaviour, and background can vary.',
    careSummary:
      'General dog-care guidance should be adapted to the individual dog, including nutrition, exercise, preventive care, and behaviour support.',
    articleSlugs: [],
  },
  {
    slug: 'golden-retriever',
    petGroup: 'DOG' as const,
    name: 'Golden Retriever',
    characteristics:
      'A medium-to-large retriever breed with a dense coat and a reputation for sociable, people-oriented behaviour.',
    careSummary:
      'Routine coat care, activity, enrichment, nutrition, and preventive veterinary care are useful care topics for owners to review.',
    articleSlugs: [],
  },
  {
    slug: 'red-eared-slider',
    petGroup: 'TURTLE' as const,
    name: 'Red-eared Slider',
    characteristics:
      'A semi-aquatic freshwater turtle. Correct species identification matters because habitat, temperature, lighting, diet, and adult space requirements vary between turtle species.',
    careSummary:
      'Review species-appropriate habitat, water quality, lighting, temperature, nutrition, hygiene, and veterinary-care information before making husbandry decisions.',
    articleSlugs: [],
  },
  {
    slug: 'indian-flapshell-turtle',
    petGroup: 'TURTLE' as const,
    name: 'Indian Flapshell Turtle',
    characteristics:
      'A freshwater softshell turtle native to South Asia. Wildlife ownership and handling may be regulated, so this record is for educational species recognition rather than acquisition guidance.',
    careSummary:
      'Use authoritative wildlife and veterinary sources for legal, welfare, rescue, or rehabilitation questions. Do not use this library as acquisition advice.',
    articleSlugs: [],
  },
  {
    slug: 'indian-roofed-turtle',
    petGroup: 'TURTLE' as const,
    name: 'Indian Roofed Turtle',
    characteristics:
      'A freshwater turtle native to South Asia. Species identification is important for welfare and for understanding applicable wildlife protections.',
    careSummary:
      'Use this entry for educational navigation only. For rescue, rehabilitation, legal ownership, or health concerns, consult the relevant wildlife authority or qualified professional.',
    articleSlugs: [],
  },
]

async function seedBreedRecords() {
  for (const record of records) {
    await prisma
      .breedSpeciesRecord
      .upsert({
        where: {
          slug:
            record.slug,
        },

        update: record,

        create: record,
      })
  }

  console.log(
    `Seeded ${records.length} breed/species records.`,
  )
}

seedBreedRecords()
  .catch((error) => {
    console.error(
      'Could not seed breed/species records:',
      error,
    )

    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
