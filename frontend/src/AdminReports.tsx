import {
  useEffect,
  useRef,
  useState,
} from 'react'
import { Link } from 'react-router'
import './AdminVetEditor.css'

type ReportStatus =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'RESOLVED'
  | 'DISMISSED'

type Report = {
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

  status: ReportStatus

  resolutionSummary:
    | string
    | null

  version: number

  createdAt: string
  updatedAt: string

  closedAt:
    | string
    | null
}

type StatusFilter =
  | ReportStatus
  | 'ALL'

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

function formatStatus(
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

function targetLink(
  report: Report,
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

function targetTypeLabel(
  report: Report,
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

function AdminReports() {
  const [
    reports,
    setReports,
  ] = useState<Report[]>([])

  const [
    status,
    setStatus,
  ] =
    useState<StatusFilter>(
      'OPEN',
    )

  const [
    page,
    setPage,
  ] = useState(1)

  const [
    total,
    setTotal,
  ] = useState(0)

  const [
    totalPages,
    setTotalPages,
  ] = useState(0)

  const [
    refresh,
    setRefresh,
  ] = useState(0)

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    loadError,
    setLoadError,
  ] = useState('')

  const [
    access,
    setAccess,
  ] = useState<
    | 'allowed'
    | 'signin'
    | 'forbidden'
  >('allowed')

  const [
    summaries,
    setSummaries,
  ] = useState<
    Record<string, string>
  >({})

  const [
    savingId,
    setSavingId,
  ] =
    useState<
      string | null
    >(null)

  const [
    actionError,
    setActionError,
  ] = useState('')

  const [
    notice,
    setNotice,
  ] = useState('')

  const mutationInFlight =
    useRef(false)

  useEffect(() => {
    const controller =
      new AbortController()

    async function loadReports() {
      setLoading(true)

      setLoadError('')

      setAccess(
        'allowed',
      )

      setReports([])

      try {
        const params =
          new URLSearchParams({
            page:
              String(page),
          })

        if (
          status !== 'ALL'
        ) {
          params.set(
            'status',
            status,
          )
        }

        const response =
          await fetch(
            `/api/admin/issue-reports?${params.toString()}`,
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
          controller
            .signal
            .aborted
        ) {
          return
        }

        if (
          response.status ===
          401
        ) {
          setAccess(
            'signin',
          )
          return
        }

        if (
          response.status ===
          403
        ) {
          setAccess(
            'forbidden',
          )
          return
        }

        if (
          !response.ok
        ) {
          throw new Error(
            'Unable to load reports.',
          )
        }

        const data =
          await response
            .json()

        if (
          !Array.isArray(
            data.reports,
          ) ||
          !Number.isInteger(
            data.total,
          ) ||
          data.total < 0 ||
          !Number.isInteger(
            data.totalPages,
          ) ||
          data.totalPages <
            0
        ) {
          throw new Error(
            'Invalid reports response.',
          )
        }

        if (
          controller
            .signal
            .aborted
        ) {
          return
        }

        const lastPage =
          Math.max(
            1,
            data.totalPages,
          )

        if (
          page > lastPage
        ) {
          setPage(
            lastPage,
          )
          return
        }

        setReports(
          data.reports,
        )

        setTotal(
          data.total,
        )

        setTotalPages(
          data.totalPages,
        )
      } catch {
        if (
          !controller
            .signal
            .aborted
        ) {
          setLoadError(
            'Could not load reports. Please try again.',
          )
        }
      } finally {
        if (
          !controller
            .signal
            .aborted
        ) {
          setLoading(
            false,
          )
        }
      }
    }

    void loadReports()

    return () =>
      controller.abort()
  }, [
    status,
    page,
    refresh,
  ])

  async function updateStatus(
    report: Report,
    nextStatus:
      | 'UNDER_REVIEW'
      | 'RESOLVED'
      | 'DISMISSED',
  ) {
    if (
      mutationInFlight.current
    ) {
      return
    }

    const summary =
      (
        summaries[
          report.id
        ] ?? ''
      ).trim()

    const closing =
      nextStatus !==
      'UNDER_REVIEW'

    setActionError('')
    setNotice('')

    if (
      closing &&
      (
        summary.length <
          10 ||
        summary.length >
          1000
      )
    ) {
      setActionError(
        'Enter an outcome explanation between 10 and 1000 characters.',
      )
      return
    }

    mutationInFlight.current =
      true

    setSavingId(
      report.id,
    )

    try {
      const response =
        await fetch(
          `/api/admin/issue-reports/${encodeURIComponent(
            report.id,
          )}/status`,
          {
            method:
              'PATCH',

            credentials:
              'same-origin',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify(
                {
                  status:
                    nextStatus,

                  version:
                    report.version,

                  ...(closing
                    ? {
                        resolutionSummary:
                          summary,
                      }
                    : {}),
                },
              ),
          },
        )

      const data =
        await response
          .json()
          .catch(
            () => null,
          )

      if (
        response.status ===
        401
      ) {
        setAccess(
          'signin',
        )

        setReports([])
        return
      }

      if (
        response.status ===
        403
      ) {
        setAccess(
          'forbidden',
        )

        setReports([])
        return
      }

      if (
        !response.ok
      ) {
        throw new Error(
          typeof data
            ?.message ===
            'string'
            ? data.message
            : 'Could not update the report.',
        )
      }

      if (
        data?.report?.id !==
          report.id ||
        data.report
          .status !==
          nextStatus
      ) {
        throw new Error(
          'The update response was unclear. Check the refreshed report status.',
        )
      }

      setNotice(
        nextStatus ===
          'UNDER_REVIEW'
          ? 'Review started. Select Under review to continue.'
          : nextStatus ===
              'RESOLVED'
            ? 'Report resolved. The reporter can now see your explanation.'
            : 'Report dismissed. The reporter can now see your explanation.',
      )

      setSummaries(
        (current) => {
          const updated = {
            ...current,
          }

          delete updated[
            report.id
          ]

          return updated
        },
      )
    } catch (error) {
      setActionError(
        error instanceof
          Error
          ? `${error.message} The queue will refresh; check the status before retrying.`
          : 'Could not confirm the update. Check the refreshed report status.',
      )
    } finally {
      setReports([])

      setLoading(true)

      setRefresh(
        (value) =>
          value + 1,
      )

      setSavingId(null)

      mutationInFlight.current =
        false
    }
  }

  return (
    <main className="page-width vet-editor-main">
      <p className="eyebrow">
        ADMINISTRATION
      </p>

      <h1>
        Reported issues
      </h1>

      <p>
        Review reported
        information and explain
        the outcome to the
        reporter.
      </p>

      <Link
        className="text-link"
        to="/account"
      >
        Back to account
      </Link>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems:
            'end',
          gap: '1rem',
          margin:
            '1.5rem 0',
        }}
      >
        <label>
          <span
            style={{
              display:
                'block',

              marginBottom:
                '0.5rem',
            }}
          >
            Report status
          </span>

          <select
            value={status}
            disabled={
              savingId !==
              null
            }
            onChange={(
              event,
            ) => {
              setStatus(
                event.target
                  .value as StatusFilter,
              )

              setPage(1)

              setActionError(
                '',
              )

              setNotice('')
            }}
            style={{
              padding:
                '0.65rem',
            }}
          >
            <option value="OPEN">
              Open
            </option>

            <option value="UNDER_REVIEW">
              Under review
            </option>

            <option value="RESOLVED">
              Resolved
            </option>

            <option value="DISMISSED">
              Dismissed
            </option>

            <option value="ALL">
              All statuses
            </option>
          </select>
        </label>

        <button
          type="button"
          className="button dark-button"
          disabled={
            loading ||
            savingId !== null
          }
          onClick={() =>
            setRefresh(
              (value) =>
                value + 1,
            )
          }
        >
          Refresh
        </button>
      </div>

      {notice && (
        <p role="status">
          {notice}
        </p>
      )}

      {actionError && (
        <p role="alert">
          {actionError}
        </p>
      )}

      {loading ? (
        <p role="status">
          Loading reports…
        </p>
      ) : access ===
        'signin' ? (
        <p>
          Please{' '}
          <Link to="/login">
            sign in
          </Link>{' '}
          with an
          administrator
          account, then
          return to this
          page.
        </p>
      ) : access ===
        'forbidden' ? (
        <p role="alert">
          Administrator
          access is required.
        </p>
      ) : loadError ? (
        <p role="alert">
          {loadError}
        </p>
      ) : (
        <>
          <p>
            {total}{' '}
            {total === 1
              ? 'report'
              : 'reports'}{' '}
            found.
          </p>

          {reports.length ===
            0 && (
            <p>
              No reports match
              this status.
            </p>
          )}

          <div
            style={{
              display:
                'grid',

              gap:
                '1.5rem',
            }}
          >
            {reports.map(
              (report) => {
                const href =
                  targetLink(
                    report,
                  )

                const saving =
                  savingId ===
                  report.id

                const isChatbot =
                  report
                    .chatbotResponseId !==
                  null

                return (
                  <article
                    key={
                      report.id
                    }
                    style={{
                      border:
                        '1px solid #d8d8d8',

                      borderRadius:
                        '12px',

                      padding:
                        '1.5rem',

                      overflowWrap:
                        'anywhere',

                      background:
                        '#fff',
                    }}
                  >
                    <div
                      style={{
                        display:
                          'flex',

                        justifyContent:
                          'space-between',

                        alignItems:
                          'flex-start',

                        gap:
                          '1rem',

                        flexWrap:
                          'wrap',
                      }}
                    >
                      <div>
                        <p className="eyebrow">
                          {formatStatus(
                            report.status,
                          )}
                        </p>

                        <h2
                          style={{
                            marginBottom:
                              '0.5rem',
                          }}
                        >
                          {
                            report.targetLabel
                          }
                        </h2>

                        <p
                          style={{
                            marginTop:
                              0,

                            color:
                              '#666',
                          }}
                        >
                          <strong>
                            Target:
                          </strong>{' '}
                          {targetTypeLabel(
                            report,
                          )}
                        </p>
                      </div>

                      {isChatbot && (
                        <span
                          style={{
                            padding:
                              '0.4rem 0.7rem',

                            borderRadius:
                              '999px',

                            background:
                              '#edf4ef',

                            fontSize:
                              '0.8rem',

                            fontWeight:
                              600,
                          }}
                        >
                          Chatbot feedback
                        </span>
                      )}
                    </div>

                    <p>
                      <strong>
                        Category:
                      </strong>{' '}
                      {formatStatus(
                        report.category,
                      )}
                    </p>

                    {isChatbot && (
                      <section
                        style={{
                          margin:
                            '1.25rem 0',

                          padding:
                            '1rem',

                          border:
                            '1px solid #dfe8e1',

                          borderRadius:
                            '10px',

                          background:
                            '#f8fbf8',
                        }}
                      >
                        <h3
                          style={{
                            marginTop:
                              0,
                          }}
                        >
                          Reported chatbot
                          exchange
                        </h3>

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
                                '1rem',
                            }}
                          >
                            <strong>
                              User question
                            </strong>

                            <p
                              style={{
                                whiteSpace:
                                  'pre-wrap',

                                marginBottom:
                                  0,
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
                                '1rem',

                              padding:
                                '1rem',

                              borderRadius:
                                '8px',

                              background:
                                '#fff',
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

                                marginBottom:
                                  0,

                                lineHeight:
                                  1.6,
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
                              marginBottom:
                                0,

                              marginTop:
                                '1rem',
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
                      </section>
                    )}

                    <div
                      style={{
                        margin:
                          '1rem 0',

                        padding:
                          '1rem',

                        borderRadius:
                          '8px',

                        background:
                          '#f7f7f7',
                      }}
                    >
                      <strong>
                        Reporter description
                      </strong>

                      <p
                        style={{
                          whiteSpace:
                            'pre-wrap',

                          marginBottom:
                            0,
                        }}
                      >
                        {
                          report.details
                        }
                      </p>
                    </div>

                    <p>
                      Submitted:{' '}
                      {formatDate(
                        report.createdAt,
                      )}{' '}
                      IST
                    </p>

                    <p>
                      <small>
                        Report
                        reference:{' '}
                        {
                          report.id
                        }
                      </small>
                    </p>

                    <p>
                      <Link
                        className="text-link"
                        to={`/admin/reports/${encodeURIComponent(
                          report.id,
                        )}/history`}
                      >
                        View review
                        history
                      </Link>
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

                    {isChatbot && (
                      <p
                        style={{
                          color:
                            '#666',

                          fontSize:
                            '0.9rem',
                        }}
                      >
                        This chatbot
                        response is a
                        saved report
                        snapshot, so
                        there is no
                        separate content
                        page to open.
                      </p>
                    )}

                    {report.status ===
                      'OPEN' && (
                      <button
                        type="button"
                        className="button dark-button"
                        disabled={
                          savingId !==
                          null
                        }
                        onClick={() =>
                          void updateStatus(
                            report,
                            'UNDER_REVIEW',
                          )
                        }
                      >
                        {saving
                          ? 'Saving…'
                          : 'Start review'}
                      </button>
                    )}

                    {report.status ===
                      'UNDER_REVIEW' && (
                      <div
                        style={{
                          marginTop:
                            '1.25rem',
                        }}
                      >
                        <label
                          htmlFor={`outcome-${report.id}`}
                        >
                          <strong>
                            Outcome explanation
                          </strong>
                        </label>

                        <p
                          id={`outcome-help-${report.id}`}
                        >
                          The reporter
                          will see this
                          explanation.
                          Describe what
                          you checked
                          and any action
                          taken.
                        </p>

                        <textarea
                          id={`outcome-${report.id}`}
                          aria-describedby={`outcome-help-${report.id}`}
                          value={
                            summaries[
                              report.id
                            ] ?? ''
                          }
                          onChange={(
                            event,
                          ) =>
                            setSummaries(
                              (
                                current,
                              ) => ({
                                ...current,

                                [report.id]:
                                  event
                                    .target
                                    .value,
                              }),
                            )
                          }
                          rows={4}
                          maxLength={
                            1000
                          }
                          disabled={
                            savingId !==
                            null
                          }
                          style={{
                            width:
                              '100%',

                            boxSizing:
                              'border-box',

                            padding:
                              '0.75rem',

                            font:
                              'inherit',
                          }}
                        />

                        <div
                          style={{
                            display:
                              'flex',

                            flexWrap:
                              'wrap',

                            gap:
                              '0.75rem',

                            marginTop:
                              '1rem',
                          }}
                        >
                          <button
                            type="button"
                            className="button dark-button"
                            disabled={
                              savingId !==
                              null
                            }
                            onClick={() =>
                              void updateStatus(
                                report,
                                'RESOLVED',
                              )
                            }
                          >
                            {saving
                              ? 'Saving…'
                              : 'Resolve report'}
                          </button>

                          <button
                            type="button"
                            className="button"
                            disabled={
                              savingId !==
                              null
                            }
                            onClick={() =>
                              void updateStatus(
                                report,
                                'DISMISSED',
                              )
                            }
                          >
                            {saving
                              ? 'Saving…'
                              : 'Dismiss report'}
                          </button>
                        </div>
                      </div>
                    )}

                    {report.resolutionSummary && (
                      <div
                        style={{
                          marginTop:
                            '1.25rem',

                          padding:
                            '1rem',

                          borderRadius:
                            '8px',

                          background:
                            '#f6f8f5',
                        }}
                      >
                        <h3>
                          Outcome
                        </h3>

                        <p
                          style={{
                            whiteSpace:
                              'pre-wrap',
                          }}
                        >
                          {
                            report.resolutionSummary
                          }
                        </p>
                      </div>
                    )}

                    {report.closedAt && (
                      <p>
                        Closed:{' '}
                        {formatDate(
                          report.closedAt,
                        )}{' '}
                        IST
                      </p>
                    )}
                  </article>
                )
              },
            )}
          </div>

          {totalPages > 1 && (
            <nav
              aria-label="Reports pagination"
              style={{
                display:
                  'flex',

                alignItems:
                  'center',

                gap:
                  '1rem',

                marginTop:
                  '1.5rem',
              }}
            >
              <button
                type="button"
                className="button"
                disabled={
                  page === 1 ||
                  savingId !==
                    null
                }
                onClick={() =>
                  setPage(
                    (value) =>
                      value - 1,
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
                className="button"
                disabled={
                  page >=
                    totalPages ||
                  savingId !==
                    null
                }
                onClick={() =>
                  setPage(
                    (value) =>
                      value + 1,
                  )
                }
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </main>
  )
}

export default AdminReports