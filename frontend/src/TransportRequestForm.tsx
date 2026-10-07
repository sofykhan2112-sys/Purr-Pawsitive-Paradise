import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import './AdminVetEditor.css'

type Pet = {
  id: string
  name: string
  species: string
}

type Provider = {
  id: string
  providerName: string
  species: string[]
  canRequest: boolean
  animalRestrictions: string | null
  serviceAreas: { city: string; state: string }[]
}

type Receipt = {
  id: string
  status: string
  responseDueAt: string
}

type SavedSubmission = {
  body: string
  receipt?: Receipt
}

const fieldDefinitions = [
  { key: 'contactName', label: 'Contact name', min: 2, max: 100 },
  { key: 'contactPhone', label: 'Contact phone', min: 7, max: 30 },
  { key: 'pickupAddress', label: 'Pickup address', min: 5, max: 500 },
  { key: 'pickupCity', label: 'Pickup city', min: 2, max: 100 },
  { key: 'pickupState', label: 'Pickup state', min: 2, max: 100 },
  {
    key: 'pickupPostalCode',
    label: 'Pickup PIN code (optional)',
    min: 0,
    max: 6,
  },
  {
    key: 'destinationAddress',
    label: 'Destination address',
    min: 5,
    max: 500,
  },
  { key: 'destinationCity', label: 'Destination city', min: 2, max: 100 },
  { key: 'destinationState', label: 'Destination state', min: 2, max: 100 },
  {
    key: 'destinationPostalCode',
    label: 'Destination PIN code (optional)',
    min: 0,
    max: 6,
  },
] as const

function TransportRequestForm() {
  const { id } = useParams()

  // Remount if navigation changes the selected provider.
  return <RequestPage key={id} id={id} />
}

