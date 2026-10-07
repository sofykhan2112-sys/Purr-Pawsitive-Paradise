import {
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  Link,
  useSearchParams,
} from 'react-router'
import './AdminVetEditor.css'

type SavedReport = {
  body: string
  reportId?: string
}

type ChatbotSnapshot = {
  question: string
  response: string
  mode: string
}

const categories = [
  [
    'INCORRECT_INFORMATION',
    'Incorrect information',
  ],
  [
    'OUTDATED_INFORMATION',
    'Outdated information',
  ],
  [
    'SAFETY_CONCERN',
    'Safety concern',
  ],
  [
    'CONTACT_DETAILS',
    'Incorrect contact details',
  ],
  [
    'OTHER',
    'Other',
  ],
] as const

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function ReportIssue() {
  const [params] =
    useSearchParams()

  const targetType =
    params.get('type') ?? ''

  const targetId =
    params.get('id') ?? ''

  return (
    <ReportForm
      key={`${targetType}:${targetId}`}
      targetType={targetType}
      targetId={targetId}
    />
  )
}

function ReportForm({
  targetType,
  targetId,
}: {
  targetType: string
  targetId: string
}) {
  const [
    category,
    setCategory,
  ] = useState(
    'INCORRECT_INFORMATION',
  )

  const [
    details,
    setDetails,
  ] = useState('')

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    saving,
    setSaving,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState('')

  const [
    needsLogin,
    setNeedsLogin,
  ] = useState(false)

  const [
    storageKey,
    setStorageKey,
  ] = useState('')

  const [
    saved,
    setSaved,
  ] = useState<
    SavedReport | null
  >(null)

  const [
    chatbotSnapshot,
    setChatbotSnapshot,
  ] = useState<
    ChatbotSnapshot | null
  >(null)

  const inFlight =
    useRef(false)

  const validTargetType =
    [
      'ARTICLE',
      'VET',
      'AMBULANCE',
      'CHATBOT',
    ].includes(targetType)

  const validTarget =
    validTargetType &&
    uuidPattern.test(targetId)

  const isChatbot =
    targetType === 'CHATBOT'

  useEffect(() => {
    const controller =
      new AbortController()

    async function load() {
      try {
        setError('')
        setNeedsLogin(false)

        if (!validTarget) {
          throw new Error(
            'Invalid report link. Open Report an issue from an article, provider listing, or chatbot response.',
          )
        }

        let loadedSnapshot:
          ChatbotSnapshot | null =
          null

        if (isChatbot) {
          const snapshotKey =
            `chatbot-report-target:${targetId}`

          const raw =
            sessionStorage.getItem(
              snapshotKey,
            )

          if (!raw) {
            throw new Error(
              'The chatbot response is no longer available for reporting. Return to the chatbot and choose Report this response again.',
            )
          }

          let parsed: unknown

          try {
            parsed =
              JSON.parse(raw)
          } catch {
            throw new Error(
              'The saved chatbot response could not be read.',
            )
          }

          if (
            !parsed ||
            typeof parsed !==
              'object'
          ) {
            throw new Error(
              'The saved chatbot response is invalid.',
            )
          }

          const snapshot =
            parsed as Record<
              string,
              unknown
            >

          if (
            typeof snapshot.question !==
              'string' ||
            snapshot.question
              .trim()
              .length < 3 ||
            snapshot.question.length >
              500 ||
            typeof snapshot.response !==
              'string' ||
            snapshot.response
              .trim()
              .length < 1 ||
            snapshot.response.length >
              2000 ||
            typeof snapshot.mode !==
              'string' ||
            snapshot.mode
              .trim()
              .length < 1 ||
            snapshot.mode.length > 50
          ) {
            throw new Error(
              'The saved chatbot response is incomplete or invalid.',
            )
          }

          loadedSnapshot = {
            question:
              snapshot.question.trim(),

            response:
              snapshot.response.trim(),

            mode:
              snapshot.mode.trim(),
          }

          setChatbotSnapshot(
            loadedSnapshot,
          )
        }

        const response =
          await fetch(
            '/api/auth/me',
            {
              credentials:
                'same-origin',

              cache: 'no-store',

              signal:
                controller.signal,
            },
          )

        const result =
          await response
            .json()
            .catch(() => null)

        if (
          controller.signal.aborted
        ) {
          return
        }

        if (
          response.status === 401
        ) {
          setNeedsLogin(true)
        }

        if (!response.ok) {
          throw new Error(
            result?.message ??
              'Please sign in.',
          )
        }

        if (
          typeof result?.user?.id !==
          'string'
        ) {
          throw new Error(
            'Unexpected account response.',
          )
        }

        const key =
          `issue-report:${result.user.id}:${targetType}:${targetId}`

        const stored =
          sessionStorage.getItem(
            key,
          )

        if (stored) {
          let restored:
            SavedReport

          try {
            restored =
              JSON.parse(
                stored,
              ) as SavedReport
          } catch {
            throw new Error(
              'Could not read the saved report.',
            )
          }

          if (
            typeof restored.body !==
              'string'
          ) {
            throw new Error(
              'Could not read the saved report.',
            )
          }

          let body: Record<
            string,
            unknown
          >

          try {
            body =
              JSON.parse(
                restored.body,
              ) as Record<
                string,
                unknown
              >
          } catch {
            throw new Error(
              'The saved report is invalid.',
            )
          }

          if (
            body.targetType !==
              targetType ||
            body.targetId !==
              targetId ||
            typeof body.idempotencyKey !==
              'string' ||
            (
              restored.reportId !==
                undefined &&
              typeof restored.reportId !==
                'string'
            )
          ) {
            throw new Error(
              'The saved report does not match this page.',
            )
          }

          if (
            isChatbot &&
            (
              typeof body.chatbotQuestion !==
                'string' ||
              typeof body.chatbotResponse !==
                'string' ||
              typeof body.chatbotMode !==
                'string'
            )
          ) {
            throw new Error(
              'The saved chatbot report is incomplete.',
            )
          }

          setSaved(restored)
        }

        setStorageKey(key)
      } catch (loadError) {
        if (
          !controller.signal.aborted
        ) {
          setError(
            loadError instanceof
              Error
              ? loadError.message
              : 'Could not open the report form.',
          )
        }
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setLoading(false)
        }
      }
    }

    void load()

    return () =>
      controller.abort()
  }, [
    targetType,
    targetId,
    validTarget,
    isChatbot,
  ])

  async function submit() {
    if (
      inFlight.current ||
      !storageKey ||
      !validTarget ||
      saved?.reportId
    ) {
      return
    }

    let submission = saved

    const wasUncertain =
      submission !== null

    if (!submission) {
      if (
        details.trim().length <
          10 ||
        details.length > 2000
      ) {
        setError(
          'Describe the issue using 10–2000 characters.',
        )
        return
      }

      if (
        isChatbot &&
        !chatbotSnapshot
      ) {
        setError(
          'The chatbot response is no longer available. Return to the chatbot and report the response again.',
        )
        return
      }

      const requestBody: {
        targetType: string
        targetId: string
        category: string
        details: string
        idempotencyKey: string
        chatbotQuestion?: string
        chatbotResponse?: string
        chatbotMode?: string
      } = {
        targetType,

        targetId,

        category,

        details:
          details.trim(),

        idempotencyKey:
          crypto.randomUUID(),
      }

      if (
        isChatbot &&
        chatbotSnapshot
      ) {
        requestBody.chatbotQuestion =
          chatbotSnapshot.question

        requestBody.chatbotResponse =
          chatbotSnapshot.response

        requestBody.chatbotMode =
          chatbotSnapshot.mode
      }

      submission = {
        body:
          JSON.stringify(
            requestBody,
          ),
      }

      try {
        sessionStorage.setItem(
          storageKey,
          JSON.stringify(
            submission,
          ),
        )
      } catch {
        setError(
          'Browser session storage is unavailable. No report was sent.',
        )
        return
      }

      setSaved(submission)
    }

    inFlight.current = true

    setSaving(true)
    setError('')

    try {
      const response =
        await fetch(
          '/api/issue-reports',
          {
            method: 'POST',

            credentials:
              'same-origin',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              submission.body,
          },
        )

      const result =
        await response
          .json()
          .catch(() => null)

      if (!response.ok) {
        if (
          !wasUncertain &&
          result?.retryable !==
            true &&
          [
            400,
            401,
            403,
            404,
            409,
            429,
          ].includes(
            response.status,
          ) &&
          typeof result?.message ===
            'string'
        ) {
          try {
            sessionStorage.removeItem(
              storageKey,
            )
          } catch {
            // Ignore storage failure.
          }

          setSaved(null)
        }

        if (
          response.status === 401
        ) {
          setNeedsLogin(true)
        }

        throw new Error(
          result?.message ??
            'Could not confirm submission.',
        )
      }

      if (
        typeof result?.report?.id !==
          'string'
      ) {
        throw new Error(
          'Could not verify the report result.',
        )
      }

      const confirmed:
        SavedReport = {
        body:
          submission.body,

        reportId:
          result.report.id,
      }

      setSaved(confirmed)

      try {
        sessionStorage.setItem(
          storageKey,
          JSON.stringify(
            confirmed,
          ),
        )
      } catch {
        // The report was already
        // confirmed by the server.
      }
    } catch (
      submitError
    ) {
      setError(
        submitError instanceof
          Error
          ? submitError.message
          : 'The connection was interrupted.',
      )
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  function targetTypeLabel() {
    if (
      targetType === 'ARTICLE'
    ) {
      return 'Article'
    }

    if (
      targetType === 'VET'
    ) {
      return 'Vet listing'
    }

    if (
      targetType ===
      'AMBULANCE'
    ) {
      return 'Ambulance listing'
    }

    if (
      targetType === 'CHATBOT'
    ) {
      return 'Chatbot response'
    }

    return 'Unknown'
  }

  return (
    <main className="page-width vet-editor-main">
      <Link
        className="text-link"
        to="/reports"
      >
        My reports
      </Link>

      <div className="vet-editor-heading">
        <p className="eyebrow">
          FEEDBACK AND CORRECTIONS
        </p>

        <h1>
          Report an issue
        </h1>

        <p>
          Tell administrators about
          inaccurate, outdated, unsafe,
          or misleading information.
          This form is not an emergency
          contact service.
        </p>
      </div>

      <div className="vet-editor-actions">
        {isChatbot && (
          <Link
            className="text-link"
            to="/chat"
          >
            Back to chatbot
          </Link>
        )}

        <Link
          className="text-link"
          to="/vets"
        >
          Find a vet
        </Link>

        <Link
          className="text-link"
          to="/ambulances"
        >
          Transport contacts
        </Link>
      </div>

      {loading && (
        <p role="status">
          Loading report form…
        </p>
      )}

      {error && (
        <p
          className="vet-editor-error"
          role="alert"
        >
          {error}
        </p>
      )}

      {needsLogin && (
        <p>
          <Link to="/login">
            Sign in
          </Link>
          , then return to this
          report link.
        </p>
      )}

      {!loading &&
      saved?.reportId ? (
        <section>
          <h2>
            Report received
          </h2>

          <p
            style={{
              overflowWrap:
                'anywhere',
            }}
          >
            <strong>
              Reference:
            </strong>{' '}
            {saved.reportId}
          </p>

          <p>
            An administrator can now
            review your report.
          </p>

          <Link
            className="button dark-button"
            to="/reports"
          >
            Track my report
          </Link>
        </section>
      ) : !loading &&
        saved ? (
        <section>
          <h2>
            {saving
              ? 'Submitting…'
              : 'Check submission result'}
          </h2>

          <p>
            Your original submission
            is saved in this browser
            tab. Retry the same report
            to check its result without
            creating a duplicate.
          </p>

          <button
            className="button dark-button"
            type="button"
            disabled={
              saving ||
              needsLogin
            }
            onClick={() =>
              void submit()
            }
          >
            {saving
              ? 'Checking…'
              : 'Retry same report'}
          </button>
        </section>
      ) : !loading &&
        storageKey &&
        !needsLogin ? (
        <form
          className="vet-editor-form"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <p>
            <strong>
              Item type:
            </strong>{' '}
            {targetTypeLabel()}
          </p>

          <p
            style={{
              overflowWrap:
                'anywhere',
            }}
          >
            <strong>
              Item reference:
            </strong>{' '}
            {targetId}
          </p>

          {isChatbot &&
            chatbotSnapshot && (
              <section
                style={{
                  display: 'grid',
                  gap: '1rem',
                  padding:
                    '1rem 0',
                }}
              >
                <div>
                  <strong>
                    Question
                  </strong>

                  <p
                    style={{
                      whiteSpace:
                        'pre-wrap',
                    }}
                  >
                    {
                      chatbotSnapshot
                        .question
                    }
                  </p>
                </div>

                <div>
                  <strong>
                    Reported response
                  </strong>

                  <p
                    style={{
                      whiteSpace:
                        'pre-wrap',
                    }}
                  >
                    {
                      chatbotSnapshot
                        .response
                    }
                  </p>
                </div>

                <p>
                  <strong>
                    Response mode:
                  </strong>{' '}
                  {
                    chatbotSnapshot
                      .mode
                  }
                </p>
              </section>
            )}

          <div className="vet-editor-field">
            <label htmlFor="report-category">
              Issue category
            </label>

            <select
              id="report-category"
              value={category}
              onChange={(
                event,
              ) =>
                setCategory(
                  event.target
                    .value,
                )
              }
            >
              {categories.map(
                ([
                  value,
                  label,
                ]) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {label}
                  </option>
                ),
              )}
            </select>
          </div>

          <div className="vet-editor-field">
            <label htmlFor="report-details">
              What needs correcting?
            </label>

            <textarea
              id="report-details"
              value={details}
              onChange={(
                event,
              ) =>
                setDetails(
                  event.target
                    .value,
                )
              }
              minLength={10}
              maxLength={2000}
              rows={6}
              required
            />

            <p>
              Explain why the
              information is incorrect,
              outdated, unsafe, or
              misleading. Do not
              include passwords,
              private documents, or
              unnecessary personal
              information.
            </p>
          </div>

          <button
            className="button dark-button"
            type="submit"
            disabled={saving}
          >
            {saving
              ? 'Submitting…'
              : 'Submit report'}
          </button>
        </form>
      ) : null}
    </main>
  )
}

export default ReportIssue