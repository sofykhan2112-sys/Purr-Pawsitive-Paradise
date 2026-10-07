import {
  Link,
  NavLink,
} from 'react-router'

import ArticleCollection from './ArticleCollection'
import './PetGuide.css'

const guides = {
  cats: {
    name: 'Cats',
    chapter: '01',
    subtitle:
      'THE CAT COLLECTION',
    title:
      'Independent spirits.',
    accent:
      'Extraordinary company.',
    introduction:
      'Explore the world of cats, with a collection being built around their personalities, routines, and everyday needs.',
    libraryLabel:
      'Explore cat breeds',
    topics: [
      {
        title:
          'Breeds & personalities',
        description:
          'Explore cat breed and type records with stable pages, characteristics, and care context.',
      },
      {
        title:
          'Everyday care',
        description:
          'A place to explore routines, grooming, and life with your cat.',
      },
      {
        title:
          'Food & nutrition',
        description:
          'Upcoming reviewed information about feline nutrition.',
      },
      {
        title:
          'Play & enrichment',
        description:
          'Explore topics around activity, play, and your cat’s environment.',
      },
      {
        title:
          'Preventive care',
        description:
          'Upcoming reviewed resources about veterinary preventive care.',
      },
      {
        title:
          'Health awareness',
        description:
          'Reviewed educational resources will be added before publication.',
      },
    ],
  },

  dogs: {
    name: 'Dogs',
    chapter: '02',
    subtitle:
      'THE DOG COLLECTION',
    title:
      'Life’s better',
    accent:
      'with a loyal companion.',
    introduction:
      'Get to know the companions who share our walks, our homes, and our everyday adventures.',
    libraryLabel:
      'Explore dog breeds',
    topics: [
      {
        title:
          'Breeds & personalities',
        description:
          'Explore dog breed and type records with stable pages, characteristics, and care context.',
      },
      {
        title:
          'Everyday care',
        description:
          'Explore the responsibilities and routines of living with a dog.',
      },
      {
        title:
          'Food & nutrition',
        description:
          'Upcoming reviewed information about canine nutrition.',
      },
      {
        title:
          'Activity & enrichment',
        description:
          'A collection covering exercise, play, and enrichment topics.',
      },
      {
        title:
          'Grooming',
        description:
          'Explore grooming topics across different coat types.',
      },
      {
        title:
          'Preventive care & health',
        description:
          'Reviewed veterinary education will be added before publication.',
      },
    ],
  },

  turtles: {
    name: 'Turtles',
    chapter: '03',
    subtitle:
      'THE TURTLE COLLECTION',
    title:
      'A slower pace.',
    accent:
      'A world to discover.',
    introduction:
      'Explore turtle species and their distinct needs, with a collection focused on understanding each animal’s care requirements.',
    libraryLabel:
      'Explore turtle species & types',
    topics: [
      {
        title:
          'Species & types',
        description:
          'Explore turtle species and type records and learn why correct identification matters for care.',
      },
      {
        title:
          'Habitat',
        description:
          'Upcoming species-specific resources about suitable environments.',
      },
      {
        title:
          'Food & nutrition',
        description:
          'Reviewed feeding information will be organised by species.',
      },
      {
        title:
          'Lighting & temperature',
        description:
          'A dedicated topic for reviewed environmental requirements.',
      },
      {
        title:
          'Hygiene & handling',
        description:
          'Upcoming reviewed information about hygiene and handling.',
      },
      {
        title:
          'Preventive care & health',
        description:
          'Educational resources about veterinary care for turtles.',
      },
    ],
  },
}

type Species =
  keyof typeof guides

const articleSpecies = {
  cats: 'CAT',
  dogs: 'DOG',
  turtles: 'TURTLE',
} as const

