import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import './AdminVetEditor.css'

type NotificationItem = {
  id: string
  readAt: string | null
  createdAt: string
  action: string
  eventStatus: string
  eventCreatedAt: string
  appointmentId: string
  isDemo: boolean
  petName: string
  clinicName: string
  destination: string
}

type NotificationPage = {
  notifications: NotificationItem[]
  total: number
  unreadCount: number
  totalPages: number
}

const titles: Record<string, string> = {
  APPOINTMENT_REQUESTED: 'New appointment request',
  APPOINTMENT_CANCELLED_BY_PROVIDER: 'Appointment cancelled by vet',
  APPOINTMENT_CONFIRMED: 'Appointment accepted',
  APPOINTMENT_DECLINED: 'Appointment declined',
  APPOINTMENT_CANCELLED_BY_OWNER: 'Appointment cancelled by owner',
  APPOINTMENT_COMPLETED: 'Appointment marked completed',
  APPOINTMENT_RESCHEDULE_PROPOSED: 'New appointment time proposed',
  APPOINTMENT_RESCHEDULE_ACCEPTED: 'New time accepted by owner',
  APPOINTMENT_RESCHEDULE_REJECTED: 'New time rejected by owner',
  APPOINTMENT_EXPIRED: 'Appointment request expired',
}

