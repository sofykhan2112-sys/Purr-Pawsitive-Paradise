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

type CoverageArticle = {
  slug: string
  title: string
  species: Species
  topic: Topic
  summary: string
  body: string
  sourceUrls: string[]
  requiresClinicalReview: boolean
}

const OLD_DRAFT_MARKER =
  'EDITORIAL DRAFT — NOT APPROVED FOR PUBLICATION'

function articleBody(
  introduction: string,
  sections: Array<{
    heading: string
    paragraphs: string[]
  }>,
): string {
  return [
    introduction,
    ...sections.flatMap((section) => [
      section.heading,
      ...section.paragraphs,
    ]),
    'Important note',
    'This information is educational and does not replace advice from a veterinarian who can assess an individual animal.',
  ].join('\n\n')
}

function clinicalDraftBody(
  introduction: string,
  sections: Array<{
    heading: string
    paragraphs: string[]
  }>,
): string {
  return [
    'AWAITING QUALIFIED CLINICAL REVIEW',
    introduction,
    ...sections.flatMap((section) => [
      section.heading,
      ...section.paragraphs,
    ]),
    'Clinical review status',
    'This article has supporting sources but remains unpublished until an appropriately qualified veterinary reviewer checks the clinical information and approves it for publication.',
    'Safety note',
    'This material is educational only. It does not diagnose illness, prescribe treatment, recommend medication doses or replace examination by a veterinarian.',
  ].join('\n\n')
}

// ======================================================
// ORIGINAL DEMONSTRATION ARTICLES
// ======================================================

const demoArticles = [
  {
    slug: 'demo-exploring-the-cat-guide',
    title: 'Exploring the cat guide',
    species: 'CAT' as const,
    summary:
      'Demo article: discover how the cat collection organises breeds, routines, enrichment and reviewed care information.',
    body: [
      'DEMONSTRATION CONTENT',
      'This article demonstrates the website’s article system. It is not veterinary advice.',
      'Finding your starting point',
      'The cat collection groups information into topics such as breeds, everyday care, nutrition, grooming and enrichment.',
      'Understanding article reviews',
      'Published care material includes sources and review information. Health-related material requires qualified review before publication.',
      'Your companion’s profile',
      'Sign in to add your cat’s name, breed or type and age information to your account.',
    ].join('\n\n'),
  },

  {
    slug: 'demo-exploring-the-dog-guide',
    title: 'Exploring the dog guide',
    species: 'DOG' as const,
    summary:
      'Demo article: find your way around the dog collection and learn where care resources appear.',
    body: [
      'DEMONSTRATION CONTENT',
      'This article demonstrates the website’s article system. It is not veterinary advice.',
      'Discovering the collection',
      'The dog collection organises articles about breeds, everyday routines, enrichment, grooming and reviewed care topics.',
      'Finding relevant information',
      'Article titles and summaries help you choose what to explore. Search and species filters narrow the collection.',
      'Keeping a pet profile',
      'Your account lets you add, edit and remove your own pet profiles.',
    ].join('\n\n'),
  },

  {
    slug: 'demo-exploring-the-turtle-guide',
    title: 'Exploring the turtle guide',
    species: 'TURTLE' as const,
    summary:
      'Demo article: preview the turtle collection’s organisation around species, habitat and reviewed care topics.',
    body: [
      'DEMONSTRATION CONTENT',
      'This article demonstrates the website’s article system. It is not veterinary advice.',
      'Exploring by topic',
      'The turtle collection includes species information, habitat topics, nutrition and reviewed health education.',
      'Checking applicability',
      'Turtle care varies substantially between species, so articles identify applicability and supporting sources.',
      'Adding your companion',
      'You can create a turtle profile in your account and add its species or type if known.',
    ].join('\n\n'),
  },
]

// ======================================================
// CAT ARTICLES
// ======================================================

