import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import './AdminVetEditor.css'

type VetListing = {
  id: string
  clinicName: string
  status: string
  isDemo: boolean
  bookingEnabled: boolean
  timeZone: string
  verificationStatus: string
  publishedAt: string | null
  species: string[]
  updatedAt: string
  user: {
    id: string
    name: string
    role: string
    status: string
  } | null
}

function AdminVetBooking() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [vet, setVet] = useState<VetListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [accessDenied, setAccessDenied] = useState(false)
  const [retry, setRetry] = useState(0)

  const [enabled, setEnabled] = useState(false)
  const [timeZone, setTimeZone] = useState('Asia/Kolkata')
  const [reason, setReason] = useState('')
  const [operationConfirmed, setOperationConfirmed] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [needsReload, setNeedsReload] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    async function loadListing() {
      setLoading(true)
      setLoadError('')
      setAccessDenied(false)

      try {
        if (!id) {
          throw new Error('Listing ID is missing.')
        }

        const response = await fetch(
          `/api/admin/vets/${encodeURIComponent(id)}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          },
        )

        if (controller.signal.aborted) return

        if (response.status === 401) {
          navigate('/login', { replace: true })
          return
        }

        if (response.status === 403) {
          setAccessDenied(true)
          return
        }

        if (response.status === 404) {
          throw new Error('Vet listing not found.')
        }

        if (!response.ok) {
          throw new Error('Could not load booking settings.')
        }

        const data = await response.json()

        if (
          typeof data?.vet?.id !== 'string' ||
          typeof data.vet.bookingEnabled !== 'boolean' ||
          typeof data.vet.timeZone !== 'string' ||
          typeof data.vet.updatedAt !== 'string' ||
          !Array.isArray(data.vet.species)
        ) {
          throw new Error('Invalid listing response.')
        }

        if (!controller.signal.aborted) {
          setVet(data.vet)
          setEnabled(data.vet.bookingEnabled)
          setTimeZone(data.vet.timeZone)
          setReason('')
          setOperationConfirmed(false)
          setError('')
          setSuccess('')
          setNeedsReload(false)
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Could not load booking settings.',
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadListing()

    return () => controller.abort()
  }, [id, navigate, retry])

  const settingsChanged =
    vet !== null &&
    (
      enabled !== vet.bookingEnabled ||
      (enabled && timeZone.trim() !== vet.timeZone)
    )

  const dirty =
    settingsChanged ||
    reason.trim().length > 0 ||
    operationConfirmed

  useEffect(() => {
    if (!dirty) return

    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', warnBeforeLeaving)

    return () => {
      window.removeEventListener('beforeunload', warnBeforeLeaving)
    }
  }, [dirty])

  function reloadListing() {
    if (saving) return

    if (
      dirty &&
      !window.confirm('Discard unsaved booking settings and reload?')
    ) {
      return
    }

    setRetry((value) => value + 1)
  }

  async function saveSettings() {
    if (!vet || saving || needsReload || !settingsChanged) return

    const trimmedReason = reason.trim()

    if (
      trimmedReason.length < 5 ||
      trimmedReason.length > 2000
    ) {
      setError('Enter a reason containing 5–2,000 characters.')
      return
    }

    if (enabled && !operationConfirmed) {
      setError('Confirm the operating arrangement before enabling requests.')
      return
    }

    const confirmation = enabled
      ? vet.isDemo
        ? 'Enable clearly labelled demo appointment requests for this listing?'
        : 'Enable appointment requests for this provider?'
      : 'Disable new requests? Existing appointments will remain unchanged.'

    if (!window.confirm(confirmation)) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(
        `/api/admin/vets/${encodeURIComponent(vet.id)}/booking-settings`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            bookingEnabled: enabled,
            updatedAt: vet.updatedAt,
            reason: trimmedReason,
            ...(enabled
              ? {
                  timeZone: timeZone.trim(),
                  operationConfirmed,
                }
              : {}),
          }),
        },
      )

      if (response.status === 401) {
        navigate('/login', { replace: true })
        return
      }

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        if (
          response.status === 403 ||
          response.status === 404 ||
          response.status === 409 ||
          response.status >= 500
        ) {
          setNeedsReload(true)
        }

        setError(
          typeof data?.message === 'string'
            ? data.message
            : 'Could not save booking settings.',
        )
        return
      }

      if (
        data?.vet?.id !== vet.id ||
        typeof data.vet.bookingEnabled !== 'boolean' ||
        typeof data.vet.timeZone !== 'string' ||
        typeof data.vet.updatedAt !== 'string'
      ) {
        setNeedsReload(true)
        setError(
          'Could not confirm the result. Reload before trying again.',
        )
        return
      }

      const updated: VetListing = {
        ...vet,
        bookingEnabled: data.vet.bookingEnabled,
        timeZone: data.vet.timeZone,
        updatedAt: data.vet.updatedAt,
      }

      setVet(updated)
      setEnabled(updated.bookingEnabled)
      setTimeZone(updated.timeZone)
      setReason('')
      setOperationConfirmed(false)
      setSuccess(
        typeof data.message === 'string'
          ? data.message
          : 'Booking settings saved.',
      )
    } catch {
      setNeedsReload(true)
      setError(
        'Could not confirm whether the settings were saved. Reload before trying again.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="page-width vet-editor-main" role="status">
        Loading booking settings…
      </main>
    )
  }

  if (accessDenied) {
    return (
      <main className="page-width vet-editor-main">
        <h1>Administrator access required.</h1>
        <Link className="text-link" to="/account">
          Back to your account
        </Link>
      </main>
    )
  }

  if (loadError || !vet) {
    return (
      <main className="page-width vet-editor-main">
        <p className="vet-editor-error" role="alert">
          {loadError || 'Listing unavailable.'}
        </p>

        <div className="vet-editor-actions">
          <button
            className="button dark-button"
            type="button"
            onClick={reloadListing}
          >
            Try again
          </button>

          <Link className="text-link" to="/admin/vets">
            Back to vet listings
          </Link>
        </div>
      </main>
    )
  }

  const blockers: string[] = []

  if (
    vet.status !== 'PUBLISHED' ||
    !vet.publishedAt ||
    !Number.isFinite(Date.parse(vet.publishedAt)) ||
    Date.parse(vet.publishedAt) > Date.now()
  ) {
    blockers.push('The listing must be published.')
  }

  if (
    !vet.user ||
    vet.user.role !== 'VET' ||
    vet.user.status !== 'ACTIVE'
  ) {
    blockers.push('A linked active VET account is required.')
  }

  if (vet.verificationStatus === 'SUSPENDED') {
    blockers.push('The listing is suspended.')
  }

  if (!vet.isDemo && vet.verificationStatus !== 'APPROVED') {
    blockers.push('Real providers require approved verification.')
  }

  if (vet.species.length === 0) {
    blockers.push('Supported species must be recorded.')
  }

  const locked = saving || needsReload
  const cannotEnable = enabled && blockers.length > 0

  return (
    <main className="page-width vet-editor-main">
      <Link
        className="text-link"
        to="/admin/vets"
        onClick={(event) => {
          if (
            saving ||
            (dirty &&
              !window.confirm('Leave without saving booking settings?'))
          ) {
            event.preventDefault()
          }
        }}
      >
        Back to vet listings
      </Link>

      <div className="vet-editor-heading">
        <p className="eyebrow">THE PROVIDER DESK</p>
        <h1>Booking settings.</h1>
        <p>{vet.clinicName}</p>
      </div>

      <div className="vet-editor-summary">
        <p>
          <strong>Saved booking switch:</strong>{' '}
          {vet.bookingEnabled ? 'Enabled' : 'Disabled'}
        </p>

        <p>
          <strong>Listing type:</strong>{' '}
          {vet.isDemo ? 'Demo — fictional provider' : 'Real provider'}
        </p>

        <p>
          <strong>Publication:</strong>{' '}
          {vet.status.replaceAll('_', ' ').toLowerCase()}
        </p>

        <p>
          <strong>Provider account:</strong>{' '}
          {vet.user?.name ?? 'Not linked'}
        </p>
      </div>

      <p className="vet-editor-notice">
        This setting controls new appointment requests. It does not
        confirm appointments or cancel existing ones.
      </p>

      {vet.isDemo && (
        <p className="vet-editor-notice">
          Requests for this listing are demonstrations only. They
          do not arrange real veterinary care.
        </p>
      )}

      {blockers.length > 0 && (
        <div className="vet-editor-notice">
          <p>This listing is currently ineligible for new requests:</p>
          <ul>
            {blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
          <p>
            You can still disable its booking switch. Return to
            Manage vets to address publication or provider details.
          </p>
        </div>
      )}

      {success && (
        <p className="vet-editor-success" role="status">
          {success}
        </p>
      )}

      {error && (
        <div className="vet-editor-error">
          <p role="alert">{error}</p>

          {needsReload && (
            <button
              className="button dark-button"
              type="button"
              disabled={saving}
              onClick={reloadListing}
            >
              Reload latest settings
            </button>
          )}
        </div>
      )}

      <form
        className="vet-editor-form"
        aria-busy={saving}
        onSubmit={(event) => {
          event.preventDefault()
          void saveSettings()
        }}
      >
        <div className="vet-editor-field">
          <label htmlFor="booking-enabled">
            Accept new appointment requests
          </label>

          <select
            id="booking-enabled"
            value={enabled ? 'enabled' : 'disabled'}
            onChange={(event) => {
              setEnabled(event.target.value === 'enabled')
              setOperationConfirmed(false)
              setSuccess('')
            }}
            disabled={locked}
          >
            <option value="disabled">Disabled</option>
            <option value="enabled">Enabled</option>
          </select>
        </div>

        <div className="vet-editor-field">
          <label htmlFor="booking-timezone">Clinic time zone</label>

          <input
            id="booking-timezone"
            value={timeZone}
            onChange={(event) => {
              setTimeZone(event.target.value)
              setOperationConfirmed(false)
              setSuccess('')
            }}
            placeholder="Asia/Kolkata"
            maxLength={100}
            required={enabled}
            disabled={locked || !enabled}
          />

          <small>
            Use a named time zone, such as Asia/Kolkata. Once
            appointment history exists, this setting cannot change
            the clinic time zone.
          </small>
        </div>

        <div className="vet-editor-field">
          <label htmlFor="booking-reason">Reason for this change *</label>

          <textarea
            id="booking-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            minLength={5}
            maxLength={2000}
            required
            disabled={locked}
          />
        </div>

        {enabled && (
          <label className="vet-verification-confirmation">
            <input
              type="checkbox"
              checked={operationConfirmed}
              onChange={(event) =>
                setOperationConfirmed(event.target.checked)
              }
              required
              disabled={locked}
            />

            <span>
              {vet.isDemo
                ? 'I confirm this is a clearly labelled demonstration, not a real appointment service.'
                : 'I confirm the provider has agreed to receive requests and a process is in place to monitor and respond to them.'}
            </span>
          </label>
        )}

        <button
          className="button dark-button"
          type="submit"
          disabled={
            locked ||
            !settingsChanged ||
            cannotEnable ||
            (enabled && !operationConfirmed)
          }
        >
          {saving ? 'Saving…' : 'Save booking settings'}
        </button>
      </form>
    </main>
  )
}

export default AdminVetBooking