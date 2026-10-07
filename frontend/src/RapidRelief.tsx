import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import './AdminVetEditor.css'

type ArticleSummary = {
  id: string
  slug: string
  title: string
  summary: string
  species: string
  topic: string
  reviewerName: string | null
  reviewedAt: string | null
}

type Article = ArticleSummary & {
  body: string
  sourceUrls: string[]
  reviewerCredentials: string | null
  reviewDueAt: string | null
}

type Collection = {
  articles: ArticleSummary[]
  total: number
  totalPages: number
}

function displayDate(value: string | null) {
  if (!value) return 'Not recorded'

  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Not recorded'

  return date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
  })
}

function safeSource(value: string) {
  try {
    const url = new URL(value)

    return (
      ['https:', 'http:'].includes(url.protocol) &&
      !url.username &&
      !url.password
    ) ? url.href : null
  } catch {
    return null
  }
}

function ContactLinks() {
  return (
    <aside
      aria-label="Professional help"
      className="vet-editor-notice"
      style={{ margin: '1rem 0' }}
    >
      <p>
        Need urgent help? Contact a veterinarian directly.
        Reading a guide or submitting a transport request does not
        arrange professional assistance.
      </p>
      <div className="vet-editor-actions">
        <Link className="button dark-button" to="/vets">
          Find a vet
        </Link>
        <Link className="button dark-button" to="/ambulances">
          Transport contacts
        </Link>
      </div>
    </aside>
  )
}

function RapidRelief() {
  const { slug } = useParams()

  return (
    <main className="page-width vet-editor-main">
      <nav className="vet-editor-actions" aria-label="Rapid Relief navigation">
        <Link className="text-link" to="/">Home</Link>
        {slug && (
          <Link className="text-link" to="/rapid-relief">
            All Rapid Relief guides
          </Link>
        )}
      </nav>

      <ContactLinks />

      {slug ? (
        <ReliefArticle key={slug} slug={slug} />
      ) : (
        <ReliefCollection />
      )}
    </main>
  )
}

