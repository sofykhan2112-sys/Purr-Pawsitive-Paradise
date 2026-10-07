import {
  useEffect,
  useState,
} from 'react'

import type {
  FormEvent,
} from 'react'

import {
  Link,
} from 'react-router'

import './ArticleCollection.css'

type Species =
  | 'CAT'
  | 'DOG'
  | 'TURTLE'

type ArticleTopic =
  | ''
  | 'BREEDS_AND_SPECIES'
  | 'DAILY_CARE'
  | 'NUTRITION'
  | 'GROOMING'
  | 'HABITAT'
  | 'ENRICHMENT'
  | 'PREVENTIVE_CARE'
  | 'HEALTH'
  | 'RAPID_RELIEF'

type RealArticleTopic =
  Exclude<
    ArticleTopic,
    ''
  >

type ArticleSummary = {
  id: string
  slug: string
  title: string
  summary: string

  imageUrl:
    | string
    | null

  imageAlt:
    | string
    | null

  imageRights:
    | string
    | null

  species: Species

  topic:
    RealArticleTopic
}

type RelatedArticle = {
  id: string
  slug: string
  title: string
  summary: string
  species: Species

  topic:
    RealArticleTopic
}

type ArticleDetail =
  ArticleSummary & {
    body: string

    sourceUrls:
      string[]

    reviewerName:
      | string
      | null

    reviewerCredentials:
      | string
      | null

    reviewedAt:
      | string
      | null

    reviewDueAt:
      | string
      | null

    relatedArticles:
      RelatedArticle[]
  }

type BreedRecord = {
  id: string
  slug: string
  petGroup: Species
  name: string
}

const topicLabels:
  Record<
    RealArticleTopic,
    string
  > = {
    BREEDS_AND_SPECIES:
      'Breeds & species',

    DAILY_CARE:
      'Everyday care',

    NUTRITION:
      'Food & nutrition',

    GROOMING:
      'Grooming',

    HABITAT:
      'Habitat',

    ENRICHMENT:
      'Enrichment',

    PREVENTIVE_CARE:
      'Preventive care',

    HEALTH:
      'Health awareness',

    RAPID_RELIEF:
      'Rapid Relief',
  }

const speciesLabels:
  Record<
    Species,
    string
  > = {
    CAT: 'Cats',
    DOG: 'Dogs',
    TURTLE: 'Turtles',
  }

