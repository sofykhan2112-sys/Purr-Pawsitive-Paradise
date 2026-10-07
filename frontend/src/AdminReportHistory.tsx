import {
  useEffect,
  useState,
} from 'react'
import {
  Link,
  useParams,
} from 'react-router'
import './AdminVetEditor.css'

type HistoryEvent = {
  id: string
  version: number
  action: string
  previousStatus: string | null
  newStatus: string
  createdAt: string

  actor: {
    id: string
    name: string
  } | null
}

type ReportHistory = {
  id: string
  targetLabel: string

  articleId: string | null
  vetListingId: string | null
  ambulanceListingId: string | null

  chatbotResponseId:
    | string
    | null

  chatbotQuestion:
    | string
    | null

  chatbotResponse:
    | string
    | null

  chatbotMode:
    | string
    | null

  category: string
  details: string

  status: string

  resolutionSummary:
    | string
    | null

  createdAt: string
  updatedAt: string

  closedAt:
    | string
    | null

  events: HistoryEvent[]
}

const actionLabels:
  Record<string, string> = {
    ISSUE_REPORT_CREATED:
      'Report submitted',

    ISSUE_REPORT_REVIEW_STARTED:
      'Review started',

    ISSUE_REPORT_RESOLVED:
      'Report resolved',

    ISSUE_REPORT_DISMISSED:
      'Report dismissed',
  }

function formatDate(
  value: string,
) {
  return new Date(
    value,
  ).toLocaleString(
    'en-IN',
    {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone:
        'Asia/Kolkata',
    },
  )
}

function formatLabel(
  value: string,
) {
  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    )
}

function targetTypeLabel(
  report: ReportHistory,
) {
  if (
    report.chatbotResponseId
  ) {
    return 'Chatbot response'
  }

  if (report.articleId) {
    return 'Article'
  }

  if (report.vetListingId) {
    return 'Vet listing'
  }

  if (
    report.ambulanceListingId
  ) {
    return 'Ambulance listing'
  }

  return 'Unknown target'
}

function targetLink(
  report: ReportHistory,
) {
  if (report.articleId) {
    return `/admin/articles/${encodeURIComponent(
      report.articleId,
    )}`
  }

  if (report.vetListingId) {
    return `/admin/vets/${encodeURIComponent(
      report.vetListingId,
    )}`
  }

  if (
    report.ambulanceListingId
  ) {
    return `/admin/ambulances/${encodeURIComponent(
      report
        .ambulanceListingId,
    )}`
  }

  return null
}

