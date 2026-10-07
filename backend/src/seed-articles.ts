
import { prisma } from './db.js'

type Species = 'CAT' | 'DOG' | 'TURTLE'

type Topic =
  | 'BREEDS_AND_SPECIES'
  | 'DAILY_CARE'
  | 'NUTRITION'
  | 'GROOMING'
  | 'HABITAT'
  | 'ENRICHMENT'
  | 'PREVENTIVE_CARE'
  | 'HEALTH'

type DraftDefinition = {
  slug: string
  title: string
  species: Species
  topic: Topic
  summary: string
  sections: string[]
}

// ======================================================
// EXISTING DEMO ARTICLES
// ======================================================

const demoArticles = [
  {
    slug: 'demo-exploring-the-cat-guide',
    title: 'Exploring the cat guide',
    species: 'CAT' as const,
    summary:
      'Demo article: discover how the cat collection will organise breeds, routines, enrichment, and reviewed care information.',
    body: [
      'DEMONSTRATION CONTENT',
      'This article demonstrates the website’s article system. It is not veterinary advice.',
      'Finding your starting point',
      'The cat collection groups information into topics such as breeds, everyday care, nutrition, grooming, and enrichment.',
      'Understanding article reviews',
      'Published care material will include sources and review information. Health-related material requires qualified review before publication.',
      'Your companion’s profile',
      'Sign in to add your cat’s name, breed or type, and age information to your account.',
    ].join('\n\n'),
  },
  {
    slug: 'demo-exploring-the-dog-guide',
    title: 'Exploring the dog guide',
    species: 'DOG' as const,
    summary:
      'Demo article: find your way around the dog collection and learn where future care resources will appear.',
    body: [
      'DEMONSTRATION CONTENT',
      'This article demonstrates the website’s article system. It is not veterinary advice.',
      'Discovering the collection',
      'The dog collection will organise articles about breeds, everyday routines, enrichment, grooming, and reviewed care topics.',
      'Finding relevant information',
      'Article titles and summaries help you choose what to explore. Search and species filters narrow the collection.',
      'Keeping a pet profile',
      'Your account lets you add, edit, and remove your own pet profiles.',
    ].join('\n\n'),
  },
  {
    slug: 'demo-exploring-the-turtle-guide',
    title: 'Exploring the turtle guide',
    species: 'TURTLE' as const,
    summary:
      'Demo article: preview the turtle collection’s organisation around species, habitat, and reviewed care topics.',
    body: [
      'DEMONSTRATION CONTENT',
      'This article demonstrates the website’s article system. It is not veterinary advice.',
      'Exploring by topic',
      'The turtle collection will include species information, habitat topics, nutrition, and reviewed health education.',
      'Checking applicability',
      'Future care articles should identify which species their information applies to and provide supporting sources.',
      'Adding your companion',
      'You can create a turtle profile in your account and add its species or type if known.',
    ].join('\n\n'),
  },
]

// ======================================================
// CAT ARTICLES — 7 TOPICS
// ======================================================

