import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import './AdminArticles.css'

type Article = {
  id: string
  slug: string
  title: string
  summary: string
  species: string
  topic: string
  status: string
  requiresClinicalReview: boolean
  updatedAt: string
}

const topics = [
  ['BREEDS_AND_SPECIES', 'Breeds and species'],
  ['DAILY_CARE', 'Daily care'],
  ['NUTRITION', 'Nutrition'],
  ['GROOMING', 'Grooming'],
  ['HABITAT', 'Habitat'],
  ['ENRICHMENT', 'Enrichment'],
  ['PREVENTIVE_CARE', 'Preventive care'],
  ['HEALTH', 'Health'],
  ['RAPID_RELIEF', 'Rapid relief'],
]

function AdminArticles() {
  const navigate = useNavigate()

  const [articles, setArticles] = useState<Article[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [denied, setDenied] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function loadArticles() {
      setLoading(true)
      setLoadError('')

      try {
        const response = await fetch(`/api/admin/articles?page=${page}`, {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        })

        if (response.status === 401) {
          setAllowed(false)
          navigate('/login', { replace: true })
          return
        }

        if (response.status === 403) {
          setAllowed(false)
          setDenied(true)
          return
        }

        if (!response.ok) {
          throw new Error('Could not load the article dashboard.')
        }

        const data = await response.json()

        if (!Array.isArray(data.articles)) {
          throw new Error('The server returned an unexpected response.')
        }

        if (!controller.signal.aborted) {
          setArticles(data.articles)
          setTotal(data.total)
          setTotalPages(data.totalPages)
          setAllowed(true)
          setDenied(false)
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Could not load articles.',
          )
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadArticles()

    return () => controller.abort()
  }, [navigate, page, retry])

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (saving) return

    const form = event.currentTarget
    const fields = new FormData(form)

    const sourceUrls = String(fields.get('sources') ?? '')
      .split(/\r?\n/)
      .map((source) => source.trim())
      .filter(Boolean)

    if (sourceUrls.length > 20) {
      setFormError('Please provide no more than 20 source links.')
      return
    }

    setSaving(true)
    setFormError('')
    setSuccess('')

    try {
      const response = await fetch('/api/admin/articles', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: String(fields.get('title') ?? '').trim(),
          slug: String(fields.get('slug') ?? '').trim().toLowerCase(),
          summary: String(fields.get('summary') ?? '').trim(),
          body: String(fields.get('body') ?? '').trim(),
          species: String(fields.get('species') ?? ''),
          topic: String(fields.get('topic') ?? ''),
          sourceUrls,
        }),
      })

      if (response.status === 401) {
        navigate('/login', { replace: true })
        return
      }

      if (response.status === 403) {
        setAllowed(false)
        setDenied(true)
        return
      }

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setFormError(
          typeof data?.message === 'string'
            ? data.message
            : 'Could not create the draft.',
        )
        return
      }

      if (!data?.article?.id) {
        setFormError(
          'Could not confirm the result. Reload the dashboard before trying again.',
        )
        return
      }

      form.reset()
      setShowForm(false)
      setSuccess(`“${data.article.title}” was saved as a draft.`)
      setPage(1)
      setRetry((value) => value + 1)
    } catch {
      setFormError(
        'Could not confirm whether the draft was saved. Reload the dashboard before retrying.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (denied) {
    return (
      <main className="page-width admin-access-message">
        <p className="eyebrow">RESTRICTED AREA</p>
        <h1>Administrator access required.</h1>
        <p>Please use an administrator account to manage articles.</p>
        <Link className="button dark-button" to="/account">
          Back to account
        </Link>
      </main>
    )
  }

  return (
    <>
      <header className="header">
        <Link className="brand" to="/">
          <span className="brand-mark" aria-hidden="true">pp.</span>
          <span>
            Purr-Pawsitive
            <small>PARADISE</small>
          </span>
        </Link>

        <nav aria-label="Admin navigation">
          <Link to="/account">My account</Link>
          <Link to="/">View website</Link>
        </nav>
      </header>

      <main className="page-width admin-main">
        <div className="admin-heading">
          <div>
            <p className="eyebrow">THE EDITORIAL DESK</p>
            <h1>Stories worth sharing.</h1>
            <p>Manage your article collection, one thoughtful draft at a time.</p>
          </div>

          {allowed && !showForm && (
            <button
              className="button dark-button admin-button"
              type="button"
              disabled={loading}
              onClick={() => {
                setFormError('')
                setSuccess('')
                setShowForm(true)
              }}
            >
              Create draft
            </button>
          )}
        </div>

        {success && (
          <p className="admin-success" role="status">{success}</p>
        )}

        {allowed && showForm && (
          <form
            className="admin-form"
            onSubmit={handleCreate}
            aria-busy={saving}
          >
            <h2>A new beginning.</h2>
            <p className="admin-form-note">
              Saving creates a private draft. Review and publication happen
              separately.
            </p>

            <div className="admin-form-grid">
              <div className="admin-field">
                <label htmlFor="article-title">Title</label>
                <input
                  id="article-title"
                  name="title"
                  minLength={3}
                  maxLength={180}
                  required
                  disabled={saving}
                />
              </div>

              <div className="admin-field">
                <label htmlFor="article-slug">URL slug</label>
                <input
                  id="article-slug"
                  name="slug"
                  placeholder="understanding-your-cat"
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  minLength={3}
                  maxLength={180}
                  aria-describedby="slug-help"
                  required
                  disabled={saving}
                />
                <small id="slug-help">
                  Lowercase letters, numbers, and hyphens between words.
                </small>
              </div>

              <div className="admin-field">
                <label htmlFor="article-species">Pet group</label>
                <select
                  id="article-species"
                  name="species"
                  defaultValue=""
                  required
                  disabled={saving}
                >
                  <option value="" disabled>Choose a pet group</option>
                  <option value="CAT">Cats</option>
                  <option value="DOG">Dogs</option>
                  <option value="TURTLE">Turtles</option>
                </select>
              </div>

              <div className="admin-field">
                <label htmlFor="article-topic">Topic</label>
                <select
                  id="article-topic"
                  name="topic"
                  defaultValue=""
                  required
                  disabled={saving}
                >
                  <option value="" disabled>Choose a topic</option>
                  {topics.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="admin-field">
              <label htmlFor="article-summary">Short summary</label>
              <textarea
                id="article-summary"
                name="summary"
                rows={3}
                minLength={10}
                maxLength={500}
                required
                disabled={saving}
              />
            </div>

            <div className="admin-field">
              <label htmlFor="article-body">Article body</label>
              <textarea
                id="article-body"
                name="body"
                rows={12}
                minLength={20}
                maxLength={20000}
                aria-describedby="body-help"
                required
                disabled={saving}
              />
              <small id="body-help">
                Plain text. Separate paragraphs with an empty line.
              </small>
            </div>

            <div className="admin-field">
              <label htmlFor="article-sources">Source links</label>
              <textarea
                id="article-sources"
                name="sources"
                rows={4}
                maxLength={40040}
                placeholder="One complete https:// link per line"
                aria-describedby="sources-help"
                disabled={saving}
              />
              <small id="sources-help">
                Up to 20 links. Sources may be added later while drafting.
              </small>
            </div>

            {formError && (
              <p className="admin-error" role="alert">{formError}</p>
            )}

            <div className="admin-form-actions">
              <button
                className="button dark-button admin-button"
                type="submit"
                disabled={saving}
              >
                {saving ? 'Saving draft…' : 'Save draft'}
              </button>

              <button
                className="admin-cancel"
                type="button"
                disabled={saving}
                onClick={() => {
                  setShowForm(false)
                  setFormError('')
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="admin-notice" role="status">Loading articles…</p>
        ) : loadError ? (
          <div className="admin-notice">
            <p role="alert">{loadError}</p>
            <button
              className="button dark-button admin-button"
              onClick={() => setRetry((value) => value + 1)}
            >
              Try again
            </button>
          </div>
        ) : allowed ? (
          <section aria-labelledby="article-list-title">
            <div className="admin-list-heading">
              <h2 id="article-list-title">Your collection</h2>
              <span>{total} article{total === 1 ? '' : 's'}</span>
            </div>

            {articles.length === 0 ? (
              <p className="admin-notice">
                No articles on this page. Create a draft to get started.
              </p>
            ) : (
              <div className="admin-article-list">
                {articles.map((article) => (
                  <article className="admin-article-row" key={article.id}>
                    <div>
                      <p className="eyebrow">
                        {article.species} / {article.topic.replaceAll('_', ' ')}
                      </p>
                      <h3>{article.title}</h3>
                      <p>{article.summary}</p>
                      <small>
                        Updated {new Date(article.updatedAt).toLocaleDateString()}
                      </small>
                      <div>
               b          <Link
                            className="text-link"
                                to={`/admin/articles/${article.id}`}
                            >
                       {article.status === 'DRAFT' ? 'Edit draft' : 'View article'}
                             </Link>
                        </div>
                    </div>

                    <span className={`admin-status status-${article.status.toLowerCase()}`}>
                      {article.status.replaceAll('_', ' ')}
                    </span>
                  </article>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <nav className="admin-pagination" aria-label="Admin article pages">
                <button
                  type="button"
                  disabled={page === 1 || saving}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </button>
                <span>Page {page} of {totalPages}</span>
                <button
                  type="button"
                  disabled={page >= totalPages || saving}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </button>
              </nav>
            )}
          </section>
        ) : null}
      </main>
    </>
  )
}

export default AdminArticles