function RequestPage({ id }: { id: string | undefined }) {
  const [provider, setProvider] = useState<Provider | null>(null)
  const [pets, setPets] = useState<Pet[]>([])
  const [petId, setPetId] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})
  const [pickupTime, setPickupTime] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [accessStatus, setAccessStatus] = useState<number | null>(null)
  const [saved, setSaved] = useState<SavedSubmission | null>(null)
  const [storageKey, setStorageKey] = useState('')
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const inFlight = useRef(false)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        if (!id) throw new Error('Provider ID is missing.')

        const accountResponse = await fetch('/api/auth/me', {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        })
        const account = await accountResponse.json()

        if (controller.signal.aborted) return

        if (!accountResponse.ok) {
          setAccessStatus(accountResponse.status)
          throw new Error(account.message ?? 'Please sign in.')
        }

        if (account.user?.role !== 'OWNER') {
          setAccessStatus(403)
          throw new Error('Sign in with a pet-owner account to request transport.')
        }

        if (typeof account.user.id !== 'string') {
          throw new Error('Unexpected account response.')
        }

        const key = `transport-submission:${account.user.id}:${id}`
        setStorageKey(key)

        // Restore uncertain submissions before checking current eligibility.
        const stored = sessionStorage.getItem(key)

        if (stored) {
          const restored = JSON.parse(stored) as SavedSubmission

          if (typeof restored.body !== 'string') {
            throw new Error('Saved submission could not be read.')
          }

          const body = JSON.parse(restored.body)

          if (
            body.ambulanceListingId !== id ||
            typeof body.idempotencyKey !== 'string'
          ) {
            throw new Error('Saved submission does not match this provider.')
          }

          setSaved(restored)

          if (restored.receipt) {
            setReceipt(restored.receipt)
          }

          return
        }

        const [petResponse, providerResponse] = await Promise.all([
          fetch('/api/pets', {
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          }),
          fetch(`/api/ambulances?id=${encodeURIComponent(id)}`, {
            cache: 'no-store',
            signal: controller.signal,
          }),
        ])

        const petResult = await petResponse.json()
        const providerResult = await providerResponse.json()

        if (controller.signal.aborted) return

        if (!petResponse.ok) {
          throw new Error(petResult.message ?? 'Could not load pets.')
        }

        if (!providerResponse.ok) {
          throw new Error(
            providerResult.message ?? 'Could not load the provider.',
          )
        }

        if (
          !Array.isArray(petResult.pets) ||
          !Array.isArray(providerResult.ambulances)
        ) {
          throw new Error('Unexpected server response.')
        }

        const item = providerResult.ambulances.find(
          (candidate: Provider) => candidate.id === id,
        )

        if (!item) {
          throw new Error('This provider is no longer publicly listed.')
        }

        setProvider(item)
        setPets(petResult.pets)
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(
            error instanceof Error ? error.message : 'Could not load form.',
          )
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [id])

  async function submit() {
    if (inFlight.current || receipt || !storageKey || !id) return

    let submission = saved
    const wasUncertain = submission !== null

    if (!submission) {
      if (!provider?.canRequest) return

      const selectedPet = pets.find((pet) => pet.id === petId)

      if (!selectedPet || !provider.species.includes(selectedPet.species)) {
        setError('Choose a supported pet.')
        return
      }

      // All current service areas are in India. Make the input zone explicit.
      const pickup = new Date(`${pickupTime}:00+05:30`)
      const now = Date.now()

      if (
        !Number.isFinite(pickup.getTime()) ||
        pickup.getTime() < now + 15 * 60 * 1000 ||
        pickup.getTime() > now + 7 * 24 * 60 * 60 * 1000
      ) {
        setError('Choose a pickup time between 15 minutes and 7 days ahead.')
        return
      }

      submission = {
        body: JSON.stringify({
          ...Object.fromEntries(
            fieldDefinitions.map((field) => [
              field.key,
              (fields[field.key] ?? '').trim(),
            ]),
          ),
          ambulanceListingId: id,
          petId,
          idempotencyKey: crypto.randomUUID(),
          requestedPickupAt: pickup.toISOString(),
          notes: notes.trim(),
        }),
      }

      try {
        // Save before sending so a page reload can safely retry.
        sessionStorage.setItem(storageKey, JSON.stringify(submission))
      } catch {
        setError('Browser session storage is unavailable. No request was sent.')
        return
      }

      setSaved(submission)
    }

    inFlight.current = true
    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/transport-requests', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: submission.body,
      })

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        // Only unlock a first submission after a definite rejection.
        // An uncertain retry must retain its original key and payload.
        if (
          !wasUncertain &&
          result?.retryable !== true &&
          [400, 401, 403, 404, 409].includes(response.status) &&
          typeof result?.message === 'string'
        ) {
          sessionStorage.removeItem(storageKey)
          setSaved(null)
        }

        throw new Error(result?.message ?? 'Could not confirm submission.')
      }

      if (
        typeof result?.request?.id !== 'string' ||
        typeof result.request.status !== 'string' ||
        typeof result.request.responseDueAt !== 'string'
      ) {
        throw new Error('Could not verify the submission result.')
      }

      const confirmed: Receipt = result.request

      setReceipt(confirmed)
      setSaved({ ...submission, receipt: confirmed })

      try {
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({ ...submission, receipt: confirmed }),
        )
      } catch {
        // The original saved payload still permits an idempotent retry.
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'The connection was interrupted.',
      )
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  async function startAnotherRequest() {
    if (
      inFlight.current ||
      loading ||
      !receipt ||
      !saved ||
      !storageKey ||
      !id
    ) {
      return
    }

    inFlight.current = true
    setSaving(true)
    setError('')

    try {
      const original = JSON.parse(saved.body)

      const response = await fetch(
        `/api/transport-requests/${encodeURIComponent(receipt.id)}`,
        {
          credentials: 'same-origin',
          cache: 'no-store',
        },
      )

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          result?.message ?? 'Could not check the previous request.',
        )
      }

      const current = result?.request

      if (
        current?.id !== receipt.id ||
        current.ambulanceListingId !== id ||
        current.idempotencyKey !== original.idempotencyKey ||
        typeof current.status !== 'string' ||
        typeof current.responseDueAt !== 'string' ||
        typeof result.canStartAnother !== 'boolean'
      ) {
        throw new Error(
          'Could not verify the previous request. Its saved submission has been kept.',
        )
      }

      const updatedReceipt: Receipt = {
        id: current.id,
        status: current.status,
        responseDueAt: current.responseDueAt,
      }

      const updatedSubmission: SavedSubmission = {
        body: saved.body,
        receipt: updatedReceipt,
      }

      // Update the receipt with the latest server status.
      sessionStorage.setItem(
        storageKey,
        JSON.stringify(updatedSubmission),
      )
      setReceipt(updatedReceipt)
      setSaved(updatedSubmission)

      const terminalStatus = [
        'DECLINED',
        'EXPIRED',
        'CANCELLED',
        'COMPLETED',
      ].includes(current.status)

      if (!result.canStartAnother || !terminalStatus) {
        setError(
          `Your previous request is ${current.status.replaceAll('_', ' ')}. View My transport requests before starting another. If its response deadline just passed, wait for automatic expiry and try again.`,
        )
        return
      }

      const confirmed = window.confirm(
        `Your previous request is ${current.status.replaceAll('_', ' ')}.\n\nOpen a blank form for another request? The previous request will remain in your history.`,
      )

      if (!confirmed) return

      // Clear only this owner's saved submission for this provider.
      sessionStorage.removeItem(storageKey)

      // Reload pets and current provider eligibility through the existing effect.
      window.location.reload()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Could not prepare another request. Try again.',
      )
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  const supportedPets = pets.filter(
    (pet) => provider?.species.includes(pet.species),
  )

  return (
    <main className="page-width vet-editor-main">
      <Link className="text-link" to="/ambulances">
        Back to transport directory
      </Link>

      <div className="vet-editor-heading">
        <p className="eyebrow">ANIMAL TRANSPORT</p>
        <h1>Request transport</h1>
        {provider && <p>{provider.providerName}</p>}
      </div>

      <p className="vet-editor-notice">
        Submitting does not confirm a vehicle or pickup. The provider
        must review the request. For immediate assistance, contact
        the provider directly.
      </p>

      {loading && <p role="status">Loading request form…</p>}
      {error && <p className="vet-editor-error" role="alert">{error}</p>}

      {accessStatus && (
        <Link
          className="text-link"
          to={accessStatus === 401 ? '/login' : '/account'}
        >
          {accessStatus === 401 ? 'Sign in' : 'My account'}
        </Link>
      )}

      {receipt ? (
        <section>
          <h2>Request recorded</h2>
          <p style={{ overflowWrap: 'anywhere' }}>
            <strong>Reference:</strong> {receipt.id}
          </p>
          <p><strong>Status at last response:</strong> {receipt.status}</p>
          <p>
            <strong>Response deadline:</strong>{' '}
            {new Date(receipt.responseDueAt).toLocaleString('en-IN', {
              timeZone: 'Asia/Kolkata',
            })}{' '}IST
          </p>
          <p>
            This is a submission receipt, not a live status page.
            No additional request was created by reloading it.
          </p>
          <Link
            className="button dark-button"
            to="/transport-requests"
          >
            View my transport requests
          </Link>
          <div
            className="vet-editor-actions"
            style={{ marginTop: '1rem' }}
          >
            <button
              className="button dark-button"
              type="button"
              disabled={saving || loading}
              onClick={() => void startAnotherRequest()}
            >
              {saving ? 'Checking previous request…' : 'Start another request'}
            </button>
          </div>

          <p>
            Another request can be started here after the previous
            request is declined, expired, cancelled, or completed.
            We check its current status before opening a new form.
          </p>
        </section>
      ) : saved ? (
        <section>
          <h2>{saving ? 'Submitting request…' : 'Check submission result'}</h2>
          <p>
            Your original submission is saved in this browser tab.
            Retry it to check the result without creating a duplicate.
            Keep this tab open until the result is confirmed.
          </p>
          <button
            className="button dark-button"
            type="button"
            disabled={saving || loading}
            onClick={() => void submit()}
          >
            {saving ? 'Checking…' : 'Retry same submission'}
          </button>
        </section>
      ) : !loading && provider && !accessStatus ? (
        !provider.canRequest ? (
          <p>
            This provider is not currently accepting online requests.
            Return to the directory to check contact details.
          </p>
        ) : supportedPets.length === 0 ? (
          <p>
            You need a pet profile matching this provider’s supported
            species. <Link to="/account">Manage your pets</Link>.
          </p>
        ) : (
          <form
            className="vet-editor-form"
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            <p>
              <strong>Pickup coverage:</strong>{' '}
              {provider.serviceAreas
                .map((area) => `${area.city}, ${area.state}`)
                .join('; ')}
            </p>

            {provider.animalRestrictions && (
              <p><strong>Restrictions:</strong> {provider.animalRestrictions}</p>
            )}

            <div className="vet-editor-field">
              <label htmlFor="transport-pet">Pet *</label>
              <select
                id="transport-pet"
                value={petId}
                onChange={(event) => setPetId(event.target.value)}
                required
              >
                <option value="">Choose your pet</option>
                {supportedPets.map((pet) => (
                  <option key={pet.id} value={pet.id}>
                    {pet.name} ({pet.species})
                  </option>
                ))}
              </select>
            </div>

            {fieldDefinitions.map((field) => (
              <div className="vet-editor-field" key={field.key}>
                <label htmlFor={`transport-${field.key}`}>
                  {field.label}{field.min > 0 ? ' *' : ''}
                </label>
                <input
                  id={`transport-${field.key}`}
                  type={field.key === 'contactPhone' ? 'tel' : 'text'}
                  value={fields[field.key] ?? ''}
                  minLength={field.min || undefined}
                  maxLength={field.max}
                  required={field.min > 0}
                  onChange={(event) => {
                    setFields((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }}
                />
              </div>
            ))}

            <p>Pickup and destination must be in India.</p>

            <div className="vet-editor-field">
              <label htmlFor="transport-time">
                Requested pickup — India Standard Time (IST) *
              </label>
              <input
                id="transport-time"
                type="datetime-local"
                step={60}
                value={pickupTime}
                onChange={(event) => setPickupTime(event.target.value)}
                required
              />
              <p>Choose a time 15 minutes to 7 days ahead.</p>
            </div>

            <div className="vet-editor-field">
              <label htmlFor="transport-notes">Transport needs (optional)</label>
              <textarea
                id="transport-notes"
                value={notes}
                maxLength={1000}
                rows={3}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>

            <button className="button dark-button" type="submit">
              Submit transport request
            </button>
          </form>
        )
      ) : null}
    </main>
  )
}

export default TransportRequestForm