const catDrafts: DraftDefinition[] = [
  {
    slug: 'cat-breeds-and-characteristics-guide',
    title: 'Cat breeds and characteristics',
    species: 'CAT',
    topic: 'BREEDS_AND_SPECIES',
    summary:
      'An introduction to cat breeds, individual differences and responsible breed research.',
    sections: [
      'Explain the difference between a breed description and the needs of an individual cat.',
      'Introduce breed size, coat characteristics and common activity differences without stereotyping temperament.',
      'Explain why age, history and individual behaviour matter when choosing care routines.',
      'Add verified breed references and link suitable breed records.',
    ],
  },
  {
    slug: 'cat-everyday-care-guide',
    title: 'Everyday care for cats',
    species: 'CAT',
    topic: 'DAILY_CARE',
    summary:
      'An overview of daily routines, comfortable living spaces and responsible cat care.',
    sections: [
      'Describe daily observation, access to water, litter-box maintenance and comfortable resting spaces.',
      'Cover safe indoor spaces and opportunities for normal cat behaviour.',
      'Explain the importance of predictable routines and individual preferences.',
      'Add reputable sources and professional review before publication.',
    ],
  },
  {
    slug: 'cat-food-and-nutrition-guide',
    title: 'Food and nutrition for cats',
    species: 'CAT',
    topic: 'NUTRITION',
    summary:
      'An introductory guide to age-appropriate nutrition and discussing feeding needs with a veterinary professional.',
    sections: [
      'Explain the importance of a nutritionally complete diet appropriate to the individual cat.',
      'Discuss the relevance of life stage, body condition and health history.',
      'Include hydration awareness and safe food storage considerations.',
      'Have a qualified reviewer verify feeding and nutrition statements.',
    ],
  },
  {
    slug: 'cat-grooming-and-coat-care-guide',
    title: 'Cat grooming and coat care',
    species: 'CAT',
    topic: 'GROOMING',
    summary:
      'An overview of gentle coat care, grooming routines and signs that professional guidance is needed.',
    sections: [
      'Explain how grooming needs vary by coat type and individual circumstances.',
      'Discuss gentle handling and reducing stress during routine grooming.',
      'Introduce safe observation of coat, skin and nails without giving treatment instructions.',
      'Verify grooming recommendations using credible animal-care sources.',
    ],
  },
  {
    slug: 'cat-play-and-enrichment-guide',
    title: 'Play and enrichment for cats',
    species: 'CAT',
    topic: 'ENRICHMENT',
    summary:
      'Ideas for creating engaging environments that support normal cat behaviour.',
    sections: [
      'Describe opportunities for play, exploration, climbing and resting.',
      'Discuss providing choices and adapting activities to different ages and abilities.',
      'Explain the importance of checking toys and environments for safety.',
      'Add reliable references on feline behaviour and enrichment.',
    ],
  },
  {
    slug: 'cat-preventive-care-and-vaccination-guide',
    title: 'Preventive care and vaccination awareness for cats',
    species: 'CAT',
    topic: 'PREVENTIVE_CARE',
    summary:
      'An introduction to preventive veterinary visits and individualized vaccination discussions.',
    sections: [
      'Explain the role of routine veterinary assessments and preventive-care planning.',
      'Cover questions owners can discuss with a veterinarian about vaccination and parasite prevention.',
      'Explain why recommendations depend on age, lifestyle, location and health history.',
      'A qualified veterinary reviewer must approve all clinical details and references.',
    ],
  },
  {
    slug: 'cat-health-awareness-guide',
    title: 'Health awareness for cat owners',
    species: 'CAT',
    topic: 'HEALTH',
    summary:
      'An introduction to noticing changes in a cat and understanding when professional assessment is needed.',
    sections: [
      'Explain why owners should observe changes in appetite, activity, behaviour and normal routines.',
      'Distinguish general awareness from diagnosis or treatment advice.',
      'Emphasize professional assessment when an animal appears unwell.',
      'Obtain qualified review of warning signs, urgent escalation and all health claims.',
    ],
  },
]

// ======================================================
// DOG ARTICLES — 7 TOPICS
// ======================================================

const dogDrafts: DraftDefinition[] = [
  {
    slug: 'dog-breeds-and-characteristics-guide',
    title: 'Dog breeds and characteristics',
    species: 'DOG',
    topic: 'BREEDS_AND_SPECIES',
    summary:
      'A beginner-friendly introduction to dog breeds, physical differences and individual needs.',
    sections: [
      'Introduce breed groups and general variation in size, coat and activity needs.',
      'Explain that breed labels do not reliably predict an individual dog’s personality.',
      'Discuss matching a dog’s needs with a household’s available space, time and resources.',
      'Add verified breed references and link appropriate breed records.',
    ],
  },
  {
    slug: 'dog-everyday-care-guide',
    title: 'Everyday care for dogs',
    species: 'DOG',
    topic: 'DAILY_CARE',
    summary:
      'An overview of daily routines, comfortable surroundings and responsible dog ownership.',
    sections: [
      'Discuss predictable routines involving rest, access to water and appropriate activity.',
      'Describe the importance of clean living spaces and safe supervision.',
      'Introduce positive human interaction and respecting individual behaviour.',
      'Verify recommendations and add reputable supporting sources.',
    ],
  },
  {
    slug: 'dog-food-and-nutrition-guide',
    title: 'Food and nutrition for dogs',
    species: 'DOG',
    topic: 'NUTRITION',
    summary:
      'An overview of dog nutrition, appropriate feeding choices and veterinary nutrition discussions.',
    sections: [
      'Describe the concept of complete and balanced diets appropriate to life stage.',
      'Discuss why individual needs vary by activity, body condition and health status.',
      'Introduce food-label awareness, safe storage and access to water.',
      'Request qualified review for specific nutrition recommendations.',
    ],
  },
  {
    slug: 'dog-grooming-and-hygiene-guide',
    title: 'Dog grooming and hygiene',
    species: 'DOG',
    topic: 'GROOMING',
    summary:
      'A practical overview of coat-care needs, grooming comfort and routine hygiene.',
    sections: [
      'Explain how coat types and individual circumstances affect grooming needs.',
      'Discuss calm, positive handling and familiarization with grooming activities.',
      'Include general observation of coat, skin, ears and nails.',
      'Have professional guidance checked before including specific grooming techniques.',
    ],
  },
  {
    slug: 'dog-activity-and-enrichment-guide',
    title: 'Activity and enrichment for dogs',
    species: 'DOG',
    topic: 'ENRICHMENT',
    summary:
      'An overview of play, exploration and age-appropriate mental enrichment.',
    sections: [
      'Introduce play, exploration, scent-based activities and positive interaction.',
      'Discuss tailoring activities to the dog’s age, ability and temperament.',
      'Explain the importance of safe equipment and appropriate supervision.',
      'Add credible sources on canine behaviour and welfare.',
    ],
  },
  {
    slug: 'dog-preventive-care-and-vaccination-guide',
    title: 'Preventive care and vaccination awareness for dogs',
    species: 'DOG',
    topic: 'PREVENTIVE_CARE',
    summary:
      'An overview of preventive veterinary care and discussing vaccinations with a qualified professional.',
    sections: [
      'Describe the role of routine veterinary assessments and individualized preventive planning.',
      'Cover questions about vaccinations, parasite prevention and local requirements.',
      'Explain why health history, geography and lifestyle influence preventive-care decisions.',
      'Require a qualified veterinary reviewer to confirm all medical statements.',
    ],
  },
  {
    slug: 'dog-health-awareness-guide',
    title: 'Health awareness for dog owners',
    species: 'DOG',
    topic: 'HEALTH',
    summary:
      'An introduction to observing a dog’s wellbeing and seeking veterinary guidance when needed.',
    sections: [
      'Describe why changes in normal activity, appetite and behaviour deserve attention.',
      'Explain the limitations of online information for diagnosing illness.',
      'Encourage timely professional assessment for concerning changes.',
      'Require qualified verification of urgent warning signs and escalation guidance.',
    ],
  },
]

