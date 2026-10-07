import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import './App.css'

const companions = {
  Cats: {
    number: '01',
    title: 'A little mystery. A lot to love.',
    description:
      'Get to know your cat, from everyday routines and enrichment to nutrition and grooming.',
    topics: [
      'Breeds & personalities',
      'Everyday care',
      'Food & nutrition',
    ],
  },
  Dogs: {
    number: '02',
    title: 'For their every adventure.',
    description:
      'Discover a world of canine companionship, with guides to daily care, activity, and understanding your dog.',
    topics: [
      'Find your breed',
      'Activity & enrichment',
      'Grooming essentials',
    ],
  },
  Turtles: {
    number: '03',
    title: 'Small steps. Extraordinary companions.',
    description:
      'Explore turtle species and their different needs, with an introduction to habitats, feeding, and responsible care.',
    topics: [
      'Species & types',
      'Habitat essentials',
      'Feeding & care',
    ],
  },
}

type Companion = keyof typeof companions

type SessionUser = {
  id: string
  name: string
  role: string
}

type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; user: SessionUser }
  | { status: 'error' }

function Arrow() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

function Home() {
  const [selected, setSelected] = useState<Companion>('Cats')
  const [session, setSession] = useState<SessionState>({
    status: 'loading',
  })

  const companion = companions[selected]

  useEffect(() => {
    let controller: AbortController | null = null

    async function loadSession() {
      controller?.abort()

      const requestController = new AbortController()
      controller = requestController

      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: requestController.signal,
        })

        if (requestController.signal.aborted) return

        if (response.status === 401) {
          setSession({ status: 'signed-out' })
          return
        }

        if (!response.ok) {
          throw new Error('Could not check the session.')
        }

        const data = await response.json()

        if (
          typeof data?.user?.id !== 'string' ||
          typeof data.user.name !== 'string' ||
          typeof data.user.role !== 'string'
        ) {
          throw new Error('Invalid session response.')
        }

        if (!requestController.signal.aborted) {
          setSession({
            status: 'signed-in',
            user: {
              id: data.user.id,
              name: data.user.name,
              role: data.user.role,
            },
          })
        }
      } catch {
        if (!requestController.signal.aborted) {
          setSession({ status: 'error' })
        }
      }
    }

    function refreshSession() {
      void loadSession()
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        refreshSession()
      }
    }

    refreshSession()

    window.addEventListener('focus', refreshSession)
    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    )

    return () => {
      controller?.abort()
      window.removeEventListener('focus', refreshSession)
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      )
    }
  }, [])

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="header">
        <a
          className="brand"
          href="#home"
          aria-label="Purr-Pawsitive Paradise home"
        >
          <span className="brand-mark" aria-hidden="true">
            pp.
          </span>

          <span>
            Purr-Pawsitive
            <small>PARADISE</small>
          </span>
        </a>

        <nav aria-label="Main navigation">
          <a href="#companions">Pet guides</a>
          <a href="#services">Care & support</a>
          <a href="#about">Our story</a>

          {session.status === 'signed-out' && (
            <Link to="/login">Sign in</Link>
          )}

          {session.status === 'signed-in' &&
            session.user.role === 'ADMIN' && (
              <Link to="/admin/articles">
                Manage articles
              </Link>
            )}
        </nav>

        {session.status === 'loading' ? (
          <span role="status">Checking account…</span>
        ) : session.status === 'signed-out' ? (
          <Link className="button dark-button" to="/signup">
            Join us <Arrow />
          </Link>
        ) : (
          <Link className="button dark-button" to="/account">
            My account <Arrow />
          </Link>
        )}
      </header>

      <main id="main">
        {session.status === 'error' && (
          <div className="page-width">
            <p role="status">
              We couldn’t check your sign-in status. Open My account
              to try again.
            </p>
          </div>
        )}

        <section className="hero page-width" id="home">
          <div className="hero-copy">
            <p className="eyebrow">
              A THOUGHTFUL SPACE FOR PET PEOPLE
            </p>

            <h1>
              Their little world.
              <br />
              <em>Your whole heart.</em>
            </h1>

            <p className="hero-description">
              Get to know them better. Care for them with confidence.
              A welcoming world for cats, dogs, turtles—and the people
              who love them.
            </p>

            <div className="hero-actions">
              <a
                className="button dark-button"
                href="#companions"
              >
                Find your companion <Arrow />
              </a>

              <a className="text-link" href="#services">
                Explore care & support
              </a>
            </div>

            <div className="hero-footnote">
              <span className="small-line" />
              Different companions. The same big love.
            </div>
          </div>

          <div className="hero-visual">
            <img
              src="/images/pet-hero.png"
              alt="A golden retriever sitting beside a cream-coloured cat"
              width="1122"
              height="1402"
              fetchPriority="high"
            />

            <div className="image-label">
              <span>THE GOOD LIFE, TOGETHER</span>
              <strong>A softer place to land.</strong>
            </div>
          </div>
        </section>

        <div className="values-strip">
          <span>Curiosity meets care</span>
          <span>Made for everyday companionship</span>
          <span>Cats, dogs & turtles</span>
        </div>

        <section
          className="companions page-width"
          id="companions"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                EVERY PERSONALITY BELONGS
              </p>

              <h2>
                Who’s your kind
                <br />
                of companion?
              </h2>
            </div>

            <p>
              Different habits. Different needs.
              <br />
              Find a starting point made for them.
            </p>
          </div>

          <div
            className="pet-switcher"
            role="group"
            aria-label="Choose a pet group"
          >
            {(Object.keys(companions) as Companion[]).map(
              (pet) => (
                <button
                  key={pet}
                  type="button"
                  aria-pressed={selected === pet}
                  onClick={() => setSelected(pet)}
                >
                  {pet}
                  <Arrow />
                </button>
              ),
            )}
          </div>

          <article
            className="companion-panel"
            aria-live="polite"
          >
            <div className="companion-intro">
              <span className="chapter-number">
                {companion.number}
              </span>

              <p className="eyebrow">
                THE {selected.toUpperCase()} EDIT
              </p>

              <h3>{companion.title}</h3>
              <p>{companion.description}</p>
            </div>

            <div className="topic-list">
              {companion.topics.map((topic, index) => (
                <div className="topic-row" key={topic}>
                  <span className="topic-number">
                    0{index + 1}
                  </span>

                  <span>{topic}</span>

                  <span className="topic-status">
                    Topic preview
                  </span>
                </div>
              ))}

              <p className="availability-note">
                Explore the collection for available articles
                and upcoming topics.
              </p>

              <Link
                className="button dark-button guide-open-link"
                to={`/pets/${selected.toLowerCase()}`}
              >
                Explore {selected} <Arrow />
              </Link>
            </div>
          </article>
        </section>

        <section className="support-section" id="services">
          <div className="page-width">
            <div className="section-heading">
              <div>
                <p className="eyebrow">
                  A LITTLE SUPPORT GOES A LONG WAY
                </p>

                <h2>Care beyond the everyday.</h2>
              </div>

              <p>
                Building easier ways to find
                <br />
                the right help for your companion.
              </p>
            </div>

            <div className="service-grid">
              <article className="service-card">
                <span className="service-number">
                  01 / CONNECT
                </span>

                <h3>Find a vet.</h3>

                <p>
                  Discover participating professionals by location
                  and the animals they care for.
                </p>

                <Link className="text-link" to="/vets">
                 Browse vet directory <Arrow />
                </Link>
              </article>

              <article className="service-card">
                <span className="service-number">
                  02 / REACH OUT
                </span>

                <h3>Transport support.</h3>

                <p>
                  Explore animal transport contacts and service
                  coverage in your area.
                </p>

                <span className="service-status">
                  Service in development
                </span>
              </article>

              <article className="service-card">
                <span className="service-number">
                  03 / DISCOVER
                </span>

                <h3>A little guidance.</h3>

                <p>
                  Find your way to relevant care articles
                  with a guided pet-care assistant.
                </p>

                <span className="service-status">
                  Assistant coming soon
                </span>
              </article>
            </div>

            <p className="service-disclosure">
              Bookings and transport requests are not yet available
              on this website.
            </p>
          </div>
        </section>

        <section className="about page-width" id="about">
          <p className="eyebrow">
            THE HEART OF PURR-PAWSITIVE
          </p>

          <h2>
            Because being their person
            <br />
            is a pretty special thing.
          </h2>

          <p className="about-copy">
            We’re creating a thoughtful space to learn, explore, and
            find support—so understanding your companion feels a
            little less overwhelming, and a lot more rewarding.
          </p>

          <a className="text-link" href="#companions">
            Start exploring <Arrow />
          </a>
        </section>
      </main>

      <footer className="footer">
        <div className="page-width footer-inner">
          <a className="footer-brand" href="#home">
            Purr-Pawsitive Paradise
          </a>

          <p>For the love of little companions.</p>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </footer>
    </>
  )
}

export default Home