import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import './AdminVetEditor.css'

type Pet = {
  id: string
  name: string
  species: string
}

type BookingVet = {
  id: string
  clinicName: string
  vetName: string
  city: string
  state: string
  species: string[]
  timeZone: string
  isDemo: boolean
  availabilityEnabled: boolean
  availabilityWindows: {
  weekday: number
  startMinute: number
  endMinute: number
}[]
}
type AvailableSlot = {
  startsAt: string
  endsAt: string
}

type Receipt = {
  id: string
  status: string
  requestedStartAt: string
  requestedEndAt: string
  timeZone: string
  isDemo: boolean
}

const reasons = [
  ['GENERAL_CHECKUP', 'General checkup'],
  ['PREVENTIVE_CARE', 'Preventive care'],
  ['VACCINATION', 'Vaccination'],
  ['FOLLOW_UP', 'Follow-up'],
  ['HEALTH_CONCERN', 'Health concern'],
  ['OTHER', 'Other'],
] as const

function displayTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(value))
}

const clinicWeekdays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

function formatClinicMinute(value: number) {
  if (value === 1440) return '24:00'

  const hours = Math.floor(value / 60)
  const minutes = value % 60

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function AppointmentRequest() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [vet, setVet] = useState<BookingVet | null>(null)
  const [pets, setPets] = useState<Pet[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [accessDenied, setAccessDenied] = useState(false)
  const [retry, setRetry] = useState(0)

  const [petId, setPetId] = useState('')
  const [requestedTime, setRequestedTime] = useState('')
  const [slotDate, setSlotDate] = useState('')
  const [slots, setSlots] = useState<AvailableSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsLoaded, setSlotsLoaded] = useState(false)
  const [slotsError, setSlotsError] = useState('')
  const [slotRefresh, setSlotRefresh] = useState(0)
  const [reasonCategory, setReasonCategory] =
    useState('GENERAL_CHECKUP')
  const [reasonDetails, setReasonDetails] = useState('')
  const [contactPreference, setContactPreference] =
    useState<'EMAIL' | 'PHONE'>('EMAIL')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [demoAcknowledged, setDemoAcknowledged] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState<Receipt | null>(null)

  // Keep the exact request body for retries after uncertain results.
  const pendingBody = useRef<string | null>(null)
  const inFlight = useRef(false)

  const browserTimeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone

  useEffect(() => {
    const controller = new AbortController()

    async function loadForm() {
      setLoading(true)
      setLoadError('')
      setAccessDenied(false)
      setReceipt(null)
      setUncertain(false)
      setError('')
      setPetId('')
      setRequestedTime('')
      setSlotDate('')
      setSlots([])
      setSlotsLoaded(false)
      setSlotsError('')
      setReasonCategory('GENERAL_CHECKUP')
      setReasonDetails('')
      setContactPreference('EMAIL')
      setContactEmail('')
      setContactPhone('')
      setDemoAcknowledged(false)
      pendingBody.current = null

      try {
        if (!id) throw new Error('Provider ID is missing.')

        const accountResponse = await fetch('/api/auth/me', {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        })

        if (controller.signal.aborted) return

        if (accountResponse.status === 401) {
          navigate('/login', { replace: true })
          return
        }

        if (!accountResponse.ok) {
          throw new Error('Could not check your account.')
        }

        const account = await accountResponse.json()

        if (
          account.user?.role !== 'OWNER' ||
          account.user?.status !== 'ACTIVE'
        ) {
          if (!controller.signal.aborted) {
            setAccessDenied(true)
          }
          return
        }

        const [vetResponse, petsResponse] = await Promise.all([
          fetch(`/api/vets/${encodeURIComponent(id)}/booking`, {
            cache: 'no-store',
            signal: controller.signal,
          }),
          fetch('/api/pets', {
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          }),
        ])

        if (controller.signal.aborted) return

        if (petsResponse.status === 401) {
          navigate('/login', { replace: true })
          return
        }

        if (petsResponse.status === 403) {
          setAccessDenied(true)
          return
        }

        const [vetData, petsData] = await Promise.all([
          vetResponse.json(),
          petsResponse.json(),
        ])

        if (!vetResponse.ok) {
          throw new Error(
            vetData.message ??
              'This provider is not accepting requests.',
          )
        }

        if (
          !petsResponse.ok ||
          !Array.isArray(petsData.pets) ||
          typeof vetData.vet?.id !== 'string' ||
          !Array.isArray(vetData.vet.species) ||
          typeof vetData.vet.timeZone !== 'string'
        ) {
          throw new Error('Could not load appointment details.')
        }

        // Validate the time zone before using it for display.
        new Intl.DateTimeFormat(undefined, {
          timeZone: vetData.vet.timeZone,
        })

        if (!controller.signal.aborted) {
          setVet(vetData.vet)
          setPets(petsData.pets)
          setContactEmail(account.user.email ?? '')
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Could not load the request form.',
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadForm()

    return () => controller.abort()
  }, [id, navigate, retry])

  useEffect(() => {
    if (!uncertain && !submitting) return

    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', warnBeforeLeaving)

    return () => {
      window.removeEventListener('beforeunload', warnBeforeLeaving)
    }
  }, [uncertain, submitting])

  useEffect(() => {
    if (
      loading ||
      loadError ||
      accessDenied ||
      !vet ||
      vet.id !== id ||
      !vet.availabilityEnabled ||
      !petId ||
      !slotDate ||
      submitting ||
      uncertain ||
      receipt
    ) {
      setSlotsLoading(false)
      return
    }
  
    const controller = new AbortController()
  
    async function loadSlots() {
      setSlotsLoading(true)
      setSlotsLoaded(false)
      setSlotsError('')
      setSlots([])
      setRequestedTime('')
  
      try {
        const response = await fetch(
          `/api/vets/${encodeURIComponent(vet!.id)}/slots?petId=${encodeURIComponent(petId)}&date=${encodeURIComponent(slotDate)}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          },
        )
  
        const data = await response.json().catch(() => null)
  
        if (controller.signal.aborted) return
  
        if (!response.ok) {
          throw new Error(
            typeof data?.message === 'string'
              ? data.message
              : 'Could not load available times.',
          )
        }
  
        if (
          data?.date !== slotDate ||
          data.timeZone !== vet!.timeZone ||
          !Array.isArray(data.slots) ||
          !data.slots.every(
            (slot: AvailableSlot) =>
              slot &&
              typeof slot.startsAt === 'string' &&
              typeof slot.endsAt === 'string' &&
              Number.isFinite(Date.parse(slot.startsAt)) &&
              Number.isFinite(Date.parse(slot.endsAt)) &&
              Date.parse(slot.endsAt) - Date.parse(slot.startsAt) ===
                30 * 60 * 1000,
          )
        ) {
          throw new Error('The server returned unexpected slot details.')
        }
  
        setSlots(data.slots)
        setSlotsLoaded(true)
      } catch (error) {
        if (!controller.signal.aborted) {
          setSlotsError(
            error instanceof Error
              ? error.message
              : 'Could not load available times.',
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setSlotsLoading(false)
        }
      }
    }
  
    void loadSlots()
  
    return () => controller.abort()
  }, [
    id,
    vet,
    petId,
    slotDate,
    slotRefresh,
    loading,
    loadError,
    accessDenied,
    submitting,
    uncertain,
    receipt,
  ])

  async function submitRequest() {
    if (!vet || inFlight.current || receipt) return

    setError('')

    if (!pendingBody.current) {
      const selectedPet = pets.find((pet) => pet.id === petId)

      if (
        !selectedPet ||
        !vet.species.includes(selectedPet.species)
      ) {
        setError('Choose one of your supported pets.')
        return
      }

      if (
        vet.availabilityEnabled &&
        (
          slotsLoading ||
          !slotsLoaded ||
          !slots.some((slot) => slot.startsAt === requestedTime)
        )
      ) {
        setError('Choose an available time from the list.')
        return
      }

      const start = new Date(requestedTime)
      const now = Date.now()

      if (
        !requestedTime ||
        Number.isNaN(start.getTime()) ||
        start.getTime() <= now ||
        start.getTime() > now + 90 * 24 * 60 * 60 * 1000
      ) {
        setError('Choose a future time within the next 90 days.')
        return
      }

      if (reasonCategory === 'OTHER' && !reasonDetails.trim()) {
        setError('Briefly describe the appointment reason.')
        return
      }

      if (vet.isDemo && !demoAcknowledged) {
        setError('Confirm that this is a demo request.')
        return
      }

      const clinicTime = displayTime(
        start.toISOString(),
        vet.timeZone,
      )

      if (
        !window.confirm(
          `${vet.isDemo ? 'Send a DEMO request' : 'Request an appointment'} at ${vet.clinicName} for ${clinicTime} (${vet.timeZone})? This is not a confirmed appointment.`,
        )
      ) {
        return
      }

      pendingBody.current = JSON.stringify({
        petId,
        vetListingId: vet.id,
        requestedStartAt: start.toISOString(),
        reasonCategory,
        reasonDetails: reasonDetails.trim(),
        contactPreference,
        contactEmail:
          contactPreference === 'EMAIL'
            ? contactEmail.trim()
            : null,
        contactPhone:
          contactPreference === 'PHONE'
            ? contactPhone.trim()
            : null,
        demoAcknowledged: vet.isDemo && demoAcknowledged,
        idempotencyKey: crypto.randomUUID(),
      })
    }

    inFlight.current = true
    setSubmitting(true)

    try {
      const response = await fetch('/api/appointments', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
        body: pendingBody.current,
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        // Retain the exact payload and key when the result could be
        // uncertain, including concurrency conflicts.
        const keepRequest =
          response.status >= 500 ||
          response.status === 409 ||
          uncertain

        setUncertain(keepRequest)

        if (!keepRequest) {
          pendingBody.current = null
        }

        setError(
          typeof data?.message === 'string'
            ? data.message
            : response.status === 401
              ? 'Please sign in again in another tab, then retry.'
              : 'Could not submit the request.',
        )
        return
      }

      if (
        typeof data?.appointment?.id !== 'string' ||
        typeof data.appointment.status !== 'string' ||
        typeof data.appointment.timeZone !== 'string' ||
        !Number.isFinite(
          Date.parse(data.appointment.requestedStartAt),
        ) ||
        !Number.isFinite(
          Date.parse(data.appointment.requestedEndAt),
        )
      ) {
        setUncertain(true)
        setError(
          'Could not confirm the result. Retry the same request below.',
        )
        return
      }

      setReceipt(data.appointment)
      setUncertain(false)
      pendingBody.current = null
    } catch {
      setUncertain(true)
      setError(
        'The connection was interrupted. Keep this page open and retry the same request below.',
      )
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="page-width vet-editor-main" role="status">
        Loading appointment details…
      </main>
    )
  }

  if (accessDenied) {
    return (
      <main className="page-width vet-editor-main">
        <h1>An owner account is required.</h1>
        <p>Sign in as the owner whose pet needs the appointment.</p>
        <Link className="text-link" to="/account">
          My account
        </Link>
      </main>
    )
  }

  if (loadError || !vet) {
    return (
      <main className="page-width vet-editor-main">
        <p className="vet-editor-error" role="alert">
          {loadError || 'Provider unavailable.'}
        </p>

        <div className="vet-editor-actions">
          <button
            className="button dark-button"
            type="button"
            onClick={() => setRetry((value) => value + 1)}
          >
            Try again
          </button>

          <Link className="text-link" to="/vets">
            Back to directory
          </Link>
        </div>
      </main>
    )
  }

  if (receipt) {
    return (
      <main className="page-width vet-editor-main">
        <p className="eyebrow">
          {receipt.isDemo ? 'DEMO REQUEST' : 'APPOINTMENT REQUEST'}
        </p>

        <h1>Your request is recorded.</h1>

        <div className="vet-editor-summary">
          <p><strong>Clinic:</strong> {vet.clinicName}</p>
          <p>
            <strong>Current status:</strong>{' '}
            {receipt.status.replaceAll('_', ' ')}
          </p>
          <p>
            <strong>Requested start:</strong>{' '}
            {displayTime(receipt.requestedStartAt, receipt.timeZone)}
          </p>
          <p>
            <strong>Requested end:</strong>{' '}
            {displayTime(receipt.requestedEndAt, receipt.timeZone)}
          </p>
          <p><strong>Time zone:</strong> {receipt.timeZone}</p>
          <p><strong>Reference:</strong> {receipt.id}</p>
        </div>

        <p className="vet-editor-notice">
          {receipt.isDemo
            ? 'This is a demonstration. No real veterinary appointment has been arranged.'
            : 'A request is not a confirmed appointment. The provider must accept it. This page does not send email or SMS notifications yet.'}
        </p>

        <div className="vet-editor-actions">
          <Link className="button dark-button" to="/appointments">
             My appointments
          </Link>

          <Link className="text-link" to="/vets">
             Back to directory
          </Link>
         </div>
      </main>
    )
  }

  const supportedPets = pets.filter((pet) =>
    vet.species.includes(pet.species),
  )

  const parsedTime = new Date(requestedTime)
  const preview =
    requestedTime && Number.isFinite(parsedTime.getTime())
      ? displayTime(parsedTime.toISOString(), vet.timeZone)
      : null

  const locked = submitting || uncertain

  return (
    <main className="page-width vet-editor-main">
      <Link
        className="text-link"
        to="/vets"
        onClick={(event) => {
          if (
            submitting ||
            (uncertain &&
              !window.confirm(
                'The result is uncertain. Leaving loses this page’s retry key. Check appointment history before making a new request. Leave?',
              ))
          ) {
            event.preventDefault()
          }
        }}
      >
        Back to directory
      </Link>

      <div className="vet-editor-heading">
        <p className="eyebrow">
          {vet.isDemo ? 'DEMO APPOINTMENT REQUEST' : 'REQUEST A VISIT'}
        </p>
        <h1>{vet.clinicName}</h1>
        <p>{vet.vetName} · {vet.city}, {vet.state}</p>
      </div>

      <p className="vet-editor-notice">
        Request a 30-minute appointment up to 90 days ahead.
        The requested time is not guaranteed or reserved.
        This form is not an emergency service.
      </p>

      {vet.isDemo && (
        <p className="vet-editor-notice">
          This clinic is fictional. Submitting here only tests the
          appointment workflow.
        </p>
      )}

      {error && (
        <div className="vet-editor-error">
          <p role="alert">{error}</p>

          {uncertain && (
            <>
              <p>
                Your details are locked to keep retries identical.
                Do not create another request while the result is uncertain.
              </p>
              <button
                className="button dark-button"
                type="button"
                disabled={submitting}
                onClick={() => void submitRequest()}
              >
                {submitting ? 'Checking…' : 'Retry same request'}
              </button>
            </>
          )}
        </div>
      )}

{vet.availabilityEnabled && (
  <section
    className="vet-editor-summary"
    aria-labelledby="clinic-working-hours"
    style={{ marginBottom: '1.5rem' }}
  >
    <h2 id="clinic-working-hours">Clinic working hours</h2>

    <p>
      All hours below use the clinic’s time zone:{' '}
      <strong>{vet.timeZone}</strong>.
    </p>

    <dl>
      {clinicWeekdays.map((day, index) => {
        const windows = vet.availabilityWindows.filter(
          (window) => window.weekday === index + 1,
        )

        return (
          <div key={day} style={{ marginBottom: '0.75rem' }}>
            <dt><strong>{day}</strong></dt>
            <dd style={{ marginLeft: 0 }}>
              {windows.length === 0
                ? 'Closed'
                : windows
                    .map(
                      (window) =>
                        `${formatClinicMinute(window.startMinute)}–${formatClinicMinute(window.endMinute)}`,
                    )
                    .join(', ')}
            </dd>
          </div>
        )
      })}
    </dl>

    <p>
      Your full 30-minute appointment must fit within these hours.
      Holidays and leave may make some dates unavailable.
      Working hours do not guarantee an available slot.
    </p>

    <p>
      Choose a date and an available start time below.
      The slot picker uses the clinic’s time zone.
    </p>
  </section>
)}

      {supportedPets.length === 0 ? (
        <div className="vet-editor-notice">
          <p>
            You have no pets matching this clinic’s supported species.
            Add a suitable pet in My account, or choose another provider.
          </p>
          <Link className="text-link" to="/account">
            My account
          </Link>
        </div>
      ) : (
        <form
          className="vet-editor-form"
          aria-busy={submitting}
          onSubmit={(event) => {
            event.preventDefault()
            void submitRequest()
          }}
        >
          <div className="vet-editor-field">
            <label htmlFor="appointment-pet">Pet *</label>
            <select
              id="appointment-pet"
              value={petId}
              onChange={(event) => {
                setPetId(event.target.value)
                setRequestedTime('')
                setSlots([])
                setSlotsLoaded(false)
                setSlotsError('')
              }}
              required
              disabled={locked}
            >
              <option value="">Choose your pet</option>
              {supportedPets.map((pet) => (
                <option key={pet.id} value={pet.id}>
                  {pet.name} — {pet.species}
                </option>
              ))}
            </select>
          </div>

          {vet.availabilityEnabled ? (
  <>
    <div className="vet-editor-field">
      <label htmlFor="appointment-date">
        Appointment date *
      </label>

      <input
        id="appointment-date"
        type="date"
        value={slotDate}
        required
        disabled={locked}
        onChange={(event) => {
          setSlotDate(event.target.value)
          setRequestedTime('')
          setSlots([])
          setSlotsLoaded(false)
          setSlotsError('')
        }}
      />

      <small>
        Choose a date in the clinic’s time zone: {vet.timeZone}.
        Select your pet first to check availability.
      </small>
    </div>

    <div className="vet-editor-field">
      <label htmlFor="appointment-slot">
        Available start time *
      </label>

      <select
        id="appointment-slot"
        value={requestedTime}
        required
        disabled={
          locked ||
          slotsLoading ||
          !slotsLoaded ||
          slots.length === 0
        }
        onChange={(event) => setRequestedTime(event.target.value)}
      >
        <option value="">
          {slotsLoading ? 'Loading times…' : 'Choose a time'}
        </option>

        {slots.map((slot) => (
          <option key={slot.startsAt} value={slot.startsAt}>
            {displayTime(slot.startsAt, vet.timeZone)}
            {' · UTC '}
            {slot.startsAt.slice(11, 16)}
          </option>
        ))}
      </select>

      <small>
        Times use {vet.timeZone}. Each visit lasts 30 minutes.
        The UTC time distinguishes repeated local times during
        daylight-saving changes.
      </small>
    </div>

    {slotsLoading && <p role="status">Checking available times…</p>}

    {slotsError && (
      <p className="vet-editor-error" role="alert">
        {slotsError}
      </p>
    )}

    {slotsLoaded && slots.length === 0 && (
      <p role="status">
        No available times were found for this pet on this date.
        Choose another date.
      </p>
    )}

    {petId && slotDate && (
      <button
        className="button dark-button"
        type="button"
        disabled={locked || slotsLoading}
        onClick={() => {
          setRequestedTime('')
          setSlots([])
          setSlotsLoaded(false)
          setSlotRefresh((value) => value + 1)
        }}
      >
        Refresh available times
      </button>
    )}

    {requestedTime && (
      <p role="status">
        Selected clinic time:{' '}
        <strong>{displayTime(requestedTime, vet.timeZone)}</strong>
        {' '}({vet.timeZone})
      </p>
    )}

    <p>
      These times are not reserved. The vet must confirm your request,
      and availability will be checked again.
    </p>
  </>
) : (
  <div className="vet-editor-field">
    <label htmlFor="appointment-time">
      Requested date and time *
    </label>

    <input
      id="appointment-time"
      type="datetime-local"
      value={requestedTime}
      onChange={(event) => setRequestedTime(event.target.value)}
      step={60}
      required
      disabled={locked}
    />

    <small>
      Enter the time in your device’s time zone: {browserTimeZone}.
      The clinic uses {vet.timeZone}.
    </small>

    {preview && (
      <p role="status">
        Clinic time: <strong>{preview}</strong>
        {' '}({vet.timeZone})
      </p>
    )}
  </div>
)}

          <div className="vet-editor-field">
            <label htmlFor="appointment-reason">Reason *</label>
            <select
              id="appointment-reason"
              value={reasonCategory}
              onChange={(event) =>
                setReasonCategory(event.target.value)
              }
              disabled={locked}
            >
              {reasons.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="vet-editor-field">
            <label htmlFor="appointment-details">
              Brief details {reasonCategory === 'OTHER' ? '*' : '(optional)'}
            </label>
            <textarea
              id="appointment-details"
              value={reasonDetails}
              onChange={(event) =>
                setReasonDetails(event.target.value)
              }
              rows={3}
              maxLength={1000}
              required={reasonCategory === 'OTHER'}
              disabled={locked}
            />
          </div>

          <div className="vet-editor-field">
            <label htmlFor="appointment-contact">
              Preferred contact method *
            </label>
            <select
              id="appointment-contact"
              value={contactPreference}
              onChange={(event) =>
                setContactPreference(
                  event.target.value as 'EMAIL' | 'PHONE',
                )
              }
              disabled={locked}
            >
              <option value="EMAIL">Email</option>
              <option value="PHONE">Phone</option>
            </select>
            <small>
              Records how the provider should contact you.
              Automated messages are not enabled yet.
            </small>
          </div>

          {contactPreference === 'EMAIL' ? (
            <div className="vet-editor-field">
              <label htmlFor="appointment-email">Contact email *</label>
              <input
                id="appointment-email"
                type="email"
                value={contactEmail}
                onChange={(event) =>
                  setContactEmail(event.target.value)
                }
                maxLength={254}
                required
                disabled={locked}
              />
            </div>
          ) : (
            <div className="vet-editor-field">
              <label htmlFor="appointment-phone">Contact phone *</label>
              <input
                id="appointment-phone"
                type="tel"
                value={contactPhone}
                onChange={(event) =>
                  setContactPhone(event.target.value)
                }
                maxLength={30}
                required
                disabled={locked}
              />
            </div>
          )}

          {vet.isDemo && (
            <label className="vet-verification-confirmation">
              <input
                type="checkbox"
                checked={demoAcknowledged}
                onChange={(event) =>
                  setDemoAcknowledged(event.target.checked)
                }
                required
                disabled={locked}
              />
              <span>
                I understand this is a demo request and no real
                appointment will be arranged.
              </span>
            </label>
          )}

          <button
            className="button dark-button"
            type="submit"
            disabled={
              locked ||
              (
                vet.availabilityEnabled &&
                (
                  slotsLoading ||
                  !slotsLoaded ||
                  !slots.some((slot) => slot.startsAt === requestedTime)
                )
              )
            }
          >
            {submitting
              ? 'Submitting…'
              : vet.isDemo
                ? 'Send demo request'
                : 'Request appointment'}
          </button>
        </form>
      )}
    </main>
  )
}

export default AppointmentRequest