// ======================================================
// TURTLE ARTICLES — 6 TOPICS
// ======================================================

const turtleDrafts: DraftDefinition[] = [
  {
    slug: 'turtle-species-and-types-guide',
    title: 'Turtle species and types',
    species: 'TURTLE',
    topic: 'BREEDS_AND_SPECIES',
    summary:
      'An introduction to turtle species, identification and species-specific care requirements.',
    sections: [
      'Explain the importance of identifying the correct turtle species before choosing care guidance.',
      'Introduce differences among aquatic, semi-aquatic and terrestrial care contexts without assuming all turtles have identical needs.',
      'Discuss responsible sourcing and applicable wildlife ownership rules.',
      'Link verified species records and appropriate references.',
    ],
  },
  {
    slug: 'turtle-daily-care-and-handling-guide',
    title: 'Daily care and handling for turtles',
    species: 'TURTLE',
    topic: 'DAILY_CARE',
    summary:
      'An overview of hygiene, routine observation and careful handling of pet turtles.',
    sections: [
      'Describe the importance of routine enclosure observation and cleanliness.',
      'Introduce minimal-stress handling and species-dependent husbandry considerations.',
      'Discuss hygiene practices and the importance of washing hands after handling reptiles or their environments.',
      'Verify hygiene and animal-welfare details against reliable sources.',
    ],
  },
  {
    slug: 'turtle-food-and-nutrition-guide',
    title: 'Food and nutrition for turtles',
    species: 'TURTLE',
    topic: 'NUTRITION',
    summary:
      'An introduction to understanding species-specific feeding and nutrition needs.',
    sections: [
      'Explain why food requirements vary greatly among turtle species and life stages.',
      'Introduce the importance of correctly identifying the species before choosing a diet.',
      'Discuss the role of professional advice for nutritional concerns.',
      'Have qualified reviewers check dietary recommendations and references.',
    ],
  },
  {
    slug: 'turtle-habitat-lighting-and-temperature-guide',
    title: 'Turtle habitat, lighting and temperature',
    species: 'TURTLE',
    topic: 'HABITAT',
    summary:
      'An overview of species-appropriate turtle habitats and the importance of environmental conditions.',
    sections: [
      'Explain why habitat design depends on whether the species is aquatic, semi-aquatic or terrestrial.',
      'Introduce enclosure space, environmental monitoring and appropriate shelter.',
      'Cover the importance of researching species-specific lighting, temperature and water-quality requirements.',
      'Require reptile-experienced veterinary or husbandry review of specific environmental recommendations.',
    ],
  },
  {
    slug: 'turtle-preventive-care-guide',
    title: 'Preventive care for turtles',
    species: 'TURTLE',
    topic: 'PREVENTIVE_CARE',
    summary:
      'An introduction to preventive veterinary care and responsible turtle husbandry.',
    sections: [
      'Discuss the importance of identifying an appropriately experienced reptile veterinarian.',
      'Introduce routine observation and preventive husbandry review.',
      'Explain that mammal vaccination schedules must not be automatically applied to turtles.',
      'Have a qualified reviewer confirm all species-specific preventive-health statements.',
    ],
  },
  {
    slug: 'turtle-health-awareness-guide',
    title: 'Health awareness for turtle owners',
    species: 'TURTLE',
    topic: 'HEALTH',
    summary:
      'A beginner-friendly introduction to turtle wellbeing and recognizing when veterinary assessment is needed.',
    sections: [
      'Explain why owners should learn the normal behaviour and activity patterns of their turtle species.',
      'Discuss observing changes in normal feeding, movement and activity without attempting diagnosis.',
      'Emphasize timely assessment by a reptile-experienced veterinarian for concerning changes.',
      'Require professional review of clinical signs and urgent escalation advice.',
    ],
  },
]