const catArticles: CoverageArticle[] = [
  {
    slug: 'cat-breeds-and-characteristics-guide',
    title: 'Cat breeds and characteristics',
    species: 'CAT',
    topic: 'BREEDS_AND_SPECIES',
    summary:
      'An introduction to cat breeds, physical characteristics and the importance of understanding the individual cat.',
    body: articleBody(
      'Breed information can be a useful starting point when learning about a cat, but every cat is an individual. Age, early experiences, health, environment and personality all influence behaviour and everyday needs.',
      [
        {
          heading: 'Breed descriptions are a starting point',
          paragraphs: [
            'Cat breeds can differ in coat length, body size, appearance and some general activity tendencies. These descriptions should not be treated as guarantees about the personality of an individual cat.',
            'When choosing or caring for a cat, pay attention to the animal in front of you rather than relying only on a breed label.',
          ],
        },
        {
          heading: 'Individual needs matter',
          paragraphs: [
            'A young active cat may need different opportunities for play and exploration than an older cat. Previous experiences, confidence around people and the home environment can also affect what makes a cat comfortable.',
            'Long-haired and short-haired cats may also have different grooming requirements.',
          ],
        },
        {
          heading: 'Responsible research',
          paragraphs: [
            'Before bringing home a particular breed or type of cat, research its likely care requirements and consider whether your household can provide appropriate time, space, grooming and veterinary care.',
          ],
        },
      ],
    ),
    sourceUrls: [
      'https://www.rspca.org.uk/adviceandwelfare/pets/cats',
      'https://www.aspca.org/pet-care/cat-care',
    ],
    requiresClinicalReview: false,
  },

  {
    slug: 'cat-everyday-care-guide',
    title: 'Everyday care for cats',
    species: 'CAT',
    topic: 'DAILY_CARE',
    summary:
      'A practical introduction to daily routines, clean resources, comfortable resting areas and responsible cat care.',
    body: articleBody(
      'Good everyday cat care is built around predictable access to basic resources, a safe environment and regular attention to the cat’s normal behaviour.',
      [
        {
          heading: 'Food, water and toileting',
          paragraphs: [
            'Provide fresh clean water and suitable food appropriate to the individual cat. Food and water containers should be kept clean.',
            'Cats also need clean, accessible toileting facilities. Litter areas should be kept away from food and water where practical and should be placed somewhere the cat can use them comfortably.',
          ],
        },
        {
          heading: 'Rest and security',
          paragraphs: [
            'Cats benefit from comfortable resting areas and places where they can retreat without being disturbed.',
            'Many cats also value elevated spaces, hiding places and opportunities to choose whether or not to interact.',
          ],
        },
        {
          heading: 'Observe the individual cat',
          paragraphs: [
            'Learn what is normal for your cat, including eating, drinking, toileting, activity, sleep and social behaviour.',
            'Changes from the cat’s usual routine can be useful information to discuss with a veterinarian.',
          ],
        },
      ],
    ),
    sourceUrls: [
      'https://www.aspca.org/pet-care/cat-care/general-cat-care',
      'https://www.rspca.org.uk/adviceandwelfare/pets/cats/environment',
    ],
    requiresClinicalReview: false,
  },

  {
    slug: 'cat-food-and-nutrition-guide',
    title: 'Food and nutrition for cats',
    species: 'CAT',
    topic: 'NUTRITION',
    summary:
      'A general introduction to nutritionally appropriate cat food, hydration and life-stage feeding.',
    body: articleBody(
      'Cats need food that provides the nutrients required for their life stage and individual circumstances. Feeding needs can change with age, activity, body condition and health.',
      [
        {
          heading: 'Choose an appropriate complete diet',
          paragraphs: [
            'Use food intended for cats and appropriate to the animal’s life stage. Follow the manufacturer’s feeding information while remembering that individual needs can vary.',
            'Cats have species-specific nutritional requirements, so food designed for another animal should not be used as their regular diet.',
          ],
        },
        {
          heading: 'Fresh water',
          paragraphs: [
            'Fresh clean water should be available at all times. Water containers should be cleaned regularly and placed somewhere the cat is comfortable using them.',
          ],
        },
        {
          heading: 'Individual feeding needs',
          paragraphs: [
            'Age, activity, body condition and medical history can affect feeding requirements. A veterinarian can help when a cat has unusual nutritional needs or a significant change in appetite or weight.',
          ],
        },
        {
          heading: 'Food safety',
          paragraphs: [
            'Store pet food according to its label instructions and avoid assuming that human foods are safe for cats.',
          ],
        },
      ],
    ),
    sourceUrls: [
      'https://www.aspca.org/pet-care/cat-care/cat-nutrition-tips',
      'https://www.aspca.org/pet-care/cat-care/general-cat-care',
    ],
    requiresClinicalReview: false,
  },

  {
    slug: 'cat-grooming-and-coat-care-guide',
    title: 'Cat grooming and coat care',
    species: 'CAT',
    topic: 'GROOMING',
    summary:
      'An introduction to gentle grooming, coat care and making grooming comfortable for cats.',
    body: articleBody(
      'Cats perform much of their own grooming, but regular gentle coat care can still help owners remove loose hair, notice matting and become familiar with the condition of the coat.',
      [
        {
          heading: 'Groom according to coat type',
          paragraphs: [
            'Grooming needs vary between cats. Coat length, texture, age, mobility and individual tolerance all influence how much assistance a cat may need.',
            'Longer coats can require more frequent attention to avoid tangles and matting.',
          ],
        },
        {
          heading: 'Keep grooming calm',
          paragraphs: [
            'Short, positive grooming sessions are often easier for cats than long sessions.',
            'Allow the cat to move away if it becomes uncomfortable, frightened or agitated rather than forcing the interaction.',
          ],
        },
        {
          heading: 'Use grooming as observation',
          paragraphs: [
            'Routine grooming is an opportunity to notice changes such as matting, sore areas, unusual hair loss or changes in coat condition.',
            'Concerning or persistent changes should be discussed with a veterinarian rather than treated based only on online information.',
          ],
        },
      ],
    ),
    sourceUrls: [
      'https://www.rspca.org.uk/adviceandwelfare/pets/cats/health/grooming',
      'https://www.aspca.org/pet-care/cat-care/cat-grooming-tips',
    ],
    requiresClinicalReview: false,
  },

  {
    slug: 'cat-play-and-enrichment-guide',
    title: 'Play and enrichment for cats',
    species: 'CAT',
    topic: 'ENRICHMENT',
    summary:
      'Ideas for creating safe opportunities for play, exploration, climbing, choice and mental stimulation.',
    body: articleBody(
      'Enrichment gives cats opportunities to express normal behaviours such as exploring, playing, climbing, scratching, hiding and investigating their environment.',
      [
        {
          heading: 'Provide different opportunities',
          paragraphs: [
            'A varied environment can include resting areas, hiding places, elevated positions, scratching opportunities and safe toys.',
            'Rotating activities can help keep the environment interesting without requiring large numbers of toys at once.',
          ],
        },
        {
          heading: 'Interactive play',
          paragraphs: [
            'Play sessions can provide physical activity and mental stimulation while also creating positive interaction between a cat and its owner.',
            'Different cats enjoy different styles of play, so watch the cat’s response and allow it to disengage.',
          ],
        },
        {
          heading: 'Safety comes first',
          paragraphs: [
            'Check toys and enrichment items regularly. Remove damaged objects or anything the cat is trying to swallow.',
            'Supervise activities when an item could become unsafe if chewed, torn apart or tangled.',
          ],
        },
      ],
    ),
    sourceUrls: [
      'https://www.aspca.org/pet-care/cat-care/feline-diy-enrichment',
      'https://www.rspca.org.uk/adviceandwelfare/pets/cats/environment/indoors',
    ],
    requiresClinicalReview: false,
  },

  {
    slug: 'cat-preventive-care-and-vaccination-guide',
    title: 'Preventive care and vaccination awareness for cats',
    species: 'CAT',
    topic: 'PREVENTIVE_CARE',
    summary:
      'An introduction to preventive veterinary care and individualized discussions about vaccination and parasite prevention.',
    body: clinicalDraftBody(
      'Preventive care helps owners and veterinarians plan routine health monitoring and discuss risks before problems develop.',
      [
        {
          heading: 'Routine veterinary care',
          paragraphs: [
            'Regular veterinary assessment gives owners an opportunity to discuss the cat’s body condition, behaviour, dental health, lifestyle and other preventive-care needs.',
          ],
        },
        {
          heading: 'Vaccination decisions',
          paragraphs: [
            'Vaccination recommendations should be individualized. Age, health history, lifestyle, travel, local disease risks and previous vaccination history can affect the plan.',
            'This article intentionally does not provide a universal vaccination schedule.',
          ],
        },
        {
          heading: 'Parasite prevention',
          paragraphs: [
            'Parasite risks and appropriate preventive approaches can vary according to lifestyle and location. A veterinarian should advise on suitable products and timing.',
          ],
        },
      ],
    ),
    sourceUrls: [
      'https://www.rspca.org.uk/adviceandwelfare/pets/cats/health',
      'https://www.aspca.org/about-us/aspca-policy-and-position-statements/criteria-responsible-care',
    ],
    requiresClinicalReview: true,
  },

  {
    slug: 'cat-health-awareness-guide',
    title: 'Health awareness for cat owners',
    species: 'CAT',
    topic: 'HEALTH',
    summary:
      'General awareness of changes in a cat’s normal behaviour and when professional assessment may be needed.',
    body: clinicalDraftBody(
      'Knowing what is normal for an individual cat can help an owner recognise changes worth discussing with a veterinarian.',
      [
        {
          heading: 'Know the normal routine',
          paragraphs: [
            'Become familiar with the cat’s usual appetite, drinking, toileting, activity, grooming, sleep and social behaviour.',
          ],
        },
        {
          heading: 'Changes deserve attention',
          paragraphs: [
            'Persistent or significant changes in normal behaviour or physical condition should not be diagnosed from an article alone.',
            'Contact a veterinary professional when you are concerned about a cat’s health or wellbeing.',
          ],
        },
        {
          heading: 'Online information has limits',
          paragraphs: [
            'Different illnesses can produce similar outward changes. Examination and appropriate professional assessment are needed to determine the cause.',
          ],
        },
      ],
    ),
    sourceUrls: [
      'https://www.rspca.org.uk/adviceandwelfare/pets/cats/health',
      'https://www.aspca.org/pet-care/cat-care',
    ],
    requiresClinicalReview: true,
  },
]

