import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import './AdminVetEditor.css'

type TransportRequest = {
  id: string
  status: string
  version: number
  petName: string
  petSpecies: string
  pickupAddress: string
  pickupCity: string
  pickupState: string
  pickupPostalCode: string | null
  destinationAddress: string
  destinationCity: string
  destinationState: string
  destinationPostalCode: string | null
  contactName: string
  contactPhone: string
  notes: string | null
  requestedPickupAt: string
  confirmedPickupAt: string | null
  enRouteAt: string | null
  arrivedAt: string | null
  completedAt: string | null
  responseDueAt: string
  createdAt: string
  listing: { providerName: string }
}

type Inbox = {
  requests: TransportRequest[]
  hasMore: boolean
}

function formatTime(value: string) {
  const date = new Date(value)

  if (!Number.isFinite(date.getTime())) return 'Unknown'

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(date)
}

function AmbulanceRequests() {
  const [data, setData] = useState<Inbox | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [accessStatus, setAccessStatus] =
    useState<401 | 403 | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [clock, setClock] = useState(Date.now())
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState('')
  const actionInFlight = useRef(false)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setData(null)
      setError('')
      setAccessStatus(null)

      try {
        const response = await fetch(
          '/api/provider/ambulance/requests',
          {
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          },
        )

        const result = await response.json().catch(() => null)

        if (controller.signal.aborted) return

        if (response.status === 401 || response.status === 403) {
          setAccessStatus(response.status)
          setError(result?.message ?? 'Provider access is required.')
          return
        }

        if (!response.ok) {
          throw new Error(
            result?.message ?? 'Could not load transport requests.',
          )
        }

        if (
          !Array.isArray(result?.requests) ||
          typeof result.hasMore !== 'boolean'
        ) {
          throw new Error('Unexpected inbox response.')
        }

        setClock(Date.now())
        setData(result)
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(
            error instanceof Error
              ? error.message
              : 'Could not load transport requests.',
          )
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [refresh])

  useEffect(() => {
    function updateClock() {
      setClock(Date.now())
    }

    const interval = window.setInterval(updateClock, 10000)
    window.addEventListener('focus', updateClock)
    document.addEventListener('visibilitychange', updateClock)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', updateClock)
      document.removeEventListener('visibilitychange', updateClock)
    }
  }, [])

  async function respond(
    request: TransportRequest,
    action: 'ACCEPT' | 'DECLINE',
  ) {
    if (actionInFlight.current) return

    const deadline = Date.parse(request.responseDueAt)

    if (!Number.isFinite(deadline) || deadline <= Date.now()) {
      setClock(Date.now())
      setActionMessage(
        'The response deadline has passed. This request cannot be accepted.',
      )
      return
    }

    const enteredReason = window.prompt(
      action === 'ACCEPT'
        ? `Accept transport for ${request.petName} at ${formatTime(request.requestedPickupAt)} IST?\nConfirm you can meet the pickup and destination requirements. Enter a note of 5–1000 characters.`
        : `Decline transport for ${request.petName}? Enter a reason of 5–1000 characters.`,
    )

    if (enteredReason === null) return

    const reason = enteredReason.trim()

    if (reason.length < 5 || reason.length > 1000) {
      setActionMessage('Enter a reason of 5–1000 characters.')
      return
    }

    actionInFlight.current = true
    setBusyId(request.id)
    setActionMessage('')

    try {
      const response = await fetch(
        `/api/provider/ambulance/requests/${encodeURIComponent(request.id)}/respond`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version: request.version,
            action,
            reason,
          }),
        },
      )

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(result?.message ?? 'Could not record your response.')
      }

      const expectedStatus =
        action === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED'

      if (
        result?.request?.id !== request.id ||
        result.request.version !== request.version + 1 ||
        result.request.status !== expectedStatus
      ) {
        throw new Error('Could not verify the response.')
      }

      setActionMessage(
        action === 'ACCEPT'
          ? 'Request accepted for the original requested pickup time.'
          : 'Request declined.',
      )
    } catch (error) {
      setActionMessage(
        `${
          error instanceof Error
            ? error.message
            : 'The result is uncertain.'
        } Check the refreshed inbox before trying again.`,
      )
    } finally {
      setData(null)
      setLoading(true)
      setRefresh((value) => value + 1)
      setBusyId(null)
      actionInFlight.current = false
    }
  }

  async function updateJourney(
    request: TransportRequest,
    action: 'START_JOURNEY' | 'MARK_ARRIVED',
  ) {
    if (actionInFlight.current) return

    const enteredReason = window.prompt(
      action === 'START_JOURNEY'
        ? `Start the journey to collect ${request.petName}?\nOnly continue when the vehicle is departing for pickup. Enter a note of 5–1000 characters.`
        : `Record arrival at ${request.petName}'s pickup location?\nOnly continue when the vehicle has actually arrived. Enter a note of 5–1000 characters.`,
    )

    if (enteredReason === null) return

    const reason = enteredReason.trim()

    if (reason.length < 5 || reason.length > 1000) {
      setActionMessage('Enter a note of 5–1000 characters.')
      return
    }

    actionInFlight.current = true
    setBusyId(request.id)
    setActionMessage('')

    try {
      const response = await fetch(
        `/api/provider/ambulance/requests/${encodeURIComponent(request.id)}/journey`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version: request.version,
            action,
            reason,
          }),
        },
      )

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          result?.message ?? 'Could not update the journey.',
        )
      }

      const expectedStatus =
        action === 'START_JOURNEY' ? 'EN_ROUTE' : 'ARRIVED'

      if (
        result?.request?.id !== request.id ||
        result.request.version !== request.version + 1 ||
        result.request.status !== expectedStatus
      ) {
        throw new Error('Could not verify the result.')
      }

      setActionMessage(
        action === 'START_JOURNEY'
          ? 'Journey started. Status is now En route.'
          : 'Arrival at the pickup location recorded.',
      )
    } catch (error) {
      setActionMessage(
        `${
          error instanceof Error
            ? error.message
            : 'The result is uncertain.'
        } Check the refreshed inbox before trying again.`,
      )
    } finally {
      setData(null)
      setLoading(true)
      setRefresh((value) => value + 1)
      setBusyId(null)
      actionInFlight.current = false
    }
  }

    async function completeRequest(request: TransportRequest) {
    if (actionInFlight.current) return

    const enteredReason = window.prompt(
      `Mark transport for ${request.petName} as completed?\nOnly continue after transport is finished. Enter a completion note of 5–1000 characters.`,
    )

    if (enteredReason === null) return

    const reason = enteredReason.trim()

    if (reason.length < 5 || reason.length > 1000) {
      setActionMessage('Enter a completion note of 5–1000 characters.')
      return
    }

    actionInFlight.current = true
    setBusyId(request.id)
    setActionMessage('')

    try {
      const response = await fetch(
        `/api/provider/ambulance/requests/${encodeURIComponent(request.id)}/complete`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version: request.version,
            reason,
          }),
        },
      )

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          result?.message ?? 'Could not mark transport completed.',
        )
      }

      if (
        result?.request?.id !== request.id ||
        result.request.version !== request.version + 1 ||
        result.request.status !== 'COMPLETED'
      ) {
        throw new Error('Could not verify the result.')
      }

      setActionMessage('Transport marked completed.')
    } catch (error) {
      setActionMessage(
        `${
          error instanceof Error
            ? error.message
            : 'The result is uncertain.'
        } Check the refreshed inbox before trying again.`,
      )
    } finally {
      setData(null)
      setLoading(true)
      setRefresh((value) => value + 1)
      setBusyId(null)
      actionInFlight.current = false
    }
  }

  return (
    <main className="page-width vet-editor-main">
      <Link className="text-link" to="/provider/ambulance">
        Back to ambulance workspace
      </Link>

      <div className="vet-editor-heading">
        <p className="eyebrow">PROVIDER WORKSPACE</p>
        <h1>Transport requests</h1>
        <p>
          Requests assigned to your account, newest first.
          All times are shown in India Standard Time (IST).
        </p>
      </div>

      <button
        className="button dark-button"
        type="button"
        disabled={loading || busyId !== null}
        onClick={() => setRefresh((value) => value + 1)}
      >
        {loading ? 'Loading…' : 'Refresh requests'}
      </button>

      {actionMessage && (
        <p className="vet-editor-notice" role="status">
          {actionMessage}
        </p>
      )}

      {loading && <p role="status">Loading requests…</p>}

      {error && (
        <p className="vet-editor-error" role="alert">
          {error}
        </p>
      )}

      {accessStatus && (
        <Link
          className="text-link"
          to={accessStatus === 401 ? '/login' : '/account'}
        >
          {accessStatus === 401 ? 'Sign in' : 'My account'}
        </Link>
      )}

      {!loading && data && (
        <>
          {data.hasMore && (
            <p className="vet-editor-notice">
              Showing the latest 50 requests. Older requests remain
              stored; pagination will be added separately.
            </p>
          )}

          {data.requests.length === 0 && (
            <p>No transport requests are assigned to your account yet.</p>
          )}

          {data.requests.map((request) => {
            const deadline = Date.parse(request.responseDueAt)
            const deadlinePassed =
              request.status === 'REQUESTED' &&
              Number.isFinite(deadline) &&
              deadline <= clock

            const phone = request.contactPhone.replace(/[\s().-]/g, '')
            const callUrl = /^\+?\d{7,15}$/.test(phone)
              ? `tel:${phone}`
              : null

            return (
              <section
                key={request.id}
                style={{
                  marginTop: '1.5rem',
                  padding: '1.25rem',
                  border: '1px solid #ddd',
                  borderRadius: '12px',
                  overflowWrap: 'anywhere',
                }}
              >
                <h2>{request.petName} ({request.petSpecies})</h2>

                <p>
                  <strong>Provider:</strong>{' '}
                  {request.listing.providerName}
                </p>

                <p>
                  <strong>Status:</strong>{' '}
                  {deadlinePassed
                    ? 'Response deadline passed'
                    : request.status.replaceAll('_', ' ')}
                </p>

                {deadlinePassed && (
                  <p className="vet-editor-notice">
                    The response window has ended. Refresh to load
                    the latest status; unanswered requests are
                    automatically marked expired by the server.
                  </p>
                )}

                {request.status === 'EXPIRED' && (
                  <p>
                    This request expired without acceptance.
                    No pickup was confirmed through this request.
                  </p>
                )}

                <p>
                  <strong>Requested pickup:</strong>{' '}
                  {formatTime(request.requestedPickupAt)} IST
                </p>

                <p>
                  <strong>Response deadline:</strong>{' '}
                  {formatTime(request.responseDueAt)} IST
                </p>

                {request.confirmedPickupAt && (
                  <p>
                    <strong>Confirmed pickup:</strong>{' '}
                    {formatTime(request.confirmedPickupAt)} IST
                  </p>
                )}

                <p style={{ whiteSpace: 'pre-wrap' }}>
                  <strong>Pickup:</strong>{' '}
                  {request.pickupAddress}, {request.pickupCity},{' '}
                  {request.pickupState}
                  {request.pickupPostalCode
                    ? ` — ${request.pickupPostalCode}`
                    : ''}
                </p>

                <p style={{ whiteSpace: 'pre-wrap' }}>
                  <strong>Destination:</strong>{' '}
                  {request.destinationAddress},{' '}
                  {request.destinationCity},{' '}
                  {request.destinationState}
                  {request.destinationPostalCode
                    ? ` — ${request.destinationPostalCode}`
                    : ''}
                </p>

                <p>
                  <strong>Contact:</strong>{' '}
                  {request.contactName} — {request.contactPhone}
                </p>

                {callUrl && (
                  <p>
                    <a className="text-link" href={callUrl}>
                      Call owner
                    </a>
                  </p>
                )}

                {request.notes && (
                  <p style={{ whiteSpace: 'pre-wrap' }}>
                    <strong>Transport needs:</strong> {request.notes}
                  </p>
                )}

                <p>
                  <strong>Submitted:</strong>{' '}
                  {formatTime(request.createdAt)} IST
                </p>

                <p>
                  <strong>Request reference:</strong> {request.id}
                </p>

                {request.status === 'REQUESTED' &&
                  Number.isFinite(deadline) &&
                  !deadlinePassed && (
                    <div className="vet-editor-actions">
                      <button
                        className="button dark-button"
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => void respond(request, 'ACCEPT')}
                      >
                        Accept request
                      </button>

                      <button
                        className="button dark-button"
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => void respond(request, 'DECLINE')}
                      >
                        Decline request
                      </button>
                    </div>
                  )}

{request.status === 'ACCEPTED' && (
                  <button
                    className="button dark-button"
                    type="button"
                    disabled={busyId !== null}
                    onClick={() =>
                      void updateJourney(request, 'START_JOURNEY')
                    }
                  >
                    Start journey
                  </button>
                )}

                {request.status === 'EN_ROUTE' && (
                  <button
                    className="button dark-button"
                    type="button"
                    disabled={busyId !== null}
                    onClick={() =>
                      void updateJourney(request, 'MARK_ARRIVED')
                    }
                  >
                    Mark arrived at pickup
                  </button>
                )}

                {request.status === 'ARRIVED' && (
                  <>
                    <p>
                      Arrival at pickup is recorded. Mark completed
                      only after the transport has finished.
                    </p>
                    <button
                      className="button dark-button"
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => void completeRequest(request)}
                    >
                      Mark completed
                    </button>
                  </>
                )}

                {request.enRouteAt && (
                  <p>
                    <strong>Journey start recorded:</strong>{' '}
                    {formatTime(request.enRouteAt)} IST
                  </p>
                )}

                {request.arrivedAt && (
                  <p>
                    <strong>Arrival at pickup recorded:</strong>{' '}
                    {formatTime(request.arrivedAt)} IST
                  </p>
                )}

                {request.completedAt && (
                  <p>
                    <strong>Completion recorded:</strong>{' '}
                    {formatTime(request.completedAt)} IST
                  </p>
                )}

                {busyId === request.id && (
                  <p role="status">Saving response…</p>
                )}
              </section>
            )
          })}
        </>
      )}
    </main>
  )
}

export default AmbulanceRequests