function displayTime(value: string) {
  const date = new Date(value)

  if (!Number.isFinite(date.getTime())) return 'Time unavailable'

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function Notifications() {
  const [data, setData] = useState<NotificationPage | null>(null)
  const [page, setPage] = useState(1)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [loading, setLoading] = useState(true)
  const [signInRequired, setSignInRequired] = useState(false)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const inFlight = useRef(false)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError('')
      setSignInRequired(false)
      setData(null)

      try {
        const response = await fetch(
            `/api/notifications?page=${page}&unread=${unreadOnly}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          },
        )

        if (controller.signal.aborted) return

        if (response.status === 401) {
          setSignInRequired(true)
          return
        }

        const result = await response.json()

        if (!response.ok) {
          throw new Error(
            result.message ?? 'Could not load notifications.',
          )
        }

        if (
          !Array.isArray(result.notifications) ||
          !Number.isInteger(result.total) ||
          result.total < 0 ||
          !Number.isInteger(result.unreadCount) ||
          result.unreadCount < 0 ||
          !Number.isInteger(result.totalPages) ||
          result.totalPages < 0
        ) {
          throw new Error('Unexpected notification response.')
        }

        if (controller.signal.aborted) return

        const lastPage = Math.max(1, result.totalPages)

        if (page > lastPage) {
          setPage(lastPage)
          return
        }

        setData(result)
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(
            error instanceof Error
              ? error.message
              : 'Could not load notifications.',
          )
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => controller.abort()
}, [page, refresh, unreadOnly])

  async function markAllRead() {
    if (inFlight.current || !data || data.unreadCount === 0) return
  
    inFlight.current = true
    setBusyId('all')
    setActionError('')
  
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
  
      const result = await response.json().catch(() => null)
  
      if (!response.ok) {
        throw new Error(
          result?.message ?? 'Could not mark notifications as read.',
        )
      }
  
      if (
        !Number.isSafeInteger(result?.updatedCount) ||
        result.updatedCount < 0
      ) {
        throw new Error(
          'Could not verify the result. Check the refreshed unread count.',
        )
      }
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Could not update notifications. Check after refreshing.',
      )
    } finally {
      inFlight.current = false
      setBusyId(null)
      setRefresh((value) => value + 1)
    }
  }

  async function markRead(id: string) {
    if (inFlight.current) return

    inFlight.current = true
    setBusyId(id)
    setActionError('')

    try {
      const response = await fetch(
        `/api/notifications/${encodeURIComponent(id)}/read`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
      )

      if (!response.ok) {
        const result = await response.json().catch(() => null)
        throw new Error(
          result?.message ?? 'Could not mark the notification as read.',
        )
      }
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Could not update the notification. Check after refreshing.',
      )
    } finally {
      inFlight.current = false
      setBusyId(null)
      setRefresh((value) => value + 1)
    }
  }

  return (
    <main className="page-width vet-editor-main">
      <Link className="text-link" to="/account">
        Back to my account
      </Link>

      <div className="vet-editor-heading">
        <p className="eyebrow">UPDATES</p>
        <h1>Notifications</h1>
        <p>
          Appointment updates, newest first. These describe past
          events; open your appointments to check the current status.
        </p>
      </div>
      {!signInRequired && (
  <div className="vet-editor-field">
    <label htmlFor="notification-filter">Show notifications</label>

    <select
      id="notification-filter"
      value={unreadOnly ? 'unread' : 'all'}
      disabled={loading || busyId !== null}
      onChange={(event) => {
        setUnreadOnly(event.target.value === 'unread')
        setPage(1)
        setData(null)
        setLoading(true)
        setActionError('')
      }}
    >
      <option value="all">All notifications</option>
      <option value="unread">Unread only</option>
    </select>
  </div>
)}

      {signInRequired ? (
        
        <p>
          Please <Link to="/login">sign in</Link> to view notifications.
        </p>
      ) : (
        <button
          className="button dark-button"
          type="button"
          disabled={loading || busyId !== null}
          onClick={() => {
            setActionError('')
            setRefresh((value) => value + 1)
          }}
        >
          {loading ? 'Loading…' : 'Refresh notifications'}
        </button>
      )}

      {loading && <p role="status">Loading notifications…</p>}

      {error && (
        <p className="vet-editor-error" role="alert">{error}</p>
      )}

      {actionError && (
        <p className="vet-editor-error" role="alert">{actionError}</p>
      )}

      {!loading && data && (
        <>
          <p role="status">
      {data.unreadCount} unread overall · {data.total}{' '}
      {unreadOnly ? 'in unread view' : 'total'}
         </p>
         
          <button
            className="button dark-button"
            type="button"
            disabled={busyId !== null || data.unreadCount === 0}
            onClick={() => void markAllRead()}
          >
      {busyId === 'all' ? 'Saving…' : 'Mark all as read'}
    </button> 
          <p>
            Times use your device’s time zone:{' '}
            {Intl.DateTimeFormat().resolvedOptions().timeZone}.
          </p>

          {data.notifications.length === 0 ? (
            <p>
            {unreadOnly
              ? 'You’re all caught up. No unread notifications.'
              : 'No notifications yet. New appointment actions will appear here.'}
          </p>
          ) : (
            data.notifications.map((notification) => (
              <article
                key={notification.id}
                className="vet-editor-summary"
                style={{ marginBottom: '1.5rem' }}
              >
                <p className="eyebrow">
                  {notification.readAt ? 'READ' : 'UNREAD'}
                  {notification.isDemo ? ' · DEMO' : ''}
                </p>

                <h2>
                  {titles[notification.action] ??
                    notification.action.replaceAll('_', ' ')}
                </h2>

                <p>
                  <strong>Pet:</strong> {notification.petName}
                </p>

                <p>
                  <strong>Clinic:</strong> {notification.clinicName}
                </p>

                <p>
                  <strong>Event time:</strong>{' '}
                  {displayTime(notification.eventCreatedAt)}
                </p>

                <p>
                  <strong>Status after this event:</strong>{' '}
                  {notification.eventStatus.replaceAll('_', ' ')}
                </p>

                {notification.isDemo && (
                  <p>This is a demo update, not an arrangement for real care.</p>
                )}

                <p style={{ overflowWrap: 'anywhere' }}>
                  <strong>Appointment reference:</strong>{' '}
                  {notification.appointmentId}
                </p>

                <div className="vet-editor-actions">
                  <Link
                    className="text-link"
                    to={notification.destination}
                  >
                    View appointment
                  </Link>

                  {!notification.readAt && (
                    <button
                      className="button dark-button"
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => void markRead(notification.id)}
                    >
                      {busyId === notification.id
                        ? 'Saving…'
                        : 'Mark as read'}
                    </button>
                  )}
                </div>
              </article>
            ))
          )}

          {data.totalPages > 1 && (
            <nav
              className="vet-editor-actions"
              aria-label="Notification pages"
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

export default Notifications