import { useEffect, useState } from 'react'

import { Link, useNavigate, useParams } from 'react-router'

import './AdminArticles.css'

type Article = {

  id: string

  title: string

  slug: string

  summary: string

  body: string

  species: string

  topic: string

  status: string

  sourceUrls: string[]

  imageUrl: string | null

  imageAlt: string | null

  imageRights: string | null

  relatedBreedRecordIds: string[]

  updatedAt: string

}

type BreedRecord = {
  id: string
  slug: string
  petGroup: 'CAT' | 'DOG' | 'TURTLE'
  name: string
}

type DraftForm = {

  title: string

  summary: string

  body: string

  species: string

  topic: string

  sources: string

  imageUrl: string

  imageAlt: string

  imageRights: string

  relatedBreedRecordIds: string[]

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

function formFromArticle(article: Article): DraftForm {

  return {

    title: article.title,

    summary: article.summary,

    body: article.body,

    species: article.species,

    topic: article.topic,

    sources: article.sourceUrls.join('\n'),

    imageUrl: article.imageUrl ?? '',

    imageAlt: article.imageAlt ?? '',

    imageRights: article.imageRights ?? '',

    relatedBreedRecordIds: [...article.relatedBreedRecordIds],

  }

}

function normalizeArticle(
  value: Article,
  fallbackRelatedBreedRecordIds: string[] = [],
): Article {
  return {
    ...value,
    imageUrl:
      typeof value.imageUrl === 'string'
        ? value.imageUrl
        : null,
    imageAlt:
      typeof value.imageAlt === 'string'
        ? value.imageAlt
        : null,
    imageRights:
      typeof value.imageRights === 'string'
        ? value.imageRights
        : null,
    relatedBreedRecordIds: Array.isArray(value.relatedBreedRecordIds)
      ? value.relatedBreedRecordIds
      : fallbackRelatedBreedRecordIds,
  }
}

function AdminArticleEditor() {

  const { id } = useParams()

  const navigate = useNavigate()

  const [article, setArticle] = useState<Article | null>(null)

  const [form, setForm] = useState<DraftForm | null>(null)

  const [loading, setLoading] = useState(true)

  const [loadError, setLoadError] = useState('')

  const [error, setError] = useState('')

  const [success, setSuccess] = useState('')

  const [busy, setBusy] = useState<

    'save' | 'review' | 'transition' | 'publish' | null

  >(null)

  const [retry, setRetry] = useState(0)

  const [needsReload, setNeedsReload] = useState(false)

  const [breedRecords, setBreedRecords] = useState<BreedRecord[]>([])

  const [breedRecordsLoading, setBreedRecordsLoading] = useState(false)

  useEffect(() => {

    const controller = new AbortController()

    async function loadArticle() {

      setLoading(true)

      setLoadError('')

      try {

        if (!id) throw new Error('Article ID is missing.')

        const response = await fetch(

          `/api/admin/articles/${encodeURIComponent(id)}`,

          {

            credentials: 'same-origin',

            cache: 'no-store',

            signal: controller.signal,

          },

        )

        if (response.status === 401) {

          navigate('/login', { replace: true })

          return

        }

        const data = await response.json().catch(() => null)

        if (!response.ok || !data?.article?.id) {

          throw new Error(

            data?.message ?? 'Could not load this article.',

          )

        }

        if (!controller.signal.aborted) {

          const loadedArticle = normalizeArticle(data.article)

          setArticle(loadedArticle)

          setForm(formFromArticle(loadedArticle))

          setNeedsReload(false)

          setError('')

          setSuccess('')

        }

      } catch (error) {

        if (!controller.signal.aborted) {

          setLoadError(

            error instanceof Error

              ? error.message

              : 'Could not load this article.',

          )

        }

      } finally {

        if (!controller.signal.aborted) {

          setLoading(false)

        }

      }

    }

    void loadArticle()

    return () => controller.abort()

  }, [id, navigate, retry])

  useEffect(() => {
    if (!form?.species) {
      setBreedRecords([])
      return
    }

    const controller = new AbortController()

    async function loadBreedRecords() {
      setBreedRecordsLoading(true)

      try {
        const response = await fetch(
          `/api/breeds?species=${encodeURIComponent(form!.species)}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          },
        )

        const data = await response.json().catch(() => null)

        if (
          !response.ok ||
          !Array.isArray(data?.records)
        ) {
          throw new Error('Could not load breed/species records.')
        }

        if (!controller.signal.aborted) {
          setBreedRecords(data.records)
        }
      } catch {
        if (!controller.signal.aborted) {
          setBreedRecords([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setBreedRecordsLoading(false)
        }
      }
    }

    void loadBreedRecords()

    return () => controller.abort()
  }, [form?.species])

  const dirty =

    article !== null &&

    form !== null &&

    JSON.stringify(form) !== JSON.stringify(formFromArticle(article))

  const editable = article?.status === 'DRAFT'

  const locked = busy !== null || !editable || needsReload

  useEffect(() => {

    if (!dirty) return

    function warnBeforeLeaving(event: BeforeUnloadEvent) {

      event.preventDefault()

      event.returnValue = ''

    }

    window.addEventListener('beforeunload', warnBeforeLeaving)

    return () => {

      window.removeEventListener('beforeunload', warnBeforeLeaving)

    }

  }, [dirty])

  function updateField(
    field:
      | 'title'
      | 'summary'
      | 'body'
      | 'topic'
      | 'sources'
      | 'imageUrl'
      | 'imageAlt'
      | 'imageRights',
    value: string,
  ) {
    setForm((current) =>
      current ? { ...current, [field]: value } : current,
    )

    setSuccess('')
  }

  function updateSpecies(value: string) {
    setForm((current) =>
      current
        ? {
            ...current,
            species: value,
            relatedBreedRecordIds: [],
          }
        : current,
    )

    setSuccess('')
  }

  function toggleBreedRecord(recordId: string) {
    setForm((current) => {
      if (!current) return current

      const selected = current.relatedBreedRecordIds.includes(recordId)

      return {
        ...current,
        relatedBreedRecordIds: selected
          ? current.relatedBreedRecordIds.filter((id) => id !== recordId)
          : [...current.relatedBreedRecordIds, recordId],
      }
    })

    setSuccess('')
  }

  async function saveDraft() {

    if (!article || !form || locked) return

    const sourceUrls = form.sources

      .split(/\r?\n/)

      .map((source) => source.trim())

      .filter(Boolean)

    if (sourceUrls.length > 20) {

      setError('Please provide no more than 20 source links.')

      return

    }

    const imageUrl = form.imageUrl.trim()
    const imageAlt = form.imageAlt.trim()
    const imageRights = form.imageRights.trim()

    const hasAnyImageMetadata =
      imageUrl.length > 0 ||
      imageAlt.length > 0 ||
      imageRights.length > 0

    if (
      hasAnyImageMetadata &&
      (!imageUrl || !imageAlt || !imageRights)
    ) {
      setError(
        'When an article image is used, image URL, alt text, and image rights/permission information are all required.',
      )
      return
    }

    setBusy('save')

    setError('')

    setSuccess('')

    try {

      const response = await fetch(

        `/api/admin/articles/${article.id}`,

        {

          method: 'PUT',

          credentials: 'same-origin',

          headers: {

            'Content-Type': 'application/json',

          },

          body: JSON.stringify({

            title: form.title,

            summary: form.summary,

            body: form.body,

            species: form.species,

            topic: form.topic,

            sourceUrls,

            imageUrl: form.imageUrl,

            imageAlt: form.imageAlt,

            imageRights: form.imageRights,

            relatedBreedRecordIds: form.relatedBreedRecordIds,

            updatedAt: article.updatedAt,

          }),

        },

      )

      if (response.status === 401) {

        navigate('/login', { replace: true })

        return

      }

      const data = await response.json().catch(() => null)

      if (!response.ok) {

        if (response.status === 409) {

          setNeedsReload(true)

        }

        setError(data?.message ?? 'Could not save the draft.')

        return

      }

      if (!data?.article?.id) {

        setNeedsReload(true)

        setError('Could not confirm the result. Reload the article.')

        return

      }

      const nextArticle = normalizeArticle(
        data.article,
        article.relatedBreedRecordIds,
      )

      setArticle(nextArticle)

      setForm(formFromArticle(nextArticle))

      setSuccess('Your draft changes have been saved.')

    } catch {

      setNeedsReload(true)

      setError(

        'Could not confirm whether the changes were saved. Copy any edits you want to keep, then reload.',

      )

    } finally {

      setBusy(null)

    }

  }

  async function submitForReview() {

    if (!article || locked || dirty) return

    if (

      !window.confirm(

        'Submit this saved draft for review? Editing will be locked while it is in review.',

      )

    ) {

      return

    }

    setBusy('review')

    setError('')

    setSuccess('')

    try {

      const response = await fetch(

        `/api/admin/articles/${article.id}/submit-review`,

        {

          method: 'POST',

          credentials: 'same-origin',

          headers: {

            'Content-Type': 'application/json',

          },

          body: JSON.stringify({

            updatedAt: article.updatedAt,

          }),

        },

      )

      if (response.status === 401) {

        navigate('/login', { replace: true })

        return

      }

      const data = await response.json().catch(() => null)

      if (!response.ok) {

        if (response.status === 409) {

          setNeedsReload(true)

        }

        setError(data?.message ?? 'Could not submit the article.')

        return

      }

      if (!data?.article?.id) {

        setNeedsReload(true)

        setError('Could not confirm submission. Reload the article.')

        return

      }

      const nextArticle = normalizeArticle(
        data.article,
        article.relatedBreedRecordIds,
      )

      setArticle(nextArticle)

      setForm(formFromArticle(nextArticle))

      setSuccess('Submitted for review. This article is not public yet.')

    } catch {

      setNeedsReload(true)

      setError('Could not confirm submission. Reload to check its status.')

    } finally {

      setBusy(null)

    }

  }

  async function changeStatus(

    action: 'RETURN_TO_DRAFT' | 'ARCHIVE',

  ) {

    if (!article || busy || dirty || needsReload) return

    const explanation =

      action === 'RETURN_TO_DRAFT'

        ? 'Return this article to draft? It will be removed from public view, and its previous review details will be cleared.'

        : 'Archive this article? It will be removed from public view. Its record will be kept.'

    const reason = window.prompt(

      `${explanation}\n\nEnter a reason (5–500 characters):`,

    )

    if (reason === null) return

    if (reason.trim().length < 5 || reason.trim().length > 500) {

      setError('Please provide a reason containing 5–500 characters.')

      return

    }

    setBusy('transition')

    setError('')

    setSuccess('')

    try {

      const response = await fetch(

        `/api/admin/articles/${article.id}/transition`,

        {

          method: 'POST',

          credentials: 'same-origin',

          headers: {

            'Content-Type': 'application/json',

          },

          body: JSON.stringify({

            action,

            reason: reason.trim(),

            updatedAt: article.updatedAt,

          }),

        },

      )

      if (response.status === 401) {

        navigate('/login', { replace: true })

        return

      }

      const data = await response.json().catch(() => null)

      if (!response.ok) {

        if (response.status === 409) {

          setNeedsReload(true)

        }

        setError(

          data?.message ?? 'Could not change the article status.',

        )

        return

      }

      if (!data?.article?.id) {

        setNeedsReload(true)

        setError('Could not confirm the result. Reload the article.')

        return

      }

      const nextArticle = normalizeArticle(
        data.article,
        article.relatedBreedRecordIds,
      )

      setArticle(nextArticle)

      setForm(formFromArticle(nextArticle))

      setSuccess(data.message)

    } catch {

      setNeedsReload(true)

      setError('Could not confirm the change. Reload to check its status.')

    } finally {

      setBusy(null)

    }

  }

  async function publishArticle(formElement: HTMLFormElement) {

    if (

      !article ||

      article.status !== 'IN_REVIEW' ||

      busy ||

      dirty ||

      needsReload

    ) {

      return

    }

    const fields = new FormData(formElement)

    if (

      !window.confirm(

        'Publish this reviewed article? It will become publicly available.',

      )

    ) {

      return

    }

    setBusy('publish')

    setError('')

    setSuccess('')

    try {

      const response = await fetch(

        `/api/admin/articles/${article.id}/publish`,

        {

          method: 'POST',

          credentials: 'same-origin',

          headers: {

            'Content-Type': 'application/json',

          },

          body: JSON.stringify({

            updatedAt: article.updatedAt,

            reviewerName: String(

              fields.get('reviewerName') ?? '',

            ).trim(),

            reviewerCredentials: String(

              fields.get('reviewerCredentials') ?? '',

            ).trim(),

            reviewedAt: String(fields.get('reviewedAt') ?? ''),

            reviewConfirmed: fields.get('reviewConfirmed') === 'on',

          }),

        },

      )

      if (response.status === 401) {

        navigate('/login', { replace: true })

        return

      }

      const data = await response.json().catch(() => null)

      if (!response.ok) {

        if (response.status === 409) {

          setNeedsReload(true)

        }

        setError(

          typeof data?.message === 'string'

            ? data.message

            : 'Could not publish the article.',

        )

        return

      }

      if (!data?.article?.id) {

        setNeedsReload(true)

        setError('Could not confirm publication. Reload the article.')

        return

      }

      const nextArticle = normalizeArticle(
        data.article,
        article.relatedBreedRecordIds,
      )

      setArticle(nextArticle)

      setForm(formFromArticle(nextArticle))

      setSuccess('Review recorded. The article is now published.')

    } catch {

      setNeedsReload(true)

      setError(

        'Could not confirm publication. Reload to check the article’s status.',

      )

    } finally {

      setBusy(null)

    }

  }

  function reloadArticle() {

    if (

      dirty &&

      !window.confirm(

        'Reloading discards unsaved changes. Copy anything you want to keep first. Continue?',

      )

    ) {

      return

    }

    setRetry((value) => value + 1)

  }

  if (loading) {

    return (

      <main className="page-width admin-main" role="status">

        Loading article…

      </main>

    )

  }

  if (loadError || !article || !form) {

    return (

      <main className="page-width admin-main">

        <p className="admin-error" role="alert">

          {loadError || 'Article unavailable.'}

        </p>

        <div className="admin-form-actions">

          <button

            className="button dark-button admin-button"

            type="button"

            onClick={reloadArticle}

          >

            Try again

          </button>

          <Link to="/admin/articles">Back to articles</Link>

        </div>

      </main>

    )

  }

  return (

    <main className="page-width admin-main">

      <Link

        className="text-link"

        to="/admin/articles"

        onClick={(event) => {

          if (

            busy ||

            (dirty &&

              !window.confirm('Leave without saving your changes?'))

          ) {

            event.preventDefault()

          }

        }}

      >

        Back to articles

      </Link>

      <div className="admin-heading">

        <div>

          <p className="eyebrow">THE EDITORIAL DESK</p>

          <h1>{editable ? 'Shape your story.' : 'Article details.'}</h1>

          <p>Article slug: {article.slug}</p>

        </div>

        <span

          className={`admin-status status-${article.status.toLowerCase()}`}

        >

          {article.status.replaceAll('_', ' ')}

        </span>

      </div>

      {success && (

        <p className="admin-success" role="status">

          {success}

        </p>

      )}

      {error && (

        <div className="admin-error">

          <p role="alert">{error}</p>

          {needsReload && (

            <button

              className="article-editor-reload"

              type="button"

              disabled={busy !== null}

              onClick={reloadArticle}

            >

              Reload latest version

            </button>

          )}

        </div>

      )}

      {!editable && (

        <p className="admin-notice">

          This article is read-only because its status is{' '}

          {article.status.replaceAll('_', ' ').toLowerCase()}.

        </p>

      )}

      <div className="admin-form-actions article-status-actions">

        {article.status !== 'DRAFT' && (

          <button

            className="button article-review-button"

            type="button"

            disabled={busy !== null || dirty || needsReload}

            onClick={() => changeStatus('RETURN_TO_DRAFT')}

          >

            Return to draft

          </button>

        )}

        {article.status !== 'ARCHIVED' && (

          <button

            className="button article-review-button"

            type="button"

            disabled={busy !== null || dirty || needsReload}

            onClick={() => changeStatus('ARCHIVE')}

          >

            Archive article

          </button>

        )}

        {busy === 'transition' && (

          <span role="status">Updating article status…</span>

        )}

      </div>

      <form

        className="admin-form"

        aria-busy={busy !== null}

        onSubmit={(event) => {

          event.preventDefault()

          void saveDraft()

        }}

      >

        <div className="admin-field">

          <label htmlFor="edit-title">Title</label>

          <input

            id="edit-title"

            value={form.title}

            onChange={(event) =>

              updateField('title', event.target.value)

            }

            minLength={3}

            maxLength={180}

            required

            disabled={locked}

          />

        </div>

        <div className="admin-form-grid">

          <div className="admin-field">

            <label htmlFor="edit-species">Pet group</label>

            <select

              id="edit-species"

              value={form.species}

              onChange={(event) =>

                updateSpecies(event.target.value)

              }

              disabled={locked}

            >

              <option value="CAT">Cats</option>

              <option value="DOG">Dogs</option>

              <option value="TURTLE">Turtles</option>

            </select>

          </div>

          <div className="admin-field">

            <label htmlFor="edit-topic">Topic</label>

            <select

              id="edit-topic"

              value={form.topic}

              onChange={(event) =>

                updateField('topic', event.target.value)

              }

              disabled={locked}

            >

              {topics.map(([value, label]) => (

                <option key={value} value={value}>

                  {label}

                </option>

              ))}

            </select>

          </div>

        </div>

        <fieldset
          className="admin-field"
          disabled={locked || breedRecordsLoading}
        >
          <legend>Related breed/species records</legend>

          {breedRecordsLoading ? (
            <p role="status">Loading breed/species records…</p>
          ) : breedRecords.length === 0 ? (
            <p className="admin-form-note">
              No breed/species records are available for this pet group yet.
            </p>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '0.75rem 1rem',
                marginTop: '0.75rem',
              }}
            >
              {breedRecords.map((record) => (
                <label
                  key={record.id}
                  style={{
                    display: 'flex',
                    gap: '0.6rem',
                    alignItems: 'flex-start',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.relatedBreedRecordIds.includes(record.id)}
                    onChange={() => toggleBreedRecord(record.id)}
                    disabled={locked}
                  />

                  <span>
                    <strong>{record.name}</strong>
                    <br />
                    <small>{record.slug}</small>
                  </span>
                </label>
              ))}
            </div>
          )}

          <small>
            Select the breed or species records that this article directly
            supports. These links power the public breed/species article
            filter.
          </small>
        </fieldset>

        <div className="admin-field">

          <label htmlFor="edit-summary">Summary</label>

          <textarea

            id="edit-summary"

            value={form.summary}

            onChange={(event) =>

              updateField('summary', event.target.value)

            }

            rows={3}

            minLength={10}

            maxLength={500}

            required

            disabled={locked}

          />

        </div>

        <div className="admin-field">

          <label htmlFor="edit-body">Article body</label>

          <textarea

            id="edit-body"

            value={form.body}

            onChange={(event) =>

              updateField('body', event.target.value)

            }

            rows={14}

            minLength={20}

            maxLength={20000}

            required

            disabled={locked}

          />

          <small>

            Plain text. Separate paragraphs with an empty line.

          </small>

        </div>

        <fieldset
          className="admin-field"
          style={{
            border: '1px solid #c6d0c0',
            padding: '1rem',
          }}
        >
          <legend>
            Optional article image
          </legend>

          <p className="admin-form-note">
            If you use an image, complete all three fields below.
            Use only an image you have permission to display.
          </p>

          <div className="admin-field">
            <label htmlFor="edit-image-url">
              Image URL
            </label>

            <input
              id="edit-image-url"
              type="url"
              value={form.imageUrl}
              onChange={(event) =>
                updateField('imageUrl', event.target.value)
              }
              maxLength={2048}
              placeholder="https://example.com/permitted-image.jpg"
              disabled={locked}
            />
          </div>

          <div className="admin-field">
            <label htmlFor="edit-image-alt">
              Image alt text
            </label>

            <textarea
              id="edit-image-alt"
              value={form.imageAlt}
              onChange={(event) =>
                updateField('imageAlt', event.target.value)
              }
              rows={2}
              maxLength={300}
              placeholder="Describe the meaningful content of the image."
              disabled={locked}
            />
          </div>

          <div className="admin-field">
            <label htmlFor="edit-image-rights">
              Image rights / permission note
            </label>

            <textarea
              id="edit-image-rights"
              value={form.imageRights}
              onChange={(event) =>
                updateField('imageRights', event.target.value)
              }
              rows={3}
              maxLength={1000}
              placeholder="Example: Original photo by project author; permission granted for project use."
              disabled={locked}
            />
          </div>

          {form.imageUrl &&
            form.imageAlt &&
            form.imageRights && (
              <figure
                style={{
                  margin: '1rem 0 0',
                }}
              >
                <img
                  src={form.imageUrl}
                  alt={form.imageAlt}
                  style={{
                    display: 'block',
                    width: '100%',
                    maxWidth: '560px',
                    maxHeight: '360px',
                    objectFit: 'cover',
                    borderRadius: '12px',
                  }}
                />

                <figcaption>
                  <small>
                    Rights note: {form.imageRights}
                  </small>
                </figcaption>
              </figure>
            )}
        </fieldset>

        <div className="admin-field">

          <label htmlFor="edit-sources">Source links</label>

          <textarea

            id="edit-sources"

            value={form.sources}

            onChange={(event) =>

              updateField('sources', event.target.value)

            }

            rows={4}

            maxLength={40040}

            disabled={locked}

          />

          <small>

            One complete HTTP or HTTPS link per line, up to 20 links.

          </small>

        </div>

        {editable && (

          <>

            <p className="admin-form-note" role="status">

              {dirty

                ? 'You have unsaved changes. Save before submitting for review.'

                : 'You are viewing the saved version.'}

            </p>

            <div className="admin-form-actions">

              <button

                className="button dark-button admin-button"

                type="submit"

                disabled={locked || !dirty}

              >

                {busy === 'save' ? 'Saving…' : 'Save changes'}

              </button>

              <button

                className="button article-review-button"

                type="button"

                disabled={locked || dirty}

                onClick={submitForReview}

              >

                {busy === 'review'

                  ? 'Submitting…'

                  : 'Submit for review'}

              </button>

            </div>

          </>

        )}

      </form>

      {article.status === 'IN_REVIEW' && (

        <section

          className="article-review-panel"

          aria-labelledby="review-panel-title"

        >

          <p className="eyebrow">BEFORE IT GOES LIVE</p>

          <h2 id="review-panel-title">

            Record the completed review.

          </h2>

          <p className="admin-form-note">

            Enter the actual reviewer’s details after they have approved

            this saved version and its sources. Submitting for review

            alone does not mean the article has been approved.

          </p>

          <div className="article-review-sources">

            <h3>Saved source links</h3>

            {article.sourceUrls.length === 0 ? (

              <p className="admin-error">

                This article has no sources. Return it to draft, add the

                supporting links, save, and submit it for review again.

              </p>

            ) : (

              <ul>

                {article.sourceUrls.map((source, index) => (

                  <li key={`${source}-${index}`}>

                    {/^https?:\/\//i.test(source) ? (

                      <a

                        href={source}

                        target="_blank"

                        rel="noopener noreferrer"

                      >

                        {source}

                      </a>

                    ) : (

                      <span>Invalid source link: {source}</span>

                    )}

                  </li>

                ))}

              </ul>

            )}

          </div>

          <form

            className="admin-form"

            aria-busy={busy === 'publish'}

            onSubmit={(event) => {

              event.preventDefault()

              void publishArticle(event.currentTarget)

            }}

          >

            <div className="admin-form-grid">

              <div className="admin-field">

                <label htmlFor="reviewer-name">

                  Reviewer’s full name

                </label>

                <input

                  id="reviewer-name"

                  name="reviewerName"

                  type="text"

                  minLength={2}

                  maxLength={150}

                  required

                  disabled={busy !== null || needsReload}

                />

              </div>

              <div className="admin-field">

                <label htmlFor="reviewer-credentials">

                  Qualifications / professional credentials

                </label>

                <input

                  id="reviewer-credentials"

                  name="reviewerCredentials"

                  type="text"

                  minLength={5}

                  maxLength={250}

                  required

                  disabled={busy !== null || needsReload}

                />

              </div>

            </div>

            <div className="admin-field">

              <label htmlFor="review-date">

                Date the review was completed

              </label>

              <input

                id="review-date"

                name="reviewedAt"

                type="date"

                required

                disabled={busy !== null || needsReload}

              />

              <small>

                Enter the actual date. Future dates and reviews older

                than the current review period are rejected.

              </small>

            </div>

            <label className="article-review-confirmation">

              <input

                name="reviewConfirmed"

                type="checkbox"

                required

                disabled={busy !== null || needsReload}

              />

              <span>

                I have verified the named reviewer’s qualifications and

                confirm they approved this exact saved article and its

                supporting sources.

              </span>

            </label>

            <p className="admin-form-note">

              Publishing makes the article public. Under the current

              policy, its review expires 180 days after the recorded

              review date.

            </p>

            <button

              className="button dark-button admin-button"

              type="submit"

              disabled={

                busy !== null ||

                dirty ||

                needsReload ||

                article.sourceUrls.length === 0

              }

            >

              {busy === 'publish'

                ? 'Publishing…'

                : 'Record review & publish'}

            </button>

          </form>

        </section>

      )}

    </main>

  )

}

export default AdminArticleEditor