// ======================================================
// DOG ARTICLES
// ======================================================

const dogArticles: CoverageArticle[] = [
  {
    slug: 'dog-breeds-and-characteristics-guide',
    title: 'Dog breeds and characteristics',
    species: 'DOG',
    topic: 'BREEDS_AND_SPECIES',
    summary:
      'A beginner-friendly introduction to dog breeds, physical variation and individual needs.',
    body: articleBody(
      'Dogs vary enormously in size, coat, physical build, activity and individual behaviour. Breed information can help with research, but it cannot completely predict the needs or personality of one dog.',
      [
        {
          heading: 'Physical differences',
          paragraphs: [
            'Different breeds and mixes may have very different adult sizes, coats and activity requirements.',
            'These differences can affect practical considerations such as space, grooming, exercise and transport.',
          ],
        },
        {
          heading: 'Look beyond the breed label',
          paragraphs: [
            'An individual dog’s age, previous experiences, training, health and temperament all affect everyday behaviour.',
            'Two dogs of the same breed can still have different preferences and care needs.',
          ],
        },
        {
          heading: 'Choose responsibly',
          paragraphs: [
            'Before choosing a dog, consider whether the household can provide suitable time, exercise, training, grooming, veterinary care and long-term financial support.',
          ],
        },
      ],
    ),
    sourceUrls: [
      'https://www.rspca.org.uk/adviceandwelfare/pets/dogs',
      'https://www.akc.org/expert-advice/health/how-to-keep-your-dog-healthy/',
    ],
    requiresClinicalReview: false,
  },

  {
    slug: 'dog-everyday-care-guide',
    title: 'Everyday care for dogs',
    species: 'DOG',
    topic: 'DAILY_CARE',
    summary:
      'An overview of daily routines, rest, activity, supervision and responsible dog ownership.',
    body: articleBody(
      'Dogs benefit from reliable access to basic resources and a routine that includes rest, suitable activity, social interaction and opportunities to behave normally.',
      [
        {
          heading: 'Build a predictable routine',
          paragraphs: [
            'Regular opportunities for eating, drinking, toileting, activity, training, enrichment and rest can make everyday life easier for both dogs and owners.',
          ],
        },
        {
          heading: 'Provide a safe environment',
          paragraphs: [
            'Dogs should have clean drinking water, a comfortable resting area and protection from avoidable household and outdoor hazards.',
            'Supervision should reflect the dog’s age, behaviour and environment.',
          ],
        },
        {
          heading: 'Positive interaction',
          paragraphs: [
            'Use calm, reward-based interaction and give the dog opportunities for appropriate physical and mental activity.',
            'Individual dogs differ, so adjust routines according to age, ability and temperament.',
          ],
        },
      ],
    ),
    sourceUrls: [
      'https://www.akc.org/expert-advice/health/why-your-dog-needs-routine/',
      'https://www.rspca.org.uk/adviceandwelfare/pets/dogs/health',
    ],
    requiresClinicalReview: false,
  },

  {
    slug: 'dog-food-and-nutrition-guide',
    title: 'Food and nutrition for dogs',
    species: 'DOG',
    topic: 'NUTRITION',
    summary:
      'A general introduction to appropriate dog food, hydration and adjusting feeding to the individual animal.',
    body: articleBody(
      'A dog’s regular diet should provide appropriate nutrition for its life stage and circumstances. Feeding requirements are not identical for every dog.',
      [
        {
          heading: 'Use suitable dog food',
          paragraphs: [
            'Choose food intended for dogs and appropriate to the animal’s life stage. Follow the product’s feeding guidance while considering the dog’s individual condition and activity.',
          ],
        },
        {
          heading: 'Water',
          paragraphs: [
            'Fresh clean drinking water should be available regularly and water containers should be kept clean.',
          ],
        },
        {
          heading: 'Individual factors',
          paragraphs: [
            'Age, size, activity, body condition and health can influence feeding needs.',
            'Owners with concerns about weight, appetite or special dietary requirements should discuss them with a veterinarian.',
          ],
        },
        {
          heading: 'Safe feeding',
          paragraphs: [
            'Store food appropriately and do not assume that foods suitable for people are safe or appropriate for dogs.',
          ],
        },
      ],
    ),
    sourceUrls: [
      'https://www.akc.org/expert-advice/health/how-to-keep-your-dog-healthy/',
      'https://www.aspca.org/about-us/aspca-policy-and-position-statements/criteria-responsible-care',
    ],
    requiresClinicalReview: false,
  },

  {
    slug: 'dog-grooming-and-hygiene-guide',
    title: 'Dog grooming and hygiene',
    species: 'DOG',
    topic: 'GROOMING',
    summary:
      'A practical introduction to coat care, grooming comfort and routine hygiene for dogs.',
    body: articleBody(
      'Grooming requirements vary greatly between dogs. Coat type, age, activity, environment and individual health all influence what routine care is appropriate.',
      [
        {
          heading: 'Coat care',
          paragraphs: [
            'Regular brushing can help maintain the coat and gives owners an opportunity to notice tangles, debris or changes in condition.',
            'Long, dense or specialised coats may require additional attention or professional grooming.',
          ],
        },
        {
          heading: 'Make grooming positive',
          paragraphs: [
            'Introduce grooming gradually and use calm, reward-based handling.',
            'If a dog is frightened, uncomfortable or struggling, forcing the procedure can make future grooming more difficult.',
          ],
        },
        {
          heading: 'Observe while grooming',
          paragraphs: [
            'Routine grooming is a useful time to notice changes involving the coat, skin, ears, paws or nails.',
            'Persistent soreness, unusual hair loss or other concerning changes should be discussed with a veterinarian.',
          ],
        },
      ],
    ),
    sourceUrls: [
      'https://www.rspca.org.uk/adviceandwelfare/pets/dogs/health/grooming',
      'https://www.rspca.org.uk/adviceandwelfare/pets/dogs/health',
    ],
    requiresClinicalReview: false,
  },

  {
    slug: 'dog-activity-and-enrichment-guide',
    title: 'Activity and enrichment for dogs',
    species: 'DOG',
    topic: 'ENRICHMENT',
    summary:
      'An introduction to suitable physical activity, play, exploration, training and mental enrichment.',
    body: articleBody(
      'Dogs need opportunities for physical activity and mental engagement, but the right amount and type vary between individuals.',
      [
        {
          heading: 'Think beyond exercise',
          paragraphs: [
            'Enrichment can include play, safe exploration, sniffing, simple training activities and interaction with people.',
            'Mental activities can complement physical exercise rather than simply trying to tire a dog through constant intense activity.',
          ],
        },
        {
          heading: 'Adapt activities',
          paragraphs: [
            'Consider age, physical ability, confidence, temperament and environmental conditions when choosing an activity.',
            'Young, older or physically limited dogs may need a different approach from healthy adult dogs.',
          ],
        },
        {
          heading: 'Supervise for safety',
          paragraphs: [
            'Check toys and equipment for damage and supervise activities when necessary.',
            'Stop an activity when the dog appears distressed, excessively tired or unable to participate comfortably.',
          ],
        },
      ],
    ),
    sourceUrls: [
      'https://www.akc.org/expert-advice/health/why-your-dog-needs-routine/',
      'https://www.aspca.org/about-us/aspca-policy-and-position-statements/criteria-responsible-care',
    ],
    requiresClinicalReview: false,
  },

  {
    slug: 'dog-preventive-care-and-vaccination-guide',
    title: 'Preventive care and vaccination awareness for dogs',
    species: 'DOG',
    topic: 'PREVENTIVE_CARE',
    summary:
      'An introduction to routine veterinary care and individualized preventive-health planning.',
    body: clinicalDraftBody(
      'Preventive veterinary care helps owners discuss health risks, routine assessment, vaccination and parasite prevention with a qualified professional.',
      [
        {
          heading: 'Routine assessment',
          paragraphs: [
            'Routine veterinary visits can provide opportunities to discuss body condition, dental health, behaviour, lifestyle and preventive-care needs.',
          ],
        },
        {
          heading: 'Vaccination',
          paragraphs: [
            'Vaccination plans depend on factors such as age, health history, lifestyle, travel, location and previous vaccination history.',
            'A universal vaccination timetable is intentionally not provided here.',
          ],
        },
        {
          heading: 'Parasite prevention',
          paragraphs: [
            'Parasite risks vary between animals and locations. A veterinarian can recommend appropriate preventive products and timing.',
          ],
        },
      ],
    ),
    sourceUrls: [
      'https://www.rspca.org.uk/adviceandwelfare/pets/dogs/health',
      'https://www.aspca.org/about-us/aspca-policy-and-position-statements/criteria-responsible-care',
    ],
    requiresClinicalReview: true,
  },

  {
    slug: 'dog-health-awareness-guide',
    title: 'Health awareness for dog owners',
    species: 'DOG',
    topic: 'HEALTH',
    summary:
      'General awareness of changes in a dog’s normal behaviour and wellbeing.',
    body: clinicalDraftBody(
      'Owners who know their dog’s normal habits are better placed to recognise changes that may deserve professional attention.',
      [
        {
          heading: 'Know what is normal',
          paragraphs: [
            'Become familiar with the dog’s normal eating, drinking, activity, sleep, toileting, movement and social behaviour.',
          ],
        },
        {
          heading: 'Notice meaningful changes',
          paragraphs: [
            'Changes in normal behaviour can have many possible causes and should not be diagnosed using an online article.',
            'Seek veterinary guidance when a change is significant, persistent or concerning.',
          ],
        },
        {
          heading: 'Do not self-medicate',
          paragraphs: [
            'Do not give human medicines or medicines intended for another animal unless specifically instructed by a veterinarian.',
          ],
        },
      ],
    ),
    sourceUrls: [
      'https://www.rspca.org.uk/adviceandwelfare/pets/dogs/health',
      'https://www.akc.org/expert-advice/health/how-to-keep-your-dog-healthy/',
    ],
    requiresClinicalReview: true,
  },
]

