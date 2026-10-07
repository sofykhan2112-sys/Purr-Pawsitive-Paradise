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
  destinationAddress: string
  destinationCity: string
  destinationState: string
  requestedPickupAt: string
  confirmedPickupAt: string | null
  enRouteAt: string | null
  arrivedAt: string | null
  completedAt: string | null
  responseDueAt: string
  createdAt: string
  listing: {
    providerName: string
  }
  events: {
    action: string
    reason: string | null
    createdAt: string
  }[]
}

type RequestPage = {
  requests: TransportRequest[]
  total: number
  totalPages: number
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

function MyTransportRequests() {
  const [data, setData] = useState<RequestPage | null>(null)
  const [page, setPage] = useState(1)
  const [refresh, setRefresh] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [accessStatus, setAccessStatus] =
    useState<401 | 403 | null>(null)
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
          `/api/transport-requests?page=${page}`,
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
          setError(result?.message ?? 'Owner access is required.')
          return
        }

        if (!response.ok) {
          throw new Error(
            result?.message ?? 'Could not load your transport requests.',
          )
        }

        if (
          !Array.isArray(result?.requests) ||
          !Number.isInteger(result.total) ||
          result.total < 0 ||
          !Number.isInteger(result.totalPages) ||
          result.totalPages < 0
        ) {
          throw new Error('Unexpected requests response.')
        }

        const lastPage = Math.max(1, result.totalPages)

        if (page > lastPage) {
          setPage(lastPage)
          return
        }

        setClock(Date.now())
        setData(result)
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(
            error instanceof Error
              ? error.message
              : 'Could not load your transport requests.',
          )
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [page, refresh])

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

  async function cancelRequest(request: TransportRequest) {
    if (actionInFlight.current) return

    const enteredReason = window.prompt(
      `Cancel transport for ${request.petName} with ${request.listing.providerName}?\nEnter a reason of 5–1000 characters.`,
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
        `/api/transport-requests/${encodeURIComponent(request.id)}/cancel`,
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
        throw new Error(result?.message ?? 'Could not cancel the request.')
      }

      if (
        result?.request?.id !== request.id ||
        result.request.version !== request.version + 1 ||
        !['CANCELLED', 'EXPIRED'].includes(result.request.status)
      ) {
        throw new Error('Could not verify the result.')
      }

      setActionMessage(
        result.request.status === 'EXPIRED'
          ? 'The response deadline had passed. The request is now expired.'
          : 'Transport request cancelled.',
      )
    } catch (error) {
      setActionMessage(
        `${
          error instanceof Error
            ? error.message
            : 'The result is uncertain.'
        } Check the refreshed list before trying again.`,
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
      <Link className="text-link" to="/account">
        Back to my account
      </Link>

      <div className="vet-editor-heading">
        <p className="eyebrow">MY TRANSPORT</p>
        <h1>My transport requests</h1>
        <p>
          All times are shown in India Standard Time (IST).
          Refresh to check for provider responses.
        </p>
      </div>

      <div className="vet-editor-actions">
        <button
          className="button dark-button"
          type="button"
          disabled={loading || busyId !== null}
          onClick={() => setRefresh((value) => value + 1)}
        >
          {loading ? 'Loading…' : 'Refresh requests'}
        </button>

        <Link className="text-link" to="/ambulances">
          Find transport
        </Link>
      </div>

      {actionMessage && (
        <p className="vet-editor-notice" role="status">
          {actionMessage}
        </p>
      )}

      {loading && <p role="status">Loading your requests…</p>}

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
          <p>{data.total} transport request(s).</p>

          {data.requests.length === 0 && (
            <p>You have not submitted any transport requests yet.</p>
          )}

          {data.requests.map((request) => {
            const deadline = Date.parse(request.responseDueAt)
            const deadlinePassed =
              request.status === 'REQUESTED' &&
              Number.isFinite(deadline) &&
              deadline <= clock

            const providerResponse = request.events[0]

            const confirmedPickup = request.confirmedPickupAt
            ? Date.parse(request.confirmedPickupAt)
            : NaN

          const canCancel =
            (
              request.status === 'REQUESTED' &&
              Number.isFinite(deadline) &&
              deadline > clock
            ) ||
            (
              request.status === 'ACCEPTED' &&
              Number.isFinite(confirmedPickup) &&
              confirmedPickup > clock
            )

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
                    ? 'Response deadline passed — refresh for latest status'
                    : request.status.replaceAll('_', ' ')}
                </p>

                {request.status === 'REQUESTED' && !deadlinePassed && (
                  <p>
                    Waiting for the provider’s response. A vehicle
                    and pickup are not yet confirmed.
                  </p>
                )}

                {deadlinePassed && (
                  <p>
                    The response window has ended. Refresh to check
                    whether the provider responded before the deadline.
                  </p>
                )}

                {request.status === 'ACCEPTED' && (
                  <p>
                    The provider accepted your request. This is not
                    live vehicle tracking; coordinate pickup details
                    directly with the provider.
                  </p>
                )}

               {request.status === 'EN_ROUTE' && (
                  <p>
                    The provider reports that the vehicle is travelling
                    to your pickup location. This is a manual status
                    update, not live tracking or an arrival estimate.
                  </p>
                )}

                {request.status === 'ARRIVED' && (
                  <p>
                    The provider reports arrival at your pickup location.
                    Contact the provider to coordinate collection.
                  </p>
                )}

                {['EN_ROUTE', 'ARRIVED'].includes(request.status) && (
                  <p>
                    Online cancellation is unavailable after the journey
                    starts. Contact the provider directly if arrangements
                    need to change.
                  </p>
                )}

                {request.status === 'CANCELLED' && (
                  <p>
                    This request was cancelled. Any earlier acceptance
                    and confirmed pickup time are historical.
                  </p>
                )}

               {request.status === 'COMPLETED' && (
                  <p>
                    The provider has marked this transport completed.
                  </p>
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

                {request.status === 'DECLINED' && (
                  <p>
                    The provider declined this request. No pickup
                    is arranged through this request.
                  </p>
                )}

                {request.status === 'EXPIRED' && (
                  <div>
                    <p>
                      This request expired without acceptance.
                      No pickup is arranged through this request.
                    </p>
                    <Link className="text-link" to="/ambulances">
                      Find another provider or view phone contacts
                    </Link>
                  </div>
                )}

                <p>
                  <strong>Requested pickup:</strong>{' '}
                  {formatTime(request.requestedPickupAt)} IST
                </p>

                {request.confirmedPickupAt && (
                  <p>
                    <strong>
                      {request.status === 'CANCELLED'
                        ? 'Previously confirmed pickup:'
                        : 'Confirmed pickup:'}
                    </strong>{' '}
                    {formatTime(request.confirmedPickupAt)} IST
                  </p>
                )}

                <p>
                  <strong>Response deadline:</strong>{' '}
                  {formatTime(request.responseDueAt)} IST
                </p>

                <p style={{ whiteSpace: 'pre-wrap' }}>
                  <strong>Pickup:</strong>{' '}
                  {request.pickupAddress}, {request.pickupCity},{' '}
                  {request.pickupState}
                </p>

                <p style={{ whiteSpace: 'pre-wrap' }}>
                  <strong>Destination:</strong>{' '}
                  {request.destinationAddress},{' '}
                  {request.destinationCity},{' '}
                  {request.destinationState}
                </p>

                {providerResponse && (
                  <div>
                    <p style={{ whiteSpace: 'pre-wrap' }}>
                      <strong>Provider response:</strong>{' '}
                      {providerResponse.reason || 'No note supplied.'}
                    </p>

                    <p>
                      <strong>Responded:</strong>{' '}
                      {formatTime(providerResponse.createdAt)} IST
                    </p>
                  </div>
                )}

                <p>
                  <strong>Request reference:</strong> {request.id}
                </p>
                {canCancel && (
                  <button
                    className="button dark-button"
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => void cancelRequest(request)}
                  >
                    Cancel request
                  </button>
                )}

                {busyId === request.id && (
                  <p role="status">Cancelling request…</p>
                )}

                {request.status === 'ACCEPTED' && !canCancel && (
                  <p>
                    Online cancellation is closed. Contact the
                    provider directly if arrangements need to change.
                  </p>
                )}
              </section>
            )
          })}

          {data.totalPages > 1 && (
            <nav
              className="vet-editor-actions"
              aria-label="My transport request pages"
              style={{ marginTop: '1.5rem' }}
            >
              <button
                className="button dark-button"
                type="button"
                disabled={page <= 1 || busyId !== null}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </button>

              <span>Page {page} of {data.totalPages}</span>

              <button
                className="button dark-button"
                type="button"
                disabled={page >= data.totalPages || busyId !== null}
                onClick={() => setPage((value) => value + 1)}
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

export default MyTransportRequests