function ArticleCollection({
  species,
}: {
  species: Species
}) {
  const [
    articles,
    setArticles,
  ] = useState<
    ArticleSummary[]
  >([])

  const [
    searchInput,
    setSearchInput,
  ] = useState('')

  const [
    query,
    setQuery,
  ] = useState('')

  const [
    topicInput,
    setTopicInput,
  ] =
    useState<ArticleTopic>(
      '',
    )

  const [
    topic,
    setTopic,
  ] =
    useState<ArticleTopic>(
      '',
    )

  const [
    breedInput,
    setBreedInput,
  ] = useState('')

  const [
    breed,
    setBreed,
  ] = useState('')

  const [
    breedRecords,
    setBreedRecords,
  ] =
    useState<
      BreedRecord[]
    >([])

  const [
    page,
    setPage,
  ] = useState(1)

  const [
    totalPages,
    setTotalPages,
  ] = useState(0)

  const [
    total,
    setTotal,
  ] = useState(0)

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    error,
    setError,
  ] = useState('')

  const [
    retry,
    setRetry,
  ] = useState(0)

  const [
    selectedSlug,
    setSelectedSlug,
  ] =
    useState<
      string | null
    >(null)

  const [
    detail,
    setDetail,
  ] =
    useState<
      ArticleDetail | null
    >(null)

  const [
    detailLoading,
    setDetailLoading,
  ] = useState(false)

  const [
    detailError,
    setDetailError,
  ] = useState('')

  const [
    detailRetry,
    setDetailRetry,
  ] = useState(0)

  // ====================================================
  // Load breed/species records for this pet group
  // ====================================================

  useEffect(() => {
    const controller =
      new AbortController()

    async function loadBreedRecords() {
      try {
        const response =
          await fetch(
            `/api/breeds?species=${encodeURIComponent(
              species,
            )}`,
            {
              cache:
                'no-store',

              signal:
                controller.signal,
            },
          )

        const data =
          await response
            .json()
            .catch(
              () => null,
            )

        if (
          !response.ok ||
          !Array.isArray(
            data?.records,
          )
        ) {
          return
        }

        if (
          !controller.signal
            .aborted
        ) {
          setBreedRecords(
            data.records,
          )
        }
      } catch {
        // Breed filtering is optional.
        // Articles can still load if this request fails.
      }
    }

    void loadBreedRecords()

    return () =>
      controller.abort()
  }, [species])

  // ====================================================
  // Load article collection
  // ====================================================

  useEffect(() => {
    const controller =
      new AbortController()

    async function loadArticles() {
      setLoading(true)
      setError('')

      const params =
        new URLSearchParams({
          species,
          page:
            String(page),
        })

      if (query) {
        params.set(
          'q',
          query,
        )
      }

      if (topic) {
        params.set(
          'topic',
          topic,
        )
      }

      if (breed) {
        params.set(
          'breed',
          breed,
        )
      }

      try {
        const response =
          await fetch(
            `/api/articles?${params}`,
            {
              signal:
                controller.signal,

              cache:
                'no-store',
            },
          )

        const data =
          await response
            .json()
            .catch(
              () => null,
            )

        if (!response.ok) {
          throw new Error(
            typeof data
              ?.message ===
              'string'
              ? data.message
              : 'Article request failed.',
          )
        }

        if (
          !Array.isArray(
            data?.articles,
          ) ||
          !Number.isInteger(
            data?.totalPages,
          ) ||
          !Number.isInteger(
            data?.total,
          )
        ) {
          throw new Error(
            'Invalid article response.',
          )
        }

        if (
          !controller.signal
            .aborted
        ) {
          setArticles(
            data.articles,
          )

          setTotalPages(
            data.totalPages,
          )

          setTotal(
            data.total,
          )
        }
      } catch (
        loadError
      ) {
        if (
          !controller.signal
            .aborted
        ) {
          setError(
            loadError instanceof
              Error
              ? loadError.message
              : 'Could not load articles. Please try again.',
          )
        }
      } finally {
        if (
          !controller.signal
            .aborted
        ) {
          setLoading(false)
        }
      }
    }

    void loadArticles()

    return () =>
      controller.abort()
  }, [
    species,
    query,
    topic,
    breed,
    page,
    retry,
  ])

  // ====================================================
  // Load one full article
  // ====================================================

  useEffect(() => {
    if (!selectedSlug) {
      return
    }

    const controller =
      new AbortController()

    async function loadDetail() {
      setDetailLoading(
        true,
      )

      setDetailError('')
      setDetail(null)

      try {
        const response =
          await fetch(
            `/api/articles/${encodeURIComponent(
              selectedSlug!,
            )}`,
            {
              signal:
                controller.signal,

              cache:
                'no-store',
            },
          )

        const data =
          await response
            .json()
            .catch(
              () => null,
            )

        if (!response.ok) {
          throw new Error(
            response.status ===
              404
              ? 'This article is no longer available.'
              : typeof data
                    ?.message ===
                  'string'
                ? data.message
                : 'Could not open this article. Please try again.',
          )
        }

        if (
          !data?.article?.id ||
          typeof data
            .article
            .body !==
            'string'
        ) {
          throw new Error(
            'Could not read this article.',
          )
        }

        if (
          !controller.signal
            .aborted
        ) {
          setDetail({
            ...data.article,

            relatedArticles:
              Array.isArray(
                data.article
                  .relatedArticles,
              )
                ? data.article
                    .relatedArticles
                : [],
          })
        }
      } catch (
        loadError
      ) {
        if (
          !controller.signal
            .aborted
        ) {
          setDetailError(
            loadError instanceof
              Error
              ? loadError.message
              : 'Could not open this article.',
          )
        }
      } finally {
        if (
          !controller.signal
            .aborted
        ) {
          setDetailLoading(
            false,
          )
        }
      }
    }

    void loadDetail()

    return () =>
      controller.abort()
  }, [
    selectedSlug,
    detailRetry,
  ])

  // ====================================================
  // Helpers
  // ====================================================

  function closeArticle() {
    setSelectedSlug(
      null,
    )

    setDetail(null)
    setDetailError('')
    setDetailLoading(false)
  }

  function openArticle(
    slug: string,
  ) {
    setDetail(null)
    setDetailError('')
    setDetailLoading(true)

    setSelectedSlug(
      slug,
    )
  }

  function handleSearch(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    closeArticle()

    setPage(1)

    setQuery(
      searchInput.trim(),
    )

    setTopic(
      topicInput,
    )

    setBreed(
      breedInput,
    )
  }

  function clearFilters() {
    closeArticle()

    setSearchInput('')
    setQuery('')

    setTopicInput('')
    setTopic('')

    setBreedInput('')
    setBreed('')

    setPage(1)
  }

  function changePage(
    nextPage: number,
  ) {
    closeArticle()

    setPage(
      nextPage,
    )
  }

  const hasFilters =
    Boolean(
      query ||
        topic ||
        breed,
    )

  // ====================================================
  // Render
  // ====================================================

  return (
    <section
      id="article-collection"
      className="article-collection"
      aria-labelledby="articles-title"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            THE READING CORNER
          </p>

          <h2 id="articles-title">
            A little more to
            explore.
          </h2>
        </div>

        <p>
          Search published
          articles by keyword,
          topic, and
          breed/species.
        </p>
      </div>

      {/* ============================================== */}
      {/* SEARCH */}
      {/* ============================================== */}

      <form
        className="article-search"
        onSubmit={
          handleSearch
        }
      >
        <label htmlFor="article-search-input">
          Search this
          collection
        </label>

        <div className="article-search-controls">
          <input
            id="article-search-input"
            type="search"
            value={
              searchInput
            }
            onChange={(
              event,
            ) =>
              setSearchInput(
                event.target
                  .value,
              )
            }
            placeholder="Search titles, keywords, or breed/species terms"
            maxLength={100}
          />

          <select
            value={
              topicInput
            }
            onChange={(
              event,
            ) =>
              setTopicInput(
                event.target
                  .value as
                  ArticleTopic,
              )
            }
            aria-label="Article topic"
          >
            <option value="">
              All topics
            </option>

            {Object.entries(
              topicLabels,
            ).map(
              ([
                value,
                label,
              ]) => (
                <option
                  key={
                    value
                  }
                  value={
                    value
                  }
                >
                  {label}
                </option>
              ),
            )}
          </select>

          <select
            value={
              breedInput
            }
            onChange={(
              event,
            ) =>
              setBreedInput(
                event.target
                  .value,
              )
            }
            aria-label="Breed or species record"
          >
            <option value="">
              All breeds /
              types
            </option>

            {breedRecords.map(
              (
                record,
              ) => (
                <option
                  key={
                    record.id
                  }
                  value={
                    record.slug
                  }
                >
                  {
                    record.name
                  }
                </option>
              ),
            )}
          </select>

          <button
            className="button dark-button account-button"
            type="submit"
          >
            Search
          </button>

          {hasFilters && (
            <button
              className="article-read-button"
              type="button"
              onClick={
                clearFilters
              }
            >
              Clear filters
            </button>
          )}
        </div>
      </form>

      {/* ============================================== */}
      {/* ARTICLE LIST */}
      {/* ============================================== */}

      {loading ? (
        <p role="status">
          Loading articles…
        </p>
      ) : error ? (
        <div className="article-notice">
          <p role="alert">
            {error}
          </p>

          <button
            className="button dark-button account-button"
            type="button"
            onClick={() =>
              setRetry(
                (value) =>
                  value + 1,
              )
            }
          >
            Try again
          </button>
        </div>
      ) : articles.length ===
        0 ? (
        <div className="article-notice">
          <p>
            {hasFilters
              ? 'No published articles match these filters.'
              : 'No published articles are available in this collection yet.'}
          </p>

          {hasFilters && (
            <>
              <p>
                Try another
                keyword, choose
                another topic,
                or browse the
                breed/species
                library.
              </p>

              <button
                className="article-read-button"
                type="button"
                onClick={
                  clearFilters
                }
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <p
            role="status"
            style={{
              marginBottom:
                '1rem',
            }}
          >
            {total}{' '}
            {total === 1
              ? 'published article'
              : 'published articles'}{' '}
            found
          </p>

          <div className="article-grid">
            {articles.map(
              (
                article,
              ) => (
                <article
                  className="article-card"
                  key={
                    article.id
                  }
                >
                  <p className="eyebrow">
                    {
                      topicLabels[
                        article
                          .topic
                      ]
                    }
                  </p>

                  {article.imageUrl &&
                    article.imageAlt && (
                    <img
                      src={
                        article.imageUrl
                      }
                      alt={
                        article.imageAlt
                      }
                      loading="lazy"
                      style={{
                        display:
                          'block',

                        width:
                          '100%',

                        aspectRatio:
                          '16 / 9',

                        objectFit:
                          'cover',

                        borderRadius:
                          '12px',

                        marginBottom:
                          '1rem',
                      }}
                    />
                  )}

                  <h3>
                    {
                      article.title
                    }
                  </h3>

                  <p>
                    {
                      article.summary
                    }
                  </p>

                  <p>
                    <small>
                      Applies to:{' '}
                      {
                        speciesLabels[
                          article
                            .species
                        ]
                      }
                    </small>
                  </p>

                  <button
                    className="article-read-button"
                    type="button"
                    aria-expanded={
                      selectedSlug ===
                      article.slug
                    }
                    aria-controls={
                      selectedSlug ===
                      article.slug
                        ? 'article-reader'
                        : undefined
                    }
                    onClick={() => {
                      if (
                        selectedSlug ===
                        article.slug
                      ) {
                        closeArticle()
                      } else {
                        openArticle(
                          article.slug,
                        )
                      }
                    }}
                  >
                    {selectedSlug ===
                    article.slug
                      ? 'Close article'
                      : 'Read article'}
                  </button>
                </article>
              ),
            )}
          </div>

          {/* ========================================== */}
          {/* PAGINATION */}
          {/* ========================================== */}

          {totalPages > 1 && (
            <nav
              className="article-pagination"
              aria-label="Article pages"
            >
              <button
                type="button"
                disabled={
                  page === 1
                }
                onClick={() =>
                  changePage(
                    page - 1,
                  )
                }
              >
                Previous
              </button>

              <span>
                Page {page} of{' '}
                {totalPages}
              </span>

              <button
                type="button"
                disabled={
                  page >=
                  totalPages
                }
                onClick={() =>
                  changePage(
                    page + 1,
                  )
                }
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}

      {/* ============================================== */}
      {/* ARTICLE READER */}
      {/* ============================================== */}

      {selectedSlug && (
        <div
          className="article-reader"
          id="article-reader"
          aria-live="polite"
          aria-busy={
            detailLoading
          }
        >
          {detailLoading ? (
            <p role="status">
              Opening article…
            </p>
          ) : detailError ? (
            <>
              <p role="alert">
                {
                  detailError
                }
              </p>

              <button
                className="article-read-button"
                type="button"
                onClick={() =>
                  setDetailRetry(
                    (value) =>
                      value + 1,
                  )
                }
              >
                Try again
              </button>
            </>
          ) : detail ? (
            <article>
              <p className="eyebrow">
                FROM THE
                COLLECTION
              </p>

              <h3>
                {detail.title}
              </h3>

              {/* ====================================== */}
              {/* REVIEW INFORMATION */}
              {/* ====================================== */}

              <p className="article-review">
                {detail.reviewerName &&
                detail.reviewedAt
                  ? (
                    <>
                      Reviewed by{' '}
                      <strong>
                        {
                          detail.reviewerName
                        }
                      </strong>

                      {detail
                        .reviewerCredentials
                        ? ` (${detail.reviewerCredentials})`
                        : ''}

                      {' · Last reviewed '}

                      <time
                        dateTime={
                          detail.reviewedAt
                        }
                      >
                        {new Date(
                          detail.reviewedAt,
                        ).toLocaleDateString()}
                      </time>
                    </>
                  )
                  : 'No professional review recorded.'}
              </p>

              {/* ====================================== */}
              {/* APPLICABILITY */}
              {/* ====================================== */}

              <p>
                <strong>
                  Applies to:
                </strong>{' '}
                {
                  speciesLabels[
                    detail.species
                  ]
                }
              </p>

              <p>
                <strong>
                  Topic:
                </strong>{' '}
                {
                  topicLabels[
                    detail.topic
                  ]
                }
              </p>

              {/* ====================================== */}
              {/* ARTICLE IMAGE */}
              {/* ====================================== */}

              {detail.imageUrl &&
                detail.imageAlt &&
                detail.imageRights && (
                <figure
                  style={{
                    margin:
                      '1.5rem 0',
                  }}
                >
                  <img
                    src={
                      detail.imageUrl
                    }
                    alt={
                      detail.imageAlt
                    }
                    style={{
                      display:
                        'block',

                      width:
                        '100%',

                      maxHeight:
                        '520px',

                      objectFit:
                        'cover',

                      borderRadius:
                        '14px',
                    }}
                  />

                  <figcaption>
                    <small>
                      Image rights:{' '}
                      {
                        detail.imageRights
                      }
                    </small>
                  </figcaption>
                </figure>
              )}

              {/* ====================================== */}
              {/* BODY */}
              {/* ====================================== */}

              <div className="article-body">
                {detail.body
                  .split(
                    /\n\s*\n/,
                  )
                  .map(
                    (
                      paragraph,
                      index,
                    ) => (
                      <p
                        key={
                          index
                        }
                      >
                        {
                          paragraph
                        }
                      </p>
                    ),
                  )}
              </div>

              {/* ====================================== */}
              {/* SOURCES */}
              {/* ====================================== */}

              {detail
                .sourceUrls
                .length > 0 && (
                <div className="article-sources">
                  <h4>
                    Sources
                  </h4>

                  <ul>
                    {detail.sourceUrls
                      .filter(
                        (
                          url,
                        ) =>
                          /^https?:\/\//i.test(
                            url,
                          ),
                      )
                      .map(
                        (
                          url,
                          index,
                        ) => (
                          <li
                            key={`${url}-${index}`}
                          >
                            <a
                              href={
                                url
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {
                                url
                              }
                            </a>
                          </li>
                        ),
                      )}
                  </ul>
                </div>
              )}

              {/* ====================================== */}
              {/* RELATED ARTICLES / TOPICS */}
              {/* ====================================== */}

              {detail
                .relatedArticles
                .length > 0 && (
                <div className="article-sources">
                  <h4>
                    Related topics
                  </h4>

                  <ul>
                    {detail.relatedArticles.map(
                      (
                        related,
                      ) => (
                        <li
                          key={
                            related.id
                          }
                        >
                          <button
                            className="article-read-button"
                            type="button"
                            onClick={() =>
                              openArticle(
                                related.slug,
                              )
                            }
                          >
                            {
                              related.title
                            }
                            {' · '}
                            {
                              topicLabels[
                                related
                                  .topic
                              ]
                            }
                          </button>
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              )}

              {/* ====================================== */}
              {/* REPORT ISSUE */}
              {/* ====================================== */}

              <p>
                <Link
                  className="text-link"
                  to={`/reports/new?type=ARTICLE&id=${encodeURIComponent(
                    detail.id,
                  )}`}
                  aria-label={`Report an issue with ${detail.title}`}
                >
                  Report an issue
                  with this article
                </Link>
              </p>

              <button
                className="article-read-button"
                type="button"
                onClick={
                  closeArticle
                }
              >
                Close article
              </button>
            </article>
          ) : null}
        </div>
      )}
    </section>
  )
}

export default ArticleCollection