// ======================================================
// TURTLE ARTICLES
// ======================================================

const turtleArticles: CoverageArticle[] = [
  {
    slug: 'turtle-species-and-types-guide',
    title: 'Turtle species and types',
    species: 'TURTLE',
    topic: 'BREEDS_AND_SPECIES',
    summary:
      'An introduction to turtle diversity and why correct species identification matters for responsible care.',
    body: articleBody(
      'The word turtle covers animals with very different natural environments and husbandry needs. Correct species identification is therefore one of the most important starting points for responsible care.',
      [
        {
          heading: 'Turtles are not all cared for the same way',
          paragraphs: [
            'Aquatic, semi-aquatic and terrestrial species can differ greatly in enclosure, water, basking, diet and environmental requirements.',
            'Advice appropriate for one turtle species may be unsuitable for another.',
          ],
        },
        {
          heading: 'Identify the species',
          paragraphs: [
            'Record the species or type where possible before following detailed husbandry advice.',
            'If identification is uncertain, consult a reptile-experienced veterinarian or another appropriately qualified professional.',
          ],
        },
        {
          heading: 'Responsible sourcing',
          paragraphs: [
            'Owners should also check applicable wildlife, trade and ownership rules for the species in their location.',
          ],
        },
      ],
    ),
    sourceUrls: [
      'https://www.merckvetmanual.com/management-and-nutrition/nutrition-exotic-and-zoo-animals/nutrition-in-turtles',
      'https://vcahospitals.com/know-your-pet/turtles-aquatic-housing',
    ],
    requiresClinicalReview: false,
  },

  {
    slug: 'turtle-daily-care-and-handling-guide',
    title: 'Daily care and handling for turtles',
    species: 'TURTLE',
    topic: 'DAILY_CARE',
    summary:
      'An introduction to routine enclosure checks, hygiene, observation and careful handling of pet turtles.',
    body: articleBody(
      'Daily turtle care should focus on observing the animal and its environment while maintaining good hygiene and minimising unnecessary stress.',
      [
        {
          heading: 'Check the environment',
          paragraphs: [
            'Look at the enclosure each day for obvious problems involving cleanliness, water, equipment or access to the areas the species requires.',
            'Detailed environmental requirements depend on the species.',
          ],
        },
        {
          heading: 'Handle thoughtfully',
          paragraphs: [
            'Avoid unnecessary handling and support the animal securely when handling is required.',
            'Turtles should not be treated as toys, and interactions should prioritise both animal welfare and hygiene.',
          ],
        },
        {
          heading: 'Wash hands',
          paragraphs: [
            'Reptiles, including turtles, can carry Salmonella even when they appear healthy and clean.',
            'Wash hands thoroughly with soap and water after touching a turtle, its food, enclosure, water or equipment.',
          ],
        },
        {
          heading: 'Keep pet equipment separate',
          paragraphs: [
            'Avoid cleaning turtle equipment in areas used for preparing or eating food where possible.',
          ],
        },
      ],
    ),
    sourceUrls: [
      'https://www.cdc.gov/healthy-pets/about/reptiles-and-amphibians.html',
      'https://www.cdc.gov/salmonella/outbreaks/turtles-08-26/index.html',
    ],
    requiresClinicalReview: false,
  },

  {
    slug: 'turtle-food-and-nutrition-guide',
    title: 'Food and nutrition for turtles',
    species: 'TURTLE',
    topic: 'NUTRITION',
    summary:
      'A general introduction to species-specific turtle feeding and why one diet does not suit every turtle.',
    body: articleBody(
      'Turtle diets vary substantially between species and can also change with age. Correct identification should come before detailed feeding decisions.',
      [
        {
          heading: 'Species determines diet',
          paragraphs: [
            'Some turtles are primarily herbivorous, while others consume combinations of plant and animal material.',
            'Even closely related species may have different nutritional requirements.',
          ],
        },
        {
          heading: 'Life stage matters',
          paragraphs: [
            'The balance of foods eaten by some turtle species changes as the animal grows.',
            'Avoid copying a diet intended for a different species or life stage.',
          ],
        },
        {
          heading: 'Use appropriate guidance',
          paragraphs: [
            'Reliable species-specific husbandry references and advice from a reptile-experienced veterinarian are preferable to generic feeding lists from unverified sources.',
          ],
        },
        {
          heading: 'Keep feeding areas hygienic',
          paragraphs: [
            'Remove spoiled or leftover food appropriately and maintain the cleanliness of feeding and enclosure areas.',
          ],
        },
      ],
    ),
    sourceUrls: [
      'https://www.merckvetmanual.com/management-and-nutrition/nutrition-exotic-and-zoo-animals/nutrition-in-turtles',
      'https://vcahospitals.com/st-marys/know-your-pet/turtles-aquatic-feeding',
    ],
    requiresClinicalReview: false,
  },

  {
    slug: 'turtle-habitat-lighting-and-temperature-guide',
    title: 'Turtle habitat, lighting and temperature',
    species: 'TURTLE',
    topic: 'HABITAT',
    summary:
      'An introduction to species-appropriate turtle housing, environmental monitoring, lighting and water quality.',
    body: articleBody(
      'Turtle housing must be designed for the particular species. Aquatic, semi-aquatic and terrestrial turtles cannot all be kept under the same environmental conditions.',
      [
        {
          heading: 'Start with the species',
          paragraphs: [
            'Determine whether the turtle requires primarily aquatic, semi-aquatic or terrestrial housing and research the needs of that specific species.',
          ],
        },
        {
          heading: 'Provide usable space',
          paragraphs: [
            'The enclosure should allow the turtle to move normally and access the environmental areas required by its species.',
            'Aquatic species generally require suitable swimming water as well as access to an appropriate dry or basking area.',
          ],
        },
        {
          heading: 'Monitor the environment',
          paragraphs: [
            'Temperature, lighting and water quality can have major effects on reptile husbandry.',
            'Use appropriate measuring equipment rather than estimating environmental conditions by touch.',
          ],
        },
        {
          heading: 'Lighting and heating',
          paragraphs: [
            'Many commonly kept turtles require carefully managed heat and ultraviolet lighting, but exact requirements differ by species.',
            'Research the specific animal rather than applying one temperature or lighting setup to every turtle.',
          ],
        },
      ],
    ),
    sourceUrls: [
      'https://vcahospitals.com/know-your-pet/turtles-aquatic-housing',
      'https://www.merckvetmanual.com/management-and-nutrition/nutrition-exotic-and-zoo-animals/nutrition-in-turtles',
    ],
    requiresClinicalReview: false,
  },

  {
    slug: 'turtle-preventive-care-guide',
    title: 'Preventive care for turtles',
    species: 'TURTLE',
    topic: 'PREVENTIVE_CARE',
    summary:
      'An introduction to preventive veterinary care, husbandry review and responsible health monitoring for turtles.',
    body: clinicalDraftBody(
      'Preventive care for turtles depends heavily on correct species identification and appropriate husbandry.',
      [
        {
          heading: 'Find suitable veterinary care',
          paragraphs: [
            'Owners should identify a veterinarian with appropriate reptile experience before an urgent problem occurs.',
          ],
        },
        {
          heading: 'Review husbandry',
          paragraphs: [
            'Preventive discussions may include the enclosure, diet, lighting, heating, water quality, hygiene and the animal’s normal behaviour.',
          ],
        },
        {
          heading: 'Species-specific planning',
          paragraphs: [
            'Preventive care used routinely for dogs or cats should not automatically be applied to turtles.',
            'A reptile-experienced veterinarian should advise on the needs of the individual turtle.',
          ],
        },
      ],
    ),
    sourceUrls: [
      'https://www.cdc.gov/healthy-pets/about/reptiles-and-amphibians.html',
      'https://vcahospitals.com/know-your-pet/turtles-aquatic-housing',
    ],
    requiresClinicalReview: true,
  },

  {
    slug: 'turtle-health-awareness-guide',
    title: 'Health awareness for turtle owners',
    species: 'TURTLE',
    topic: 'HEALTH',
    summary:
      'General awareness of a turtle’s normal behaviour and the importance of professional assessment for concerning changes.',
    body: clinicalDraftBody(
      'Turtles can have species-specific behaviour patterns, so owners should first learn what is normal for the particular animal they keep.',
      [
        {
          heading: 'Know the individual animal',
          paragraphs: [
            'Become familiar with normal feeding, movement, basking, swimming or terrestrial activity as appropriate for the species.',
          ],
        },
        {
          heading: 'Observe changes',
          paragraphs: [
            'A significant or persistent change from normal behaviour can have many causes and should not be diagnosed using an online article.',
          ],
        },
        {
          heading: 'Seek appropriate professional help',
          paragraphs: [
            'If you are concerned about a turtle’s health, contact a veterinarian experienced with reptiles.',
            'Bring relevant information about housing, temperature, lighting, diet and recent changes because husbandry is an important part of reptile assessment.',
          ],
        },
      ],
    ),
    sourceUrls: [
      'https://vcahospitals.com/know-your-pet/turtles-aquatic-housing',
      'https://www.merckvetmanual.com/management-and-nutrition/nutrition-exotic-and-zoo-animals/nutrition-in-turtles',
    ],
    requiresClinicalReview: true,
  },
]

