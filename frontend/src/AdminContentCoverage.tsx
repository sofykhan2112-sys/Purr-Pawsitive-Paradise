import {
    useEffect,
    useState,
  } from 'react'
  
  import {
    Link,
    useNavigate,
  } from 'react-router'
  
  import './AdminArticles.css'
  
  type Species =
    | 'CAT'
    | 'DOG'
    | 'TURTLE'
  
  type StatusCounts = {
    DRAFT: number
    IN_REVIEW: number
    PUBLISHED: number
    ARCHIVED: number
  }
  
  type CoverageTopic = {
    topic: string
    label: string
    applicable: boolean
    note: string | null
    publicCount: number
    statusCounts: StatusCounts
    complete: boolean
  }
  
  type CoverageGroup = {
    species: Species
    topics: CoverageTopic[]
    applicableCount: number
    completedCount: number
    complete: boolean
  }
  
  type CoverageResponse = {
    rows: CoverageGroup[]
    summary: {
      applicableCount: number
      completedCount: number
      missingCount: number
      complete: boolean
    }
  }
  
  const speciesLabels:
    Record<Species, string> = {
      CAT: 'Cats',
      DOG: 'Dogs',
      TURTLE: 'Turtles',
    }
  
  function AdminContentCoverage() {
    const navigate =
      useNavigate()
  
    const [
      data,
      setData,
    ] =
      useState<CoverageResponse | null>(
        null,
      )
  
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
  
    useEffect(() => {
      const controller =
        new AbortController()
  
      async function loadCoverage() {
        setLoading(true)
        setError('')
  
        try {
          const response =
            await fetch(
              '/api/admin/articles/coverage',
              {
                credentials:
                  'same-origin',
                cache:
                  'no-store',
                signal:
                  controller.signal,
              },
            )
  
          if (
            response.status === 401
          ) {
            navigate(
              '/login',
              {
                replace: true,
              },
            )
            return
          }
  
          const result =
            (await response
              .json()
              .catch(
                () => null,
              )) as
              | CoverageResponse
              | {
                  message?: string
                }
              | null
  
          if (!response.ok) {
            throw new Error(
              result &&
              'message' in result &&
              typeof result.message ===
                'string'
                ? result.message
                : 'Could not load the content coverage matrix.',
            )
          }
  
          if (
            !result ||
            !('rows' in result) ||
            !Array.isArray(
              result.rows,
            ) ||
            !('summary' in result)
          ) {
            throw new Error(
              'The server returned an unexpected coverage response.',
            )
          }
  
          if (
            !controller.signal
              .aborted
          ) {
            setData(
              result as
                CoverageResponse,
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
                : 'Could not load content coverage.',
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
  
      void loadCoverage()
  
      return () =>
        controller.abort()
    }, [navigate, retry])
  
    return (
      <>
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
            aria-label="Admin navigation"
          >
            <Link to="/admin/articles">
              Articles
            </Link>
  
            <Link to="/account">
              My account
            </Link>
  
            <Link to="/">
              View website
            </Link>
          </nav>
        </header>
  
        <main className="page-width admin-main">
          <div className="admin-heading">
            <div>
              <p className="eyebrow">
                CONTENT
                GOVERNANCE
              </p>
  
              <h1>
                Care-topic
                coverage.
              </h1>
  
              <p>
                Track the P0
                content matrix
                across cats,
                dogs, and turtles.
                A topic counts as
                complete only when
                at least one
                article is
                currently eligible
                for public display.
              </p>
            </div>
  
            <Link
              className="button dark-button admin-button"
              to="/admin/articles"
            >
              Manage articles
            </Link>
          </div>
  
          {loading ? (
            <p
              className="admin-notice"
              role="status"
            >
              Loading content
              coverage…
            </p>
          ) : error ? (
            <div className="admin-notice">
              <p role="alert">
                {error}
              </p>
  
              <button
                className="button dark-button admin-button"
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
          ) : data ? (
            <>
              <section
                className={
                  data.summary
                    .complete
                    ? 'admin-success'
                    : 'admin-notice'
                }
                aria-label="Coverage summary"
                style={{
                  marginBottom:
                    '2rem',
                }}
              >
                <strong>
                  {
                    data.summary
                      .completedCount
                  }{' '}
                  of{' '}
                  {
                    data.summary
                      .applicableCount
                  }{' '}
                  required topic
                  areas have
                  public coverage.
                </strong>
  
                <p>
                  {data.summary
                    .complete
                    ? 'The current FR02 content matrix has no unexplained applicable gaps.'
                    : `${data.summary.missingCount} required topic area${data.summary.missingCount === 1 ? '' : 's'} still need public, reviewed content.`}
                </p>
              </section>
  
              {data.rows.map(
                (group) => (
                  <section
                    key={
                      group.species
                    }
                    style={{
                      marginBottom:
                        '2.5rem',
                    }}
                    aria-labelledby={`coverage-${group.species}`}
                  >
                    <div className="admin-list-heading">
                      <h2
                        id={`coverage-${group.species}`}
                      >
                        {
                          speciesLabels[
                            group
                              .species
                          ]
                        }
                      </h2>
  
                      <span>
                        {
                          group.completedCount
                        }{' '}
                        /{' '}
                        {
                          group.applicableCount
                        }{' '}
                        covered
                      </span>
                    </div>
  
                    <div className="admin-article-list">
                      {group.topics.map(
                        (
                          topic,
                        ) => (
                          <article
                            className="admin-article-row"
                            key={
                              topic.topic
                            }
                          >
                            <div>
                              <p className="eyebrow">
                                {
                                  topic.topic
                                }
                              </p>
  
                              <h3>
                                {
                                  topic.label
                                }
                              </h3>
  
                              {topic.applicable ? (
                                <>
                                  <p>
                                    Public
                                    coverage:{' '}
                                    <strong>
                                      {
                                        topic.publicCount
                                      }
                                    </strong>
                                  </p>
  
                                  <small>
                                    Draft:{' '}
                                    {
                                      topic
                                        .statusCounts
                                        .DRAFT
                                    }{' '}
                                    · In
                                    review:{' '}
                                    {
                                      topic
                                        .statusCounts
                                        .IN_REVIEW
                                    }{' '}
                                    ·
                                    Published
                                    records:{' '}
                                    {
                                      topic
                                        .statusCounts
                                        .PUBLISHED
                                    }{' '}
                                    ·
                                    Archived:{' '}
                                    {
                                      topic
                                        .statusCounts
                                        .ARCHIVED
                                    }
                                  </small>
                                </>
                              ) : (
                                <p>
                                  Not
                                  applicable
                                  as a
                                  separate
                                  required
                                  topic.
                                </p>
                              )}
  
                              {topic.note && (
                                <p
                                  style={{
                                    marginTop:
                                      '0.65rem',
                                  }}
                                >
                                  <small>
                                    {
                                      topic.note
                                    }
                                  </small>
                                </p>
                              )}
                            </div>
  
                            <span
                              className={
                                topic.complete
                                  ? 'admin-status status-published'
                                  : 'admin-status status-draft'
                              }
                            >
                              {topic.applicable
                                ? topic.complete
                                  ? 'Covered'
                                  : 'Missing'
                                : 'N/A'}
                            </span>
                          </article>
                        ),
                      )}
                    </div>
                  </section>
                ),
              )}
            </>
          ) : null}
        </main>
      </>
    )
  }
  
  export default AdminContentCoverage
  