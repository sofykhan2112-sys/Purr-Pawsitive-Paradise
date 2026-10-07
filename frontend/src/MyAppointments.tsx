import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import './AdminVetEditor.css'

type AppointmentHistoryEvent = {
  id: string
  version: number
  action: string
  previousStatus: string | null
  newStatus: string
  reason: string | null
  createdAt: string
}

const historyLabels: Record<string, string> = {
  APPOINTMENT_EXPIRED: 'Request expired automatically',
  APPOINTMENT_RESCHEDULE_PROPOSED: 'New time proposed by vet',
  APPOINTMENT_RESCHEDULE_ACCEPTED: 'New time accepted by owner',
  APPOINTMENT_RESCHEDULE_REJECTED: 'New time rejected by owner',
  APPOINTMENT_REQUESTED: 'Request submitted',
  APPOINTMENT_CONFIRMED: 'Request accepted by vet',
  APPOINTMENT_DECLINED: 'Request declined by vet',
  APPOINTMENT_CANCELLED_BY_OWNER: 'Cancelled by owner',
  APPOINTMENT_COMPLETED: 'Marked completed by vet',
  APPOINTMENT_CANCELLED_BY_PROVIDER: 'Cancelled by vet',
}

type Appointment = {
  id: string
  status: string
  version: number
  events: AppointmentHistoryEvent[]
  reasonCategory: string
  requestedStartAt: string
  requestedEndAt: string
  responseDueAt: string | null
  confirmedStartAt: string | null
  confirmedEndAt: string | null
  proposedStartAt: string | null
  proposedEndAt: string | null
  timeZone: string
  isDemo: boolean
  createdAt: string
  pet: {
    id: string
    name: string
    species: string
  }
  listing: {
    id: string
    clinicName: string
    vetName: string
    city: string
    state: string
  }
}

type AppointmentPage = {
  appointments: Appointment[]
  total: number
  totalPages: number
}

const statusLabels: Record<string, string> = {
  REQUESTED: 'Awaiting provider response',
  CONFIRMED: 'Confirmed',
  RESCHEDULE_PROPOSED: 'Reschedule proposed',
  DECLINED: 'Declined',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
}

function displayTime(value: string, timeZone: string) {
  const date = new Date(value)

  if (!Number.isFinite(date.getTime())) {
    return 'Time unavailable'
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone,
    }).format(date)
  } catch {
    return `${date.toISOString()} (UTC)`
  }
}

function MyAppointments() {
  const [searchParams] = useSearchParams()
  const appointmentId = searchParams.get('appointmentId')
  const [data, setData] = useState<AppointmentPage | null>(null)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [refresh, setRefresh] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState('')
  const actionInFlight = useRef(false)
  const [accessStatus, setAccessStatus] =
    useState<401 | 403 | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadAppointments() {
      setLoading(true)
      setError('')
      setAccessStatus(null)
      setData(null)

      try {
        const response = await fetch(
          `/api/appointments?page=${appointmentId ? 1 : page}&status=${encodeURIComponent(statusFilter)}${
            appointmentId
              ? `&appointmentId=${encodeURIComponent(appointmentId)}`
              : ''
          }`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          },
        )

        if (controller.signal.aborted) return

        if (response.status === 401 || response.status === 403) {
          setAccessStatus(response.status)
          return
        }

        const result = await response.json()

        if (!response.ok) {
          throw new Error(
            typeof result?.message === 'string'
              ? result.message
              : 'Could not load your appointments.',
          )
        }

        if (
          !Array.isArray(result?.appointments) ||
          !Number.isInteger(result.total) ||
          result.total < 0 ||
          !Number.isInteger(result.totalPages) ||
          result.totalPages < 0
        ) {
          throw new Error('The server returned an unexpected response.')
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
              : 'Could not load your appointments.',
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadAppointments()

    return () => controller.abort()
  }, [page, refresh, appointmentId, statusFilter])
  async function respondToReschedule(
    appointment: Appointment,
    decision: 'ACCEPT' | 'REJECT',
  ) {
    if (actionInFlight.current) return
  
    const chosenTime =
      decision === 'ACCEPT'
        ? appointment.proposedStartAt
        : appointment.confirmedStartAt
  
    if (!chosenTime) {
      setActionMessage('Scheduling details are missing. Refresh appointments.')
      return
    }
  
    const confirmed = window.confirm(
      [
        appointment.isDemo ? 'DEMO appointment' : 'Appointment change',
        decision === 'ACCEPT'
          ? 'Accept the proposed time and release the original slot?'
          : 'Reject the proposal and keep the original appointment time?',
        `Time: ${displayTime(chosenTime, appointment.timeZone)}`,
        `Clinic time zone: ${appointment.timeZone}`,
        'No automatic notification will be sent.',
      ].join('\n'),
    )
  
    if (!confirmed) return
  
    actionInFlight.current = true
    setBusyId(appointment.id)
    setActionMessage('')
  
    try {
      const response = await fetch(
        `/api/appointments/${encodeURIComponent(appointment.id)}/reschedule-response`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version: appointment.version,
            decision,
          }),
        },
      )
  
      const result = await response.json().catch(() => null)
  
      if (!response.ok) {
        setActionMessage(
          typeof result?.message === 'string'
            ? result.message
            : 'Could not save your response. Check the refreshed status.',
        )
        return
      }
  
      if (
        result?.appointment?.id !== appointment.id ||
        result.appointment.status !== 'CONFIRMED'
      ) {
        setActionMessage(
          'Could not verify the result. Check your appointment history.',
        )
        return
      }
  
      setActionMessage(
        decision === 'ACCEPT'
          ? appointment.isDemo
            ? 'Demo time change accepted. No real appointment has been arranged.'
            : 'New appointment time confirmed. No automatic notification was sent.'
          : 'Proposal rejected. The original appointment time is unchanged.',
      )
    } catch {
      setActionMessage(
        'The connection was interrupted. Check the refreshed appointment status and history before trying again.',
      )
    } finally {
      actionInFlight.current = false
      setBusyId(null)
      setRefresh((value) => value + 1)
    }
  }
  async function cancelAppointment(appointment: Appointment) {
    if (actionInFlight.current) return
  
    const enteredReason = window.prompt(
      [
        `Cancel ${appointment.pet.name}'s appointment at ${appointment.listing.clinicName}?`,
        appointment.status === 'RESCHEDULE_PROPOSED'
          ? 'This cancels the entire appointment, releases the original slot, and removes the proposed time.'
          : 'This cancels the appointment or pending request.',
        'Enter a reason of 5–1000 characters. It will be saved in appointment history.',
      ].join('\n'),
    )
  
    if (enteredReason === null) return
  
    const reason = enteredReason.trim()
  
    if (reason.length < 5 || reason.length > 1000) {
      setActionMessage('Enter a cancellation reason of 5–1000 characters.')
      return
    }
  
    actionInFlight.current = true
    setBusyId(appointment.id)
    setActionMessage('')
  
    try {
      const response = await fetch(
        `/api/appointments/${encodeURIComponent(appointment.id)}/cancel`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            version: appointment.version,
            reason,
          }),
        },
      )
  
      const result = await response.json().catch(() => null)
  
      if (!response.ok) {
        setActionMessage(
          typeof result?.message === 'string'
            ? result.message
            : 'Could not cancel. Check the refreshed appointment status.',
        )
        return
      }
  
      if (
        result?.appointment?.id !== appointment.id ||
        result.appointment.status !== 'CANCELLED'
      ) {
        setActionMessage(
          'Could not verify the result. Check the refreshed appointment status.',
        )
        return
      }
  
      setActionMessage(
        appointment.isDemo
          ? 'Demo appointment cancelled.'
          : 'Appointment cancelled. No automatic notification was sent. Contact the clinic directly if needed.',
      )
    } catch {
      setActionMessage(
        'The connection was interrupted, so the result is uncertain. Check the refreshed appointment status before trying again.',
      )
    } finally {
      actionInFlight.current = false
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
        <p className="eyebrow">PET CARE</p>
        <h1>My appointments</h1>
        <p>
          View your appointment requests and their latest status.
          Newest requests appear first.
        </p>
      </div>

      {appointmentId && (
     <p className="vet-editor-notice">
      Showing the appointment linked from your notification.{' '}
     <Link
      className="text-link"
      to="/appointments"
      onClick={() => {
        setPage(1)
        setStatusFilter('ALL')
      }}
     >
      Show all appointments
    </Link>
  </p>
)}

      {accessStatus ? (
        <div className="vet-editor-notice">
          <p role="alert">
            {accessStatus === 401
              ? 'Please sign in to view your appointments.'
              : 'Sign in with an owner account to view its appointments.'}
          </p>

          <Link
            className="text-link"
            to={accessStatus === 401 ? '/login' : '/account'}
          >
            {accessStatus === 401 ? 'Sign in' : 'My account'}
          </Link>
        </div>
      ) : (
        <>
        <div className="vet-editor-field">
  <label htmlFor="owner-appointment-status">
    Show appointments
  </label>

  <select
    id="owner-appointment-status"
    value={statusFilter}
    disabled={loading || busyId !== null || !!appointmentId}
    onChange={(event) => {
      setStatusFilter(event.target.value)
      setPage(1)
      setData(null)
      setLoading(true)
      setActionMessage('')
    }}
  >
    <option value="ALL">All appointments</option>
    <option value="REQUESTED">Awaiting provider response</option>
    <option value="CONFIRMED">Confirmed</option>
    <option value="RESCHEDULE_PROPOSED">Reschedule proposed</option>
    <option value="DECLINED">Declined</option>
    <option value="CANCELLED">Cancelled</option>
    <option value="COMPLETED">Completed</option>
    <option value="EXPIRED">Expired</option>
  </select>
</div>
          <div className="vet-editor-actions">
            <button
              className="button dark-button"
              type="button"
              disabled={loading}
              onClick={() => setRefresh((value) => value + 1)}
            >
              {loading ? 'Loading…' : 'Refresh appointments'}
            </button>

            <Link className="text-link" to="/vets">
              Find a vet
            </Link>
          </div>
          
          {actionMessage && (
           <p className="vet-editor-notice" role="status">
             {actionMessage}
           </p>
          )}
          {loading && (
            <p role="status">Loading your appointments…</p>
          )}

          {error && (
            <p className="vet-editor-error" role="alert">
              {error}
            </p>
          )}

          {!loading && data && (
            <>
              <p role="status">
                {data.total} appointment
                {data.total === 1 ? '' : 's'}.
              </p>

              {data.appointments.length === 0 ? (
                <div className="vet-editor-summary">
                  <h2>
  {appointmentId
    ? 'Appointment not found.'
    : 'No appointments in this view.'}
</h2>
<p>
  {appointmentId
    ? 'This appointment is unavailable or does not belong to your account.'
    : 'Choose another status, or visit the vet directory to request an appointment.'}
</p>
                </div>
              ) : (
                data.appointments.map((appointment) => (
                  <article
                    key={appointment.id}
                    className="vet-editor-summary"
                    style={{ marginBottom: '1.5rem' }}
                  >
                    <p className="eyebrow">
                      {appointment.isDemo
                        ? 'DEMO APPOINTMENT'
                        : 'APPOINTMENT'}
                    </p>

                    <h2>{appointment.listing.clinicName}</h2>

                    <p>
                      {appointment.listing.vetName} ·{' '}
                      {appointment.listing.city},{' '}
                      {appointment.listing.state}
                    </p>

                    <p>
                      <strong>Pet:</strong>{' '}
                      {appointment.pet.name} —{' '}
                      {appointment.pet.species}
                    </p>

                    <p>
                      <strong>Status:</strong>{' '}
                      {statusLabels[appointment.status] ??
                        appointment.status.replaceAll('_', ' ')}
                    </p>

                    {appointment.isDemo && (
                      <p className="vet-editor-notice">
                        Demonstration only. Even if marked confirmed,
                        this does not arrange real veterinary care.
                      </p>
                    )}

                    {appointment.status === 'REQUESTED' && (
                       <div className="vet-editor-notice">
                    <p>
                      Your request is awaiting a provider response.
                      This time is not reserved or confirmed.
                   </p>

                  <p>
                   <strong>Response deadline:</strong>{' '}
                  {displayTime(
                    appointment.responseDueAt ?? appointment.requestedStartAt,
                   appointment.timeZone,
                )}
                 </p>

               <p>
                   Unanswered requests expire by this deadline.
                  Refresh to check the latest status.
               </p>
  </div>
)}

{appointment.status === 'EXPIRED' && (
  <p className="vet-editor-notice">
    This request expired without provider confirmation.
    No appointment was arranged. You can submit a new request
    for a suitable future time.
  </p>
)}

                    {appointment.status === 'DECLINED' && (
                      <p className="vet-editor-notice">
                        The provider declined this request.
                        No appointment is arranged for this request.
                      </p>
                    )}

                    {(
                      appointment.status === 'CONFIRMED' ||
                      appointment.status === 'COMPLETED'
                    ) && (
                      <div className="vet-editor-notice">
                        <p>
                          <strong>
                          {appointment.status === 'COMPLETED'
                           ? appointment.isDemo
                           ? 'Completed demo appointment'
                          : 'Completed appointment'
                          : appointment.isDemo
                          ? 'Demo confirmation'
                         : 'Confirmed appointment'}
                          </strong>
                        </p>

                        {appointment.confirmedStartAt &&
                        appointment.confirmedEndAt ? (
                          <>
                            <p>
                              <strong>Start:</strong>{' '}
                              {displayTime(
                                appointment.confirmedStartAt,
                                appointment.timeZone,
                              )}
                            </p>
                            <p>
                              <strong>End:</strong>{' '}
                              {displayTime(
                                appointment.confirmedEndAt,
                                appointment.timeZone,
                              )}
                            </p>
                          </>
                        ) : (
                          <p>
                            Confirmation times are unavailable.
                            Refresh to check the latest details.
                          </p>
                        )}
                      </div>
                    )}

{appointment.status === 'RESCHEDULE_PROPOSED' && (
  <div className="vet-editor-notice">
    <h3>The vet has proposed a new time</h3>

    <p>
      Your original confirmed slot stays reserved until you accept.
      The proposed time is checked again when you accept.
      Expand Appointment history below to read the vet’s reason.
    </p>

    {appointment.confirmedStartAt && (
      <p>
        <strong>Original confirmed start:</strong>{' '}
        {displayTime(
          appointment.confirmedStartAt,
          appointment.timeZone,
        )}
      </p>
    )}

    {appointment.confirmedEndAt && (
      <p>
        <strong>Original confirmed end:</strong>{' '}
        {displayTime(
          appointment.confirmedEndAt,
          appointment.timeZone,
        )}
      </p>
    )}

    {appointment.proposedStartAt && (
      <p>
        <strong>Proposed start:</strong>{' '}
        {displayTime(
          appointment.proposedStartAt,
          appointment.timeZone,
        )}
      </p>
    )}

    {appointment.proposedEndAt && (
      <p>
        <strong>Proposed end:</strong>{' '}
        {displayTime(
          appointment.proposedEndAt,
          appointment.timeZone,
        )}
      </p>
    )}

    <div className="vet-editor-actions">
      <button
        className="button dark-button"
        type="button"
        disabled={
          busyId !== null ||
          !appointment.proposedStartAt ||
          Date.parse(appointment.proposedStartAt) <= Date.now()
        }
        onClick={() =>
          void respondToReschedule(appointment, 'ACCEPT')
        }
      >
        Accept new time
      </button>

      <button
        className="button dark-button"
        type="button"
        disabled={busyId !== null}
        onClick={() =>
          void respondToReschedule(appointment, 'REJECT')
        }
      >
        Reject proposal
      </button>

      {busyId === appointment.id && (
        <span role="status">Saving response…</span>
      )}
    </div>
  </div>
)}


                    <p>
                      <strong>Originally requested start:</strong>{' '}
                      {displayTime(
                        appointment.requestedStartAt,
                        appointment.timeZone,
                      )}
                    </p>

                    <p>
                      <strong>Originally requested end:</strong>{' '}
                      {displayTime(
                        appointment.requestedEndAt,
                        appointment.timeZone,
                      )}
                    </p>

                    <p>
                      <strong>Time zone:</strong>{' '}
                      {appointment.timeZone}
                    </p>

                    <p>
                      <strong>Reason:</strong>{' '}
                      {appointment.reasonCategory.replaceAll('_', ' ')}
                    </p>

                    <p>
                      <strong>Requested on:</strong>{' '}
                      {displayTime(
                        appointment.createdAt,
                        appointment.timeZone,
                      )}
                    </p>

                    <p style={{ overflowWrap: 'anywhere' }}>
                      <strong>Reference:</strong> {appointment.id}
                    </p>
                    <details style={{ margin: '1rem 0' }}>
  <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
    Appointment history
  </summary>

  <p>
    Latest 20 updates, shown newest first.
    Times use {appointment.timeZone}.
  </p>

  {appointment.events?.length ? (
    <ol style={{ paddingLeft: '1.5rem' }}>
      {appointment.events.map((event) => (
        <li
          key={event.id}
          style={{ marginBottom: '1rem' }}
        >
          <p>
            <strong>
              {historyLabels[event.action] ??
                event.action.replaceAll('_', ' ')}
            </strong>
          </p>

          <p>
            <time dateTime={event.createdAt}>
              {displayTime(
                event.createdAt,
                appointment.timeZone,
              )}
            </time>
          </p>

          <p>
            <strong>Status:</strong>{' '}
            {event.previousStatus
              ? `${
                  statusLabels[event.previousStatus] ??
                  event.previousStatus.replaceAll('_', ' ')
                } → `
              : ''}
            {statusLabels[event.newStatus] ??
              event.newStatus.replaceAll('_', ' ')}
          </p>

          {event.reason && (
            <p
              style={{
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
              }}
            >
              <strong>Reason:</strong> {event.reason}
            </p>
          )}
        </li>
      ))}
    </ol>
  ) : (
    <p>No history entries are available.</p>
  )}
</details>
{(
  appointment.status === 'REQUESTED' ||
  (
    (
      appointment.status === 'CONFIRMED' ||
      appointment.status === 'RESCHEDULE_PROPOSED'
    ) &&
    appointment.confirmedStartAt !== null &&
    Date.parse(appointment.confirmedStartAt) > Date.now()
  )
) && (
  <div style={{ marginTop: '1rem' }}>
    {appointment.status === 'RESCHEDULE_PROPOSED' && (
      <p>
        Cancelling ends the entire appointment, releases the original
        slot, and removes the proposed time. To keep the original
        appointment instead, choose Reject proposal.
      </p>
    )}

    <button
      className="button dark-button"
      type="button"
      disabled={busyId !== null}
      onClick={() => void cancelAppointment(appointment)}
    >
      {busyId === appointment.id
        ? 'Cancelling…'
        : appointment.status === 'REQUESTED'
          ? 'Cancel request'
          : 'Cancel appointment'}
        </button>
  </div>
)}
                  </article>
                ))
              )}

              {data.totalPages > 1 && (
                <nav
                  className="vet-editor-actions"
                  aria-label="Appointment history pages"
                >
                  <button
                    className="button dark-button"
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((value) => value - 1)}
                  >
                    Previous
                  </button>

                  <span>
                    Page {page} of {data.totalPages}
                  </span>

                  <button
                    className="button dark-button"
                    type="button"
                    disabled={page >= data.totalPages}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Next
                  </button>
                </nav>
              )}
            </>
          )}
        </>
      )}
    </main>
  )
}

export default MyAppointments