// ======================================================
// ALL COVERAGE ARTICLES
// ======================================================

const coverageArticles: CoverageArticle[] = [
  ...catArticles,
  ...dogArticles,
  ...turtleArticles,
]

// ======================================================
// SEED HELPERS
// ======================================================

function shouldPublish(article: CoverageArticle): boolean {
  return !article.requiresClinicalReview
}

async function seedDemoArticles() {
  for (const article of demoArticles) {
    await prisma.article.upsert({
      where: {
        slug: article.slug,
      },

      // Preserve existing demo articles if they have been edited.
      update: {},

      create: {
        ...article,

        topic: 'DAILY_CARE',
        status: 'PUBLISHED',

        sourceUrls: [],

        requiresClinicalReview: false,

        reviewerName: null,
        reviewerCredentials: null,

        reviewedAt: null,
        reviewDueAt: null,

        publishedAt: new Date(),
      },
    })

    console.log(`Demo article checked: ${article.slug}`)
  }
}

async function seedCoverageArticle(article: CoverageArticle) {
  const existing = await prisma.article.findUnique({
    where: {
      slug: article.slug,
    },

    select: {
      id: true,
      slug: true,
      body: true,
      status: true,
    },
  })

  const publish = shouldPublish(article)

  const data = {
    title: article.title,
    summary: article.summary,
    body: article.body,

    species: article.species,
    topic: article.topic,

    sourceUrls: article.sourceUrls,

    requiresClinicalReview:
      article.requiresClinicalReview,

    reviewerName: null,
    reviewerCredentials: null,

    reviewedAt: null,
    reviewDueAt: null,

    status: publish ? ('PUBLISHED' as const) : ('DRAFT' as const),

    publishedAt: publish ? new Date() : null,
  }

  // ----------------------------------------------------
  // New article
  // ----------------------------------------------------

  if (!existing) {
    await prisma.article.create({
      data: {
        slug: article.slug,
        ...data,
      },
    })

    console.log(
      `${publish ? 'Published' : 'Clinical draft created'}: ${article.slug}`,
    )

    return
  }

  // ----------------------------------------------------
  // Upgrade only our old generated editorial placeholder.
  //
  // Anything manually edited by the user is preserved.
  // ----------------------------------------------------

  if (
    existing.body
      .trim()
      .startsWith(OLD_DRAFT_MARKER)
  ) {
    await prisma.article.update({
      where: {
        id: existing.id,
      },

      data,
    })

    console.log(
      `${publish ? 'Published' : 'Clinical draft upgraded'}: ${article.slug}`,
    )

    return
  }

  console.log(
    `Preserved existing edited article: ${article.slug}`,
  )
}

// ======================================================
// SEED DATABASE
// ======================================================

async function seedArticles() {
  console.log(
    'Starting Purr-Pawsitive Paradise article seed...',
  )

  console.log('')
  console.log('Checking demonstration articles...')
  console.log('')

  await seedDemoArticles()

  console.log('')
  console.log('Processing FR02 coverage articles...')
  console.log('')

  let publishedCount = 0
  let clinicalDraftCount = 0
  let checkedCount = 0

  for (const article of coverageArticles) {
    await seedCoverageArticle(article)

    checkedCount += 1

    if (article.requiresClinicalReview) {
      clinicalDraftCount += 1
    } else {
      publishedCount += 1
    }
  }

  console.log('')
  console.log('Article seeding finished.')
  console.log(
    `Demo articles checked: ${demoArticles.length}`,
  )
  console.log(
    `Coverage articles checked: ${checkedCount}`,
  )
  console.log(
    `Non-clinical coverage articles eligible for publication: ${publishedCount}`,
  )
  console.log(
    `Clinical articles remaining in review-required state: ${clinicalDraftCount}`,
  )
  console.log('')
  console.log(
    'Clinical HEALTH and PREVENTIVE_CARE content remains unpublished until qualified review is recorded.',
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