// ======================================================
// ALL 20 COVERAGE DRAFTS
// ======================================================

const coverageDrafts: DraftDefinition[] = [
  ...catDrafts,
  ...dogDrafts,
  ...turtleDrafts,
]

// ======================================================
// CREATE ARTICLE DRAFT BODY
// ======================================================

function makeDraftBody(article: DraftDefinition): string {
  return [
    'EDITORIAL DRAFT — NOT APPROVED FOR PUBLICATION',
    'The following is a content outline, not a finished or professionally reviewed pet-care article. Replace editorial instructions with accurate, sourced content before requesting review.',

    'Article purpose',
    article.summary,

    'Applicability',
    `Pet group: ${article.species}. Identify any narrower breed, species, age or health limitations before publication.`,

    'Content to develop',
    ...article.sections.flatMap((section, index) => [
      `Section ${index + 1}`,
      section,
    ]),

    'Sources and verification',
    'Add traceable, relevant sources for all factual claims. Confirm the applicability of each source to the species discussed.',

    'Clinical and safety review',
    'Obtain approval from an appropriately qualified reviewer. Do not publish unverified diagnosis, treatment, medication, vaccination or emergency-care instructions.',

    'Editorial completion checklist',
    'Replace all instructions and placeholders with completed content. Check accuracy, accessibility, species applicability, sources, reviewer details and publication eligibility.',
  ].join('\n\n')
}

// ======================================================
// SEED DATABASE
// ======================================================

async function seedArticles() {
  console.log('Starting Purr-Pawsitive Paradise article seed...')

  // ----------------------------------------------------
  // Preserve original demo articles
  // ----------------------------------------------------

  for (const article of demoArticles) {
    await prisma.article.upsert({
      where: {
        slug: article.slug,
      },

      // Never replace user-edited articles.
      update: {},

      create: {
        ...article,

        topic: 'DAILY_CARE',
        status: 'PUBLISHED',

        sourceUrls: [],

        requiresClinicalReview: false,

        publishedAt: new Date(),
      },
    })

    console.log(`Demo article checked: ${article.slug}`)
  }

  // ----------------------------------------------------
  // Create coverage drafts
  // ----------------------------------------------------

  let checkedCount = 0

  for (const article of coverageDrafts) {
    await prisma.article.upsert({
      where: {
        slug: article.slug,
      },

      // Existing drafts, published articles and reviews
      // must never be overwritten by this seed.
      update: {},

      create: {
        slug: article.slug,
        title: article.title,
        summary: article.summary,

        body: makeDraftBody(article),

        species: article.species,
        topic: article.topic,

        status: 'DRAFT',

        // Sources must be added and verified in the
        // admin editor before approval.
        sourceUrls: [],

        // Require editorial/clinical review before
        // these drafts can become public.
        requiresClinicalReview: true,

        reviewerName: null,
        reviewerCredentials: null,

        reviewedAt: null,
        reviewDueAt: null,
        publishedAt: null,
      },
    })

    checkedCount += 1

    console.log(
      `Coverage draft checked (${checkedCount}/${coverageDrafts.length}): ${article.slug}`,
    )
  }

  console.log('')
  console.log('Article seeding finished.')
  console.log(`Original demo articles checked: ${demoArticles.length}`)
  console.log(`Coverage drafts checked: ${checkedCount}`)
  console.log('')
  console.log(
    'All new coverage articles remain drafts until properly completed and approved.',
  )
}

// ======================================================
// RUN
// ======================================================

seedArticles()
  .catch((error: unknown) => {
    console.error(
      'Could not seed articles:',
      error instanceof Error
        ? error.message
        : 'Unexpected database error.',
    )

    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
