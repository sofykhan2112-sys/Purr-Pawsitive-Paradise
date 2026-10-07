import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import './AdminVetEditor.css'

type Clinic = {
  id: string
  clinicName: string
  timeZone: string
  availabilityEnabled: boolean
  availabilityVersion: number
}

type Session = {
  key: string
  weekday: number
  start: string
  end: string
}

type SavedWindow = {
  weekday: number
  startMinute: number
  endMinute: number
}

const weekdays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

function formatMinutes(value: number) {
  return `${Math.floor(value / 60)
    .toString()
    .padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`
}

function parseTime(value: string) {
  if (value === '24:00') return 1440
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return NaN

  const [hours, minutes] = value.split(':').map(Number)
  return hours! * 60 + minutes!
}

function VetAvailability() {
  const [clinic, setClinic] = useState<Clinic | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [mustReload, setMustReload] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [accessStatus, setAccessStatus] =
    useState<401 | 403 | null>(null)
  const [refresh, setRefresh] = useState(0)
  const inFlight = useRef(false)

  useEffect(() => {
    const controller = new AbortController()

    async function loadSchedule() {
      setLoading(true)
      setError('')
      setMessage('')
      setAccessStatus(null)
      setClinic(null)

      try {
        const response = await fetch('/api/provider/availability', {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        })

        if (controller.signal.aborted) return

        if (response.status === 401 || response.status === 403) {
          setAccessStatus(response.status)
          return
        }

        const data = await response.json()

        if (!response.ok) {
          throw new Error(
            data.message ?? 'Could not load your schedule.',
          )
        }

        if (
          typeof data.clinic?.id !== 'string' ||
          !Number.isInteger(data.clinic.availabilityVersion) ||
          !Array.isArray(data.windows)
        ) {
          throw new Error('The server returned an unexpected response.')
        }

        if (controller.signal.aborted) return

        setClinic(data.clinic)
        setSessions(
          data.windows.map((window: SavedWindow) => ({
            key: crypto.randomUUID(),
            weekday: window.weekday,
            start: formatMinutes(window.startMinute),
            end: formatMinutes(window.endMinute),
          })),
        )
        setDirty(false)
        setMustReload(false)
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(
            error instanceof Error
              ? error.message
              : 'Could not load your schedule.',
          )
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadSchedule()
    return () => controller.abort()
  }, [refresh])

  useEffect(() => {
    if (!dirty && !saving) return

    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', warnBeforeLeaving)
    return () =>
      window.removeEventListener('beforeunload', warnBeforeLeaving)
  }, [dirty, saving])

  function markChanged() {
    setDirty(true)
    setError('')
    setMessage('')
  }

  function changeSession(
    key: string,
    field: 'start' | 'end',
    value: string,
  ) {
    setSessions((current) =>
      current.map((session) =>
        session.key === key
          ? { ...session, [field]: value }
          : session,
      ),
    )
    markChanged()
  }

  function reloadSchedule() {
    if (inFlight.current) return

    if (
      dirty &&
      !window.confirm(
        'Reload the saved schedule? This replaces your unsaved changes.',
      )
    ) {
      return
    }

    setRefresh((value) => value + 1)
  }

  async function saveSchedule() {
    if (!clinic || inFlight.current || mustReload) return

    const windows = sessions
      .map((session) => ({
        weekday: session.weekday,
        startMinute: parseTime(session.start),
        endMinute: parseTime(session.end),
      }))
      .sort(
        (a, b) =>
          a.weekday - b.weekday ||
          a.startMinute - b.startMinute,
      )

    for (let index = 0; index < windows.length; index += 1) {
      const window = windows[index]!
      const previous = windows[index - 1]

      if (
        !Number.isFinite(window.startMinute) ||
        !Number.isFinite(window.endMinute) ||
        window.startMinute >= 1440 ||
        window.endMinute - window.startMinute < 30
      ) {
        setError(
          'Each session needs valid times and must last at least 30 minutes within the same day.',
        )
        return
      }

      if (
        previous &&
        previous.weekday === window.weekday &&
        window.startMinute < previous.endMinute
      ) {
        setError(
          `${weekdays[window.weekday - 1]} has overlapping sessions.`,
        )
        return
      }
    }

    inFlight.current = true
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch(
        '/api/provider/availability/weekly',
        {
          method: 'PUT',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version: clinic.availabilityVersion,
            windows,
          }),
        },
      )

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        if (response.status === 409 || response.status >= 500) {
          setMustReload(true)
        }

        setError(
          typeof data?.message === 'string'
            ? data.message
            : 'Could not save your schedule.',
        )
        return
      }

      if (
        data?.availabilityVersion !== clinic.availabilityVersion + 1
      ) {
        setMustReload(true)
        setError(
          'Could not verify the result. Reload the saved schedule before making more changes.',
        )
        return
      }

      setClinic({
        ...clinic,
        availabilityVersion: data.availabilityVersion,
      })
      setDirty(false)
      setMessage(
        'Weekly draft schedule saved. Appointment restrictions are not active yet.',
      )
    } catch {
      setMustReload(true)
      setError(
        'The connection was interrupted. Reload the saved schedule to check whether your changes were recorded.',
      )
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }
  async function activateAvailability() {
    if (!clinic || inFlight.current || dirty || mustReload) return
  
    if (
      !window.confirm(
        'Activate your saved working hours and blocked dates? New requests, confirmations, and reschedules must fit this schedule. The current draft editors will become read-only.',
      )
    ) {
      return
    }
  
    inFlight.current = true
    setSaving(true)
    setError('')
    setMessage('')
  
    try {
      const response = await fetch(
        '/api/provider/availability/activate',
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version: clinic.availabilityVersion,
          }),
        },
      )
  
      const data = await response.json().catch(() => null)
  
      if (!response.ok) {
        setMustReload(true)
        setError(
          data?.message ??
            'Could not activate availability. Reload to check its status.',
        )
        return
      }
  
      if (
        data?.availabilityEnabled !== true ||
        data.availabilityVersion !== clinic.availabilityVersion + 1
      ) {
        setMustReload(true)
        setError('Could not verify activation. Reload to check the status.')
        return
      }
  
      setClinic({
        ...clinic,
        availabilityEnabled: true,
        availabilityVersion: data.availabilityVersion,
      })
      setMessage('Availability is active. Working hours and blocked dates are now enforced.')
    } catch {
      setMustReload(true)
      setError(
        'The connection was interrupted. Reload to check whether availability was activated.',
      )
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  const locked = saving || mustReload

  return (
    <main className="page-width vet-editor-main">
      <Link
        className="text-link"
        to="/provider/vet"
        onClick={(event) => {
          if (
            saving ||
            (dirty &&
              !window.confirm('Leave with unsaved schedule changes?'))
          ) {
            event.preventDefault()
          }
        }}
      >
        Back to vet workspace
      </Link>

      <div className="vet-editor-heading">
        <p className="eyebrow">VET AVAILABILITY</p>
        <h1>Weekly working hours</h1>
        {clinic && (
          <p>
            {clinic.clinicName} · Time zone: {clinic.timeZone}
          </p>
        )}
      </div>

      {loading && <p role="status">Loading your schedule…</p>}

      {accessStatus && (
        <div className="vet-editor-notice">
          <p>
            {accessStatus === 401
              ? 'Please sign in with your vet account.'
              : 'A vet account is required.'}
          </p>
          <Link
            className="text-link"
            to={accessStatus === 401 ? '/login' : '/account'}
          >
            {accessStatus === 401 ? 'Sign in' : 'My account'}
          </Link>
        </div>
      )}

      {error && (
        <p className="vet-editor-error" role="alert">
          {error}
        </p>
      )}

      {message && (
        <p className="vet-editor-notice" role="status">
          {message}
        </p>
      )}

      {!loading && !accessStatus && (
        <button
          className="button dark-button"
          type="button"
          disabled={saving}
          onClick={reloadSchedule}
        >
          Reload saved schedule
        </button>
      )}

      {!loading && clinic && (
        <>
          <p className="vet-editor-notice">
           {clinic.availabilityEnabled
           ? 'Availability is active. Working hours and blocked dates are enforced for new requests, confirmations, and rescheduling.'
           : 'Availability is in draft mode. Save working hours and blocked dates, then activate them to enforce restrictions.'}
          {' '}Working hours use the clinic’s time zone and 24-hour HH:MM format.
          </p>

          {mustReload && (
            <p role="alert">
              Reload the saved schedule before editing or saving again.
            </p>
          )}

         {clinic.availabilityEnabled && (
            <p>
                Changes apply immediately after saving. Changes that conflict
                with confirmed appointments or pending reschedule proposals
                will be rejected.
            </p>
          )}

{!clinic.availabilityEnabled && (
  <div style={{ margin: '1rem 0' }}>
    <button
      className="button dark-button"
      type="button"
      disabled={
        saving ||
        dirty ||
        mustReload ||
        sessions.length === 0
      }
      onClick={() => void activateAvailability()}
    >
      Activate saved availability
    </button>

    <p>
      Save changes before activating. Existing future confirmed
      appointments and pending proposals must fit the saved schedule.
    </p>
  </div>
)}

          <form
            className="vet-editor-form"
            onSubmit={(event) => {
              event.preventDefault()
              void saveSchedule()
            }}
          >
            {weekdays.map((day, index) => {
              const weekday = index + 1
              const daySessions = sessions.filter(
                (session) => session.weekday === weekday,
              )

              return (
                <fieldset
                  key={day}
                  disabled={locked}
                  style={{ padding: '1rem', margin: '0 0 1rem' }}
                >
                  <legend>{day}</legend>

                  {daySessions.length === 0 && (
                    <p>No working sessions configured.</p>
                  )}

                  {daySessions.map((session) => (
                    <div
                      key={session.key}
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'end',
                        gap: '1rem',
                        marginBottom: '1rem',
                      }}
                    >
                      <div className="vet-editor-field">
                        <label htmlFor={`start-${session.key}`}>
                          Start
                        </label>
                        <input
                          id={`start-${session.key}`}
                          type="text"
                          value={session.start}
                          placeholder="09:00"
                          maxLength={5}
                          pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
                          required
                          onChange={(event) =>
                            changeSession(
                              session.key,
                              'start',
                              event.target.value,
                            )
                          }
                        />
                      </div>

                      <div className="vet-editor-field">
                        <label htmlFor={`end-${session.key}`}>
                          End
                        </label>
                        <input
                          id={`end-${session.key}`}
                          type="text"
                          value={session.end}
                          placeholder="17:00"
                          maxLength={5}
                          pattern="(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)"
                          required
                          onChange={(event) =>
                            changeSession(
                              session.key,
                              'end',
                              event.target.value,
                            )
                          }
                        />
                      </div>

                      <button
                        className="button dark-button"
                        type="button"
                        onClick={() => {
                          setSessions((current) =>
                            current.filter(
                              (item) => item.key !== session.key,
                            ),
                          )
                          markChanged()
                        }}
                      >
                        Remove session
                      </button>
                    </div>
                  ))}

                  <button
                    className="button dark-button"
                    type="button"
                    disabled={daySessions.length >= 4}
                    onClick={() => {
                      setSessions((current) => [
                        ...current,
                        {
                          key: crypto.randomUUID(),
                          weekday,
                          start: '',
                          end: '',
                        },
                      ])
                      markChanged()
                    }}
                  >
                    Add session
                  </button>
                </fieldset>
              )
            })}

            <p>
              Add up to four sessions per day. Each must last at least
              30 minutes. Use 24:00 only as an end time for midnight.
              Split overnight hours across two days.
            </p>

            <button
              className="button dark-button"
              type="submit"
              disabled={locked || !dirty}
            >
              {saving
             ? 'Saving…'
            : clinic.availabilityEnabled
            ? 'Save blocked dates'
             : 'Save draft blocks'}
            </button>
          </form>
        </>
      )}
    </main>
  )
}

export default VetAvailability