function PetGuide({
  species,
}: {
  species: Species
}) {
  const guide =
    guides[species]

  return (
    <div
      className={`guide-page guide-${species}`}
    >
      <a
        className="skip-link"
        href="#guide-main"
      >
        Skip to content
      </a>

      <header className="header">
        <Link
          className="brand"
          to="/"
        >
          <span
            className="brand-mark"
            aria-hidden="true"
          >
            pp.
          </span>

          <span>
            Purr-Pawsitive
            <small>
              PARADISE
            </small>
          </span>
        </Link>

        <nav
          aria-label="Pet guide navigation"
        >
          <NavLink to="/pets/cats">
            Cats
          </NavLink>

          <NavLink to="/pets/dogs">
            Dogs
          </NavLink>

          <NavLink to="/pets/turtles">
            Turtles
          </NavLink>

          <Link
            to={`/pets/${species}/breeds`}
          >
            Breed & species library
          </Link>

          <Link
            to={`/rapid-relief?species=${articleSpecies[species]}`}
          >
            Rapid Relief
          </Link>
        </nav>

        <Link
          className="header-link"
          to="/"
        >
          Back to home
        </Link>
      </header>

      <main id="guide-main">
        <div className="page-width">
          <nav
            className="breadcrumbs"
            aria-label="Breadcrumb"
          >
            <Link to="/">
              Home
            </Link>

            <span
              aria-hidden="true"
            >
              /
            </span>

            <span
              aria-current="page"
            >
              {guide.name}
            </span>
          </nav>

          <section
            className="guide-hero"
            aria-labelledby="guide-title"
          >
            <div className="guide-hero-copy">
              <p className="eyebrow">
                {guide.subtitle}
              </p>

              <h1 id="guide-title">
                {guide.title}
                <br />

                <em>
                  {guide.accent}
                </em>
              </h1>

              <p className="guide-introduction">
                {
                  guide.introduction
                }
              </p>

              <div
                style={{
                  display:
                    'flex',
                  gap:
                    '0.75rem',
                  flexWrap:
                    'wrap',
                }}
              >
                <a
                  className="button dark-button"
                  href="#guide-articles"
                >
                  Explore the
                  collection
                </a>

                <Link
                  className="button"
                  to={`/pets/${species}/breeds`}
                >
                  {
                    guide.libraryLabel
                  }
                </Link>
              </div>
            </div>

            <div
              className="guide-chapter"
              aria-hidden="true"
            >
              <span className="eyebrow">
                COMPANION
                COLLECTION
              </span>

              <span className="guide-chapter-number">
                {guide.chapter}
              </span>

              <span className="guide-chapter-name">
                {guide.name}
              </span>
            </div>
          </section>

          <div id="guide-articles">
            <ArticleCollection
              key={species}
              species={
                articleSpecies[
                  species
                ]
              }
            />
          </div>

          <section
            className="guide-topics"
            id="guide-topics"
            aria-labelledby="topics-title"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">
                  ONE TOPIC AT A
                  TIME
                </p>

                <h2 id="topics-title">
                  Get to know
                  their world.
                </h2>
              </div>

              <p>
                A first look at
                our planned
                collection.
                <br />
                Browse available
                articles in the
                reading corner
                above.
              </p>
            </div>

            <div className="guide-topic-grid">
              {guide.topics.map(
                (
                  topic,
                  index,
                ) => (
                  <article
                    className="guide-topic-card"
                    key={
                      topic.title
                    }
                  >
                    <span className="guide-topic-number">
                      {String(
                        index + 1,
                      ).padStart(
                        2,
                        '0',
                      )}
                    </span>

                    <h3>
                      {topic.title}
                    </h3>

                    <p>
                      {
                        topic.description
                      }
                    </p>

                    <span className="guide-topic-badge">
                      Topic
                      preview
                    </span>
                  </article>
                ),
              )}
            </div>
          </section>

          <aside className="guide-editorial-note">
            <p className="eyebrow">
              BUILT WITH CARE
            </p>

            <h2>
              Good information
              deserves a careful
              review.
            </h2>

            <p>
              Breed and species
              records provide
              characteristics and
              care context. Health
              material requires
              qualified review
              before it becomes
              available.
            </p>
          </aside>

          <div className="guide-return">
            <Link
              className="text-link"
              to="/"
            >
              Back to
              Purr-Pawsitive
              Paradise
            </Link>
          </div>
        </div>
      </main>

      <footer className="footer">
        <div className="page-width footer-inner">
          <Link
            className="footer-brand"
            to="/"
          >
            Purr-Pawsitive
            Paradise
          </Link>

          <p>
            For the love of
            little companions.
          </p>

          <span>
            ©{' '}
            {new Date()
              .getFullYear()}
          </span>
        </div>
      </footer>
    </div>
  )
}

export default PetGuide