function ReliefCollection() {
  const [params, setParams] = useSearchParams()
  const requestedSpecies = params.get('species') ?? ''
  const species = ['CAT', 'DOG', 'TURTLE'].includes(requestedSpecies)
    ? requestedSpecies
    : ''

  const pageText = params.get('page') ?? '1'
  const page = /^[1-9]\d{0,4}$/.test(pageText) ? Number(pageText) : 1

  const [data, setData] = useState<Collection | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setData(null)
      setError('')

      try {
        const query = new URLSearchParams({
          topic: 'RAPID_RELIEF',
          page: String(page),
        })

        if (species) query.set('species', species)

        const response = await fetch(`/api/articles?${query}`, {
          cache: 'no-store',
          signal: controller.signal,
        })

        const result = await response.json().catch(() => null)

        if (controller.signal.aborted) return

        if (!response.ok) {
          throw new Error(result?.message ?? 'Could not load guides.')
        }

        if (
          !Array.isArray(result?.articles) ||
          !Number.isInteger(result.total) ||
          result.total < 0 ||
          !Number.isInteger(result.totalPages) ||
          result.totalPages < 0 ||
          result.articles.some(
            (item: ArticleSummary) => item.topic !== 'RAPID_RELIEF',
          )
        ) {
          throw new Error('Unexpected guide response.')
        }

        setData(result)
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(
            error instanceof Error ? error.message : 'Could not load guides.',
          )
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [species, page, refresh])

  function changePage(nextPage: number, nextSpecies = species) {
    const next = new URLSearchParams()
    if (nextSpecies) next.set('species', nextSpecies)
    if (nextPage > 1) next.set('page', String(nextPage))
    setParams(next)
  }

  return (
    <>
      <div className="vet-editor-heading">
        <p className="eyebrow">RAPID RELIEF</p>
        <h1>Guidance while seeking professional help</h1>
        <p>
          Browse published guides by pet group. Each guide shows
          its recorded reviewer, review date, and supporting sources.
        </p>
      </div>

      <div className="vet-editor-field">
        <label htmlFor="relief-species">Pet group</label>
        <select
          id="relief-species"
          value={species}
          onChange={(event) => changePage(1, event.target.value)}
        >
          <option value="">All pet groups</option>
          <option value="CAT">Cats</option>
          <option value="DOG">Dogs</option>
          <option value="TURTLE">Turtles</option>
        </select>
      </div>

      <button
        className="button dark-button"
        type="button"
        disabled={loading}
        onClick={() => setRefresh((value) => value + 1)}
      >
        Refresh guides
      </button>

      {loading && <p role="status">Loading guides…</p>}
      {error && <p className="vet-editor-error" role="alert">{error}</p>}

      {!loading && data && (
        <>
          {data.articles.length === 0 ? (
            <p>
              No published Rapid Relief guides are available for
              this selection on this page. Use the contact links
              above to find professional help.
            </p>
          ) : (
            data.articles.map((article) => (
              <section
                key={article.id}
                style={{
                  marginTop: '1.5rem',
                  paddingBottom: '1rem',
                  borderBottom: '1px solid #ddd',
                }}
              >
                <p className="eyebrow">{article.species}</p>
                <h2>
                  <Link to={`/rapid-relief/${article.slug}`}>
                    {article.title}
                  </Link>
                </h2>
                <p>{article.summary}</p>
                <p>
                  Review recorded: {displayDate(article.reviewedAt)}
                  {' · '}{article.reviewerName}
                </p>
              </section>
            ))
          )}

          {(page > 1 || data.totalPages > 1) && (
            <nav
              className="vet-editor-actions"
              aria-label="Rapid Relief pages"
              style={{ marginTop: '1rem' }}
            >
              <button
                className="button dark-button"
                type="button"
                disabled={page <= 1}
                onClick={() => changePage(page - 1)}
              >
                Previous
              </button>
              <span>
                Page {page} · {data.total} published guide(s)
              </span>
              <button
                className="button dark-button"
                type="button"
                disabled={page >= data.totalPages}
                onClick={() => changePage(page + 1)}
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </>
  )
}

function ReliefArticle({ slug }: { slug: string }) {
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setArticle(null)
      setError('')

      try {
        const response = await fetch(
          `/api/articles/${encodeURIComponent(slug)}`,
          { cache: 'no-store', signal: controller.signal },
        )
        const result = await response.json().catch(() => null)

        if (controller.signal.aborted) return

        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? 'This guide is unavailable. It may be unpublished, archived, or due for review.'
              : 'Could not load the guide.',
          )
        }

        if (
          result?.article?.topic !== 'RAPID_RELIEF' ||
          result.article.slug !== slug ||
          typeof result.article.body !== 'string' ||
          !Array.isArray(result.article.sourceUrls)
        ) {
          throw new Error('This address does not contain a Rapid Relief guide.')
        }

        setArticle(result.article)
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(
            error instanceof Error ? error.message : 'Could not load guide.',
          )
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [slug, refresh])

  return (
    <>
      {loading && <p role="status">Loading guide…</p>}
      {error && <p className="vet-editor-error" role="alert">{error}</p>}

      <button
        className="button dark-button"
        type="button"
        disabled={loading}
        onClick={() => setRefresh((value) => value + 1)}
      >
        Refresh guide
      </button>

      {article && (
        <article style={{ overflowWrap: 'anywhere' }}>
          <p className="eyebrow">{article.species} · RAPID RELIEF</p>
          <h1>{article.title}</h1>
          <p>{article.summary}</p>

          <p>
            <strong>Recorded reviewer:</strong>{' '}
            {article.reviewerName} — {article.reviewerCredentials}
          </p>
          <p>
            <strong>Reviewed:</strong> {displayDate(article.reviewedAt)}
            {' · '}
            <strong>Review due:</strong> {displayDate(article.reviewDueAt)}
          </p>

          <div style={{ lineHeight: 1.7 }}>
            {article.body.split(/\r?\n\s*\r?\n/).map((paragraph, index) => (
              <p key={index} style={{ whiteSpace: 'pre-wrap' }}>
                {paragraph}
              </p>
            ))}
          </div>

          <p>
            <Link
              className="text-link"
              to={`/reports/new?type=ARTICLE&id=${encodeURIComponent(article.id)}`}
            >
              Report an issue with this guide
            </Link>
          </p>

          <h2>Sources</h2>
          <ul>
            {article.sourceUrls.map((source, index) => {
              const href = safeSource(source)
              return (
                <li key={`${source}-${index}`}>
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      {source}
                    </a>
                  ) : (
                    <span>Source link unavailable</span>
                  )}
                </li>
              )
            })}
          </ul>

          <ContactLinks />
        </article>
      )}
    </>
  )
}

export default RapidRelief