function AdminReportHistory() {
  const { id } =
    useParams()

  const [
    report,
    setReport,
  ] =
    useState<
      ReportHistory | null
    >(null)

  const [
    loading,
    setLoading,
  ] =
    useState(true)

  const [
    error,
    setError,
  ] =
    useState('')

  const [
    needsLogin,
    setNeedsLogin,
  ] =
    useState(false)

  const [
    retry,
    setRetry,
  ] =
    useState(0)

  useEffect(() => {
    const controller =
      new AbortController()

    async function loadHistory() {
      setLoading(true)

      setError('')

      setNeedsLogin(false)

      setReport(null)

      try {
        if (!id) {
          throw new Error(
            'Missing report ID.',
          )
        }

        const response =
          await fetch(
            `/api/admin/issue-reports/${encodeURIComponent(
              id,
            )}/history`,
            {
              credentials:
                'same-origin',

              cache:
                'no-store',

              signal:
                controller
                  .signal,
            },
          )

        if (
          controller.signal
            .aborted
        ) {
          return
        }

        if (
          response.status ===
          401
        ) {
          setNeedsLogin(
            true,
          )
          return
        }

        if (
          response.status ===
          403
        ) {
          throw new Error(
            'Administrator access is required.',
          )
        }

        if (
          response.status ===
          404
        ) {
          throw new Error(
            'Report not found.',
          )
        }

        if (
          !response.ok
        ) {
          throw new Error(
            'Could not load report history.',
          )
        }

        const data =
          await response
            .json()

        if (
          data.report?.id !==
            id ||
          !Array.isArray(
            data.report
              ?.events,
          )
        ) {
          throw new Error(
            'Invalid report history response.',
          )
        }

        if (
          !controller.signal
            .aborted
        ) {
          setReport(
            data.report,
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
              : 'Could not load report history.',
          )
        }
      } finally {
        if (
          !controller.signal
            .aborted
        ) {
          setLoading(
            false,
          )
        }
      }
    }

    void loadHistory()

    return () =>
      controller.abort()
  }, [
    id,
    retry,
  ])

  const href =
    report
      ? targetLink(
          report,
        )
      : null

  const isChatbot =
    report
      ?.chatbotResponseId !==
      null &&
    report
      ?.chatbotResponseId !==
      undefined

  return (
    <main className="page-width vet-editor-main">
      <p className="eyebrow">
        ADMINISTRATION
      </p>

      <h1>
        Report history
      </h1>

      <Link
        className="text-link"
        to="/admin/reports"
      >
        Back to reports
      </Link>

      {loading ? (
        <p role="status">
          Loading history…
        </p>
      ) : needsLogin ? (
        <p>
          Please{' '}
          <Link to="/login">
            sign in
          </Link>{' '}
          as an administrator,
          then return to this
          page.
        </p>
      ) : error ? (
        <div>
          <p role="alert">
            {error}
          </p>

          <button
            type="button"
            className="button dark-button"
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
      ) : report ? (
        <>
          <section
            style={{
              marginTop:
                '1.5rem',

              padding:
                '1.5rem',

              border:
                '1px solid #dfe5df',

              borderRadius:
                '12px',

              background:
                '#ffffff',
            }}
          >
            <p className="eyebrow">
              {formatLabel(
                report.status,
              )}
            </p>

            <h2>
              {
                report.targetLabel
              }
            </h2>

            <p>
              <strong>
                Target:
              </strong>{' '}
              {targetTypeLabel(
                report,
              )}
            </p>

            <p>
              <strong>
                Category:
              </strong>{' '}
              {formatLabel(
                report.category,
              )}
            </p>

            <p>
              <strong>
                Submitted:
              </strong>{' '}
              {formatDate(
                report.createdAt,
              )}{' '}
              IST
            </p>

            <p
              style={{
                overflowWrap:
                  'anywhere',
              }}
            >
              <strong>
                Report reference:
              </strong>{' '}
              {report.id}
            </p>

            {href && (
              <p>
                <Link
                  className="text-link"
                  to={href}
                >
                  Open reported
                  content
                </Link>
              </p>
            )}
          </section>

          {isChatbot && (
            <section
              style={{
                marginTop:
                  '1.5rem',

                padding:
                  '1.5rem',

                border:
                  '1px solid #dfe8e1',

                borderRadius:
                  '12px',

                background:
                  '#f8fbf8',
              }}
            >
              <p className="eyebrow">
                CHATBOT SNAPSHOT
              </p>

              <h2>
                Reported chatbot
                exchange
              </h2>

              {report.chatbotMode && (
                <p>
                  <strong>
                    Response mode:
                  </strong>{' '}
                  {
                    report.chatbotMode
                  }
                </p>
              )}

              {report.chatbotQuestion && (
                <div
                  style={{
                    marginTop:
                      '1.25rem',
                  }}
                >
                  <strong>
                    User question
                  </strong>

                  <p
                    style={{
                      whiteSpace:
                        'pre-wrap',

                      lineHeight:
                        1.6,
                    }}
                  >
                    {
                      report.chatbotQuestion
                    }
                  </p>
                </div>
              )}

              {report.chatbotResponse && (
                <div
                  style={{
                    marginTop:
                      '1.25rem',

                    padding:
                      '1rem',

                    border:
                      '1px solid #e2e8e3',

                    borderRadius:
                      '10px',

                    background:
                      '#ffffff',
                  }}
                >
                  <strong>
                    Assistant
                    response
                  </strong>

                  <p
                    style={{
                      whiteSpace:
                        'pre-wrap',

                      lineHeight:
                        1.65,

                      marginBottom:
                        0,
                    }}
                  >
                    {
                      report.chatbotResponse
                    }
                  </p>
                </div>
              )}

              {report.chatbotResponseId && (
                <p
                  style={{
                    marginTop:
                      '1rem',

                    overflowWrap:
                      'anywhere',
                  }}
                >
                  <small>
                    Chat response
                    reference:{' '}
                    {
                      report.chatbotResponseId
                    }
                  </small>
                </p>
              )}

              <p
                style={{
                  marginBottom:
                    0,

                  color:
                    '#66736c',

                  fontSize:
                    '0.9rem',
                }}
              >
                This is the exact
                response snapshot
                stored when the
                user submitted the
                report.
              </p>
            </section>
          )}

          <section
            style={{
              marginTop:
                '1.5rem',

              padding:
                '1.5rem',

              border:
                '1px solid #e3e3e3',

              borderRadius:
                '12px',

              background:
                '#fafafa',
            }}
          >
            <h2>
              Reporter description
            </h2>

            <p
              style={{
                whiteSpace:
                  'pre-wrap',

                lineHeight:
                  1.6,
              }}
            >
              {report.details}
            </p>
          </section>

          <section
            style={{
              marginTop:
                '2rem',
            }}
          >
            <h2>
              Review timeline
            </h2>

            {report.events
              .length ===
            0 ? (
              <p>
                No history has
                been recorded.
              </p>
            ) : (
              <ol
                style={{
                  paddingLeft:
                    '1.5rem',
                }}
              >
                {report.events.map(
                  (event) => (
                    <li
                      key={
                        event.id
                      }
                      style={{
                        padding:
                          '1rem',

                        marginBottom:
                          '1rem',

                        borderBottom:
                          '1px solid #d8d8d8',
                      }}
                    >
                      <h3>
                        {actionLabels[
                          event.action
                        ] ??
                          formatLabel(
                            event.action,
                          )}
                      </h3>

                      <p>
                        {event.previousStatus
                          ? `${formatLabel(
                              event.previousStatus,
                            )} → `
                          : ''}

                        {formatLabel(
                          event.newStatus,
                        )}
                      </p>

                      <p>
                        {event.action ===
                        'ISSUE_REPORT_CREATED'
                          ? 'Submitted by the reporter'
                          : event.actor
                            ? `Changed by ${event.actor.name}`
                            : 'Actor not recorded'}
                      </p>

                      <p>
                        <time
                          dateTime={
                            event.createdAt
                          }
                        >
                          {formatDate(
                            event.createdAt,
                          )}
                        </time>{' '}
                        IST
                      </p>

                      <small>
                        Version{' '}
                        {
                          event.version
                        }
                      </small>
                    </li>
                  ),
                )}
              </ol>
            )}
          </section>

          {report.resolutionSummary && (
            <section
              style={{
                marginTop:
                  '2rem',

                padding:
                  '1.5rem',

                border:
                  '1px solid #dfe5df',

                borderRadius:
                  '12px',

                background:
                  '#f7faf6',
              }}
            >
              <h2>
                Outcome shared with
                the reporter
              </h2>

              <p
                style={{
                  whiteSpace:
                    'pre-wrap',

                  lineHeight:
                    1.6,
                }}
              >
                {
                  report.resolutionSummary
                }
              </p>
            </section>
          )}
        </>
      ) : null}
    </main>
  )
}

export default AdminReportHistory