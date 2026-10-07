import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import './AdminVetEditor.css'
type AppointmentHistoryEvent = {
  id: string
  action: string
  previousStatus: string | null
  newStatus: string
  reason: string | null
  createdAt: string
}

const historyLabels: Record<string, string> = {
  APPOINTMENT_CANCELLED_BY_PROVIDER: 'Cancelled by vet',
  APPOINTMENT_REQUESTED: 'Request submitted by owner',
  APPOINTMENT_CONFIRMED: 'Request accepted by vet',
  APPOINTMENT_DECLINED: 'Request declined by vet',
  APPOINTMENT_CANCELLED_BY_OWNER: 'Cancelled by owner',
  APPOINTMENT_COMPLETED: 'Marked completed by vet',
  APPOINTMENT_EXPIRED: 'Request expired automatically',
  APPOINTMENT_RESCHEDULE_PROPOSED: 'New time proposed by vet',
  APPOINTMENT_RESCHEDULE_ACCEPTED: 'New time accepted by owner',
  APPOINTMENT_RESCHEDULE_REJECTED: 'New time rejected by owner',
}
type Appointment = {
  id: string
  status: string
  reasonCategory: string
  reasonDetails: string | null
  contactPreference: 'EMAIL' | 'PHONE'
  contactEmail: string | null
  contactPhone: string | null
  requestedStartAt: string
  requestedEndAt: string
  confirmedStartAt: string | null
  confirmedEndAt: string | null
  proposedStartAt: string | null
  proposedEndAt: string | null
  timeZone: string
  isDemo: boolean
  version: number
  events: AppointmentHistoryEvent[]
  createdAt: string
  owner: {
    name: string
  }
  pet: {
    name: string
    species: string
    breedOrType: string | null
    ageGroup: string | null
  }
  listing: {
    clinicName: string
  }
}

type QueueResponse = {
  appointments: Appointment[]
  total: number
  page: number
  pageSize: number
  totalPages: number
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

function VetAppointments() {
  const [searchParams] = useSearchParams()
  const appointmentId = searchParams.get('appointmentId')
  const [data, setData] = useState<QueueResponse | null>(null)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('REQUESTED')
  const [refresh, setRefresh] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rescheduleId, setRescheduleId] = useState<string | null>(null)
  const [proposedTime, setProposedTime] = useState('')
  const [rescheduleReason, setRescheduleReason] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const actionInFlight = useRef(false)
  const [error, setError] = useState('')
  const [accessStatus, setAccessStatus] = useState<401 | 403 | null>(
    null,
  )

  useEffect(() => {
    const controller = new AbortController()

    async function loadQueue() {
      setLoading(true)
      setError('')
      setData(null)
      setAccessStatus(null)

      try {
        const response = await fetch(
          `/api/provider/appointments?page=${appointmentId ? 1 : page}&status=${encodeURIComponent(statusFilter)}${
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
              : 'Could not load appointment requests.',
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

        // Return to a valid page if the queue has become smaller.
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
              : 'Could not load appointment requests.',
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadQueue()

    return () => controller.abort()
  }, [page, refresh, statusFilter, appointmentId])
  async function completeAppointment(appointment: Appointment) {
    if (actionInFlight.current) return
  
    const confirmed = window.confirm(
      appointment.isDemo
        ? `Mark ${appointment.pet.name}'s DEMO appointment as completed? This only tests the workflow.`
        : `Confirm that ${appointment.pet.name}'s visit at ${appointment.listing.clinicName} actually took place and is complete. Do not use this for a missed appointment.`,
    )
  
    if (!confirmed) return
  
    actionInFlight.current = true
    setBusyId(appointment.id)
    setActionMessage('')
  
    try {
      const response = await fetch(
        `/api/provider/appointments/${encodeURIComponent(appointment.id)}/complete`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            version: appointment.version,
          }),
        },
      )
  
      const result = await response.json().catch(() => null)
  
      if (!response.ok) {
        setActionMessage(
          typeof result?.message === 'string'
            ? result.message
            : 'Could not complete the appointment. Check the refreshed list.',
        )
        return
      }
  
      if (
        result?.appointment?.id !== appointment.id ||
        result.appointment.status !== 'COMPLETED'
      ) {
        setActionMessage(
          'Could not verify the result. Check the refreshed appointment status.',
        )
        return
      }
  
      setActionMessage(
        appointment.isDemo
          ? 'Demo appointment marked completed.'
          : 'Appointment marked completed.',
      )
    } catch {
      setActionMessage(
        'The connection was interrupted, so the result is uncertain. Check the refreshed appointment status.',
      )
    } finally {
      actionInFlight.current = false
      setBusyId(null)
      setRefresh((value) => value + 1)
    }
  }
  async function proposeReschedule(appointment: Appointment) {
    if (actionInFlight.current) return
  
    const start = new Date(proposedTime)
    const reason = rescheduleReason.trim()
  
    if (
      !proposedTime ||
      !Number.isFinite(start.getTime()) ||
      start.getTime() <= Date.now() ||
      start.getTime() > Date.now() + 90 * 24 * 60 * 60 * 1000
    ) {
      setActionMessage('Choose a future time within the next 90 days.')
      return
    }
  
    if (reason.length < 5 || reason.length > 1000) {
      setActionMessage('Enter a reason of 5–1000 characters.')
      return
    }
  
    const confirmed = window.confirm(
      [
        appointment.isDemo
          ? 'Propose a new DEMO appointment time?'
          : 'Propose a new appointment time?',
        `Pet: ${appointment.pet.name}`,
        `New start: ${displayTime(start.toISOString(), appointment.timeZone)}`,
        `Clinic time zone: ${appointment.timeZone}`,
        'The original slot stays reserved until the owner accepts.',
        'The proposed time is not reserved. No automatic notification will be sent.',
      ].join('\n'),
    )
  
    if (!confirmed) return
  
    actionInFlight.current = true
    setBusyId(appointment.id)
    setActionMessage('')
  
    try {
      const response = await fetch(
        `/api/provider/appointments/${encodeURIComponent(appointment.id)}/propose-reschedule`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version: appointment.version,
            proposedStartAt: start.toISOString(),
            reason,
          }),
        },
      )
  
      const result = await response.json().catch(() => null)
  
      if (!response.ok) {
        setActionMessage(
          typeof result?.message === 'string'
            ? result.message
            : 'Could not propose a new time. Check the refreshed list.',
        )
        return
      }
  
      if (
        result?.appointment?.id !== appointment.id ||
        result.appointment.status !== 'RESCHEDULE_PROPOSED'
      ) {
        setActionMessage(
          'Could not verify the result. Check the refreshed appointment status.',
        )
        return
      }
  
      setActionMessage(
        'New time proposed. The owner must accept it. No automatic notification was sent.',
      )
      setRescheduleId(null)
      setProposedTime('')
      setRescheduleReason('')
    } catch {
      setActionMessage(
        'The connection was interrupted. Check the Reschedule proposed filter before submitting again.',
      )
    } finally {
      actionInFlight.current = false
      setBusyId(null)
      setRefresh((value) => value + 1)
    }
  }
  async function cancelByVet(appointment: Appointment) {
    if (actionInFlight.current) return
  
    const enteredReason = window.prompt(
      [
        `Cancel ${appointment.pet.name}'s appointment?`,
        'This cancels the entire visit and any pending time proposal.',
        'Enter a reason of 5–1000 characters. The owner will be able to read it.',
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
        `/api/provider/appointments/${encodeURIComponent(appointment.id)}/cancel`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version: appointment.version,
            reason,
          }),
        },
      )
  
      const result = await response.json().catch(() => null)
  
      if (!response.ok) {
        throw new Error(
          result?.message ?? 'Could not cancel the appointment.',
        )
      }
  
      if (
        result?.appointment?.id !== appointment.id ||
        result.appointment.status !== 'CANCELLED'
      ) {
        throw new Error(
          'Could not verify the result. Check the refreshed appointment status.',
        )
      }
  
      setActionMessage(
        'Appointment cancelled. An in-app notification was created for the owner. No email or SMS was sent.',
      )
    } catch (error) {
      setActionMessage(
        error instanceof Error
          ? `${error.message} Check the refreshed list before trying again.`
          : 'The result is uncertain. Check the refreshed list.',
      )
    } finally {
      actionInFlight.current = false
      setBusyId(null)
      setRefresh((value) => value + 1)
    }
  }
  async function acceptRequest(appointment: Appointment) {
    if (actionInFlight.current) return
  
    const start = displayTime(
      appointment.requestedStartAt,
      appointment.timeZone,
    )
  
    const end = displayTime(
      appointment.requestedEndAt,
      appointment.timeZone,
    )
  
    const confirmed = window.confirm(
      [
        appointment.isDemo
          ? 'Confirm this DEMO appointment? No real care will be arranged.'
          : 'Confirm this appointment?',
        `Pet: ${appointment.pet.name}`,
        `Clinic: ${appointment.listing.clinicName}`,
        `Start: ${start}`,
        `End: ${end}`,
        `Time zone: ${appointment.timeZone}`,
        'No automatic email or SMS will be sent.',
      ].join('\n'),
    )
  
    if (!confirmed) return
  
    actionInFlight.current = true
    setBusyId(appointment.id)
    setActionMessage('')
  
    try {
      const response = await fetch(
        `/api/provider/appointments/${encodeURIComponent(appointment.id)}/accept`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            version: appointment.version,
          }),
        },
      )
  
      const result = await response.json().catch(() => null)
  
      if (!response.ok) {
        setActionMessage(
          typeof result?.message === 'string'
            ? result.message
            : 'Could not confirm the appointment. Check the refreshed queue.',
        )
        return
      }
  
      if (
        result?.appointment?.id !== appointment.id ||
        result.appointment.status !== 'CONFIRMED'
      ) {
        setActionMessage(
          'Could not verify the result. Check appointment history before trying again.',
        )
        return
      }
  
      setActionMessage(
        appointment.isDemo
          ? 'Demo request confirmed. No real appointment has been arranged.'
          : 'Appointment confirmed. No automatic notification was sent.',
      )
    } catch {
      setActionMessage(
        'The connection was interrupted, so the result is uncertain. Check the refreshed queue and appointment history before trying again.',
      )
    } finally {
      actionInFlight.current = false
      setBusyId(null)
      setRefresh((value) => value + 1)
    }
  }
  async function declineRequest(appointment: Appointment) {
    if (actionInFlight.current) return
  
    const enteredReason = window.prompt(
      `Why are you declining the request for ${appointment.pet.name}? Enter 5–1000 characters. The reason will be saved in appointment history.`,
    )
  
    if (enteredReason === null) return
  
    const reason = enteredReason.trim()
  
    if (reason.length < 5 || reason.length > 1000) {
      setActionMessage('Enter a reason of 5–1000 characters.')
      return
    }
  
    actionInFlight.current = true
    setBusyId(appointment.id)
    setActionMessage('')
  
    try {
      const response = await fetch(
        `/api/provider/appointments/${encodeURIComponent(appointment.id)}/decline`,
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
            : 'Could not decline the request. Check the refreshed queue.',
        )
        return
      }
  
      setActionMessage(
        'Request declined. No automatic notification was sent.',
      )
    } catch {
      setActionMessage(
        'The connection was interrupted, so the result is uncertain. Check the refreshed queue before trying again.',
      )
    } finally {
      actionInFlight.current = false
      setBusyId(null)
      setRefresh((value) => value + 1)
    }
  }
  return (
    <main className="page-width vet-editor-main">
      <Link className="text-link" to="/provider/vet">
        Back to vet workspace
      </Link>

      <div className="vet-editor-heading">
        <p className="eyebrow">VET WORKSPACE</p>
        <h1>Clinic appointments</h1>
        <p>
          View requests and appointment history assigned to your account.
          Results are ordered by the originally requested time.
        </p>
      </div>
      
      {appointmentId && (
  <p className="vet-editor-notice">
    Showing one linked appointment, regardless of its status.{' '}
    <Link
      className="text-link"
      to="/provider/appointments"
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
              ? 'Please sign in with your active vet account.'
              : 'This page requires a vet account. Owner and admin accounts cannot view this queue.'}
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
  <label htmlFor="appointment-status">Show appointments</label>
  <select
    id="appointment-status"
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
    <option value="REQUESTED">Pending requests</option>
    <option value="CONFIRMED">Confirmed</option>
    <option value="DECLINED">Declined</option>
    <option value="RESCHEDULE_PROPOSED">Reschedule proposed</option>
    <option value="CANCELLED">Cancelled</option>
    <option value="COMPLETED">Completed</option>
    <option value="EXPIRED">Expired</option>
    <option value="ALL">All appointments</option>
  </select>
</div>
          <div className="vet-editor-actions">
            <button
              className="button dark-button"
              type="button"
              disabled={loading}
              onClick={() => setRefresh((value) => value + 1)}
            >
              {loading ? 'Loading…' : 'Refresh requests'}
            </button>
          </div>
          
          {actionMessage && (
           <p className="vet-editor-notice" role="status">
            {actionMessage}
            </p>
          )}
          {loading && (
            <p role="status">Loading appointment requests…</p>
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
              {data.total === 1 ? '' : 's'} in this view.
              </p>

              <p className="vet-editor-notice">
              Requests are not confirmed until you accept them.
              Acceptance confirms the requested time. Automatic email
              and SMS notifications are not enabled yet.
              </p>

              {data.appointments.length === 0 ? (
                <div className="vet-editor-summary">
                  <h2>No appointments in this view.</h2>
                   <p>
                    Choose another status or refresh to check for updates.
                   </p>
                </div>
              ) : (
                data.appointments.map((appointment) => (
                  <article
                    className="vet-editor-summary"
                    key={appointment.id}
                    style={{ marginBottom: '1.5rem' }}
                  >
                    <p className="eyebrow">
                      {appointment.isDemo
                        ? 'DEMO REQUEST'
                        : 'APPOINTMENT REQUEST'}
                    </p>

                    <h2>
                      {appointment.pet.name} —{' '}
                      {appointment.listing.clinicName}
                    </h2>

                    {appointment.isDemo && (
                      <p className="vet-editor-notice">
                        Demonstration only. No real veterinary
                        appointment has been arranged.
                      </p>
                    )}

                    <p>
                      <strong>Status:</strong>{' '}
                      {appointment.status.replaceAll('_', ' ')}
                    </p>

                    <p>
                      <strong>Owner:</strong>{' '}
                      {appointment.owner.name}
                    </p>

                    <p>
                      <strong>Species:</strong>{' '}
                      {appointment.pet.species}
                    </p>

                    {appointment.pet.breedOrType && (
                      <p>
                        <strong>Breed/type:</strong>{' '}
                        {appointment.pet.breedOrType}
                      </p>
                    )}

                    {appointment.pet.ageGroup && (
                      <p>
                        <strong>Age group:</strong>{' '}
                        {appointment.pet.ageGroup}
                      </p>
                    )}

                    <p>
                      <strong>Requested start:</strong>{' '}
                      {displayTime(
                        appointment.requestedStartAt,
                        appointment.timeZone,
                      )}
                    </p>

                    <p>
                      <strong>Requested end:</strong>{' '}
                      {displayTime(
                        appointment.requestedEndAt,
                        appointment.timeZone,
                      )}
                    </p>
                     
                    {(
                      appointment.status === 'CONFIRMED' ||
                      appointment.status === 'COMPLETED' ||
                      appointment.status === 'RESCHEDULE_PROPOSED'
                    ) &&
                      appointment.confirmedStartAt &&
                     appointment.confirmedEndAt && (
                   <div className="vet-editor-notice">
                   <p>
                    <strong>Confirmed start:</strong>{' '}
                     {displayTime(
                       appointment.confirmedStartAt,
                        appointment.timeZone,
                      )}
                   </p>
                 <p>
                  <strong>Confirmed end:</strong>{' '}
                     {displayTime(
                     appointment.confirmedEndAt,
                      appointment.timeZone,
                   )}
                </p>
              </div>
               )}
                    <p>
                      <strong>Time zone:</strong>{' '}
                      {appointment.timeZone}
                    </p>

                    {appointment.status === 'REQUESTED' &&
                     Date.parse(appointment.requestedStartAt) <= Date.now() && (
                      <p className="vet-editor-notice">
                        The requested start time has passed. This
                        request has not been automatically expired.
                      </p>
                    )}

                    <p>
                      <strong>Reason:</strong>{' '}
                      {appointment.reasonCategory.replaceAll('_', ' ')}
                    </p>

                    {appointment.reasonDetails && (
                      <p style={{ whiteSpace: 'pre-wrap' }}>
                        <strong>Details:</strong>{' '}
                        {appointment.reasonDetails}
                      </p>
                    )}

                    <p>
                      <strong>Preferred contact:</strong>{' '}
                      {appointment.contactPreference}
                    </p>

                    <p style={{ overflowWrap: 'anywhere' }}>
                      <strong>Contact details:</strong>{' '}
                      {appointment.contactPreference === 'EMAIL'
                        ? appointment.contactEmail || 'Not provided'
                        : appointment.contactPhone || 'Not provided'}
                    </p>

                    <p>
                      <strong>Submitted:</strong>{' '}
                      {displayTime(
                        appointment.createdAt,
                        appointment.timeZone,
                      )}
                    </p>

                    <p style={{ overflowWrap: 'anywhere' }}>
                  <strong>Reference:</strong> {appointment.id}
                   </p>

                   {(
  appointment.status === 'CONFIRMED' ||
  appointment.status === 'RESCHEDULE_PROPOSED'
) &&
  appointment.confirmedStartAt &&
  Date.parse(appointment.confirmedStartAt) > Date.now() && (
    <div style={{ margin: '1rem 0' }}>
      <button
        className="button dark-button"
        type="button"
        disabled={busyId !== null}
        onClick={() => void cancelByVet(appointment)}
      >
        {busyId === appointment.id
          ? 'Saving…'
          : 'Cancel appointment'}
      </button>
    </div>
  )}

                   <details style={{ margin: '1rem 0' }}>
  <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
    Appointment history
  </summary>

  <p>
    Latest 20 updates, newest first.
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
              ? `${event.previousStatus.replaceAll('_', ' ')} → `
              : ''}
            {event.newStatus.replaceAll('_', ' ')}
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

{appointment.status === 'CONFIRMED' && (
  <div style={{ margin: '1rem 0' }}>
    {appointment.confirmedStartAt &&
    Date.parse(appointment.confirmedStartAt) > Date.now() ? (
      rescheduleId !== appointment.id ? (
        <button
          className="button dark-button"
          type="button"
          disabled={busyId !== null}
          onClick={() => {
            setRescheduleId(appointment.id)
            setProposedTime('')
            setRescheduleReason('')
            setActionMessage('')
          }}
        >
          Propose new time
        </button>
      ) : (
        <form
          className="vet-editor-form"
          onSubmit={(event) => {
            event.preventDefault()
            void proposeReschedule(appointment)
          }}
        >
          <div className="vet-editor-field">
            <label htmlFor={`new-time-${appointment.id}`}>
              Proposed date and time
            </label>

            <input
              id={`new-time-${appointment.id}`}
              type="datetime-local"
              value={proposedTime}
              onChange={(event) => setProposedTime(event.target.value)}
              step={60}
              required
              disabled={busyId !== null}
            />

            <small>
              Enter the time in your device’s time zone:{' '}
              {Intl.DateTimeFormat().resolvedOptions().timeZone}.
              The clinic uses {appointment.timeZone}.
            </small>

            {proposedTime &&
              Number.isFinite(new Date(proposedTime).getTime()) && (
                <p>
                  Clinic time:{' '}
                  <strong>
                    {displayTime(
                      new Date(proposedTime).toISOString(),
                      appointment.timeZone,
                    )}
                  </strong>
                </p>
              )}
          </div>

          <div className="vet-editor-field">
            <label htmlFor={`reschedule-reason-${appointment.id}`}>
              Reason for the change
            </label>

            <textarea
              id={`reschedule-reason-${appointment.id}`}
              value={rescheduleReason}
              onChange={(event) =>
                setRescheduleReason(event.target.value)
              }
              minLength={5}
              maxLength={1000}
              rows={3}
              required
              disabled={busyId !== null}
            />

            <small>
              The owner can see this reason in appointment history.
            </small>
          </div>

          <p>
            The proposed visit lasts 30 minutes. The original slot
            remains reserved until the owner accepts the change.
          </p>

          <div className="vet-editor-actions">
            <button
              className="button dark-button"
              type="submit"
              disabled={busyId !== null}
            >
              {busyId === appointment.id
                ? 'Saving…'
                : 'Send proposal'}
            </button>

            <button
              className="button dark-button"
              type="button"
              disabled={busyId !== null}
              onClick={() => setRescheduleId(null)}
            >
              Close form
            </button>
          </div>
        </form>
      )
    ) : (
      <p>
        Rescheduling is unavailable because the confirmed start
        time is missing, invalid, or has already passed.
      </p>
    )}

    <div
      className="vet-editor-actions"
      style={{ marginTop: '1rem' }}
    >
      <button
        className="button dark-button"
        type="button"
        disabled={
          busyId !== null ||
          !appointment.confirmedEndAt ||
          !Number.isFinite(Date.parse(appointment.confirmedEndAt)) ||
          Date.parse(appointment.confirmedEndAt) > Date.now()
        }
        onClick={() => void completeAppointment(appointment)}
      >
        {busyId === appointment.id ? 'Saving…' : 'Mark completed'}
      </button>

      {appointment.confirmedEndAt &&
        Date.parse(appointment.confirmedEndAt) > Date.now() && (
          <p>
            Available after the scheduled end time.
            Refresh the list when that time has passed.
          </p>
        )}
    </div>
  </div>
)}

{appointment.status === 'RESCHEDULE_PROPOSED' && (
  <div className="vet-editor-notice">
    <p>
      Awaiting the owner’s response. The original confirmed slot
      remains reserved; the proposed time is not reserved.
    </p>

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
  </div>
)}

{appointment.status === 'REQUESTED' && (
  <div className="vet-editor-actions">
    <button
      className="button dark-button"
      type="button"
      disabled={
        busyId !== null ||
        Date.parse(appointment.requestedStartAt) <= Date.now()
      }
      onClick={() => void acceptRequest(appointment)}
    >
      Accept request
    </button>

    <button
      className="button dark-button"
      type="button"
      disabled={busyId !== null}
      onClick={() => void declineRequest(appointment)}
    >
      Decline request
    </button>

    {busyId === appointment.id && (
      <span role="status">Saving response…</span>
    )}
  </div>
)}
</article>
                ))
              )}

              {data.totalPages > 1 && (
                <nav
                  className="vet-editor-actions"
                  aria-label="Appointment request pages"
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

export default VetAppointments