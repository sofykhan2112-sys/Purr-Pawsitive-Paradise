import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import './AdminVetEditor.css'

type Listing = {
  id: string
  version: number
  providerName: string
  description: string | null
  city: string
  state: string
  phone: string | null
  openingHours: string | null
  timeZone: string
  species: string[]
  animalRestrictions: string | null
  status: string
  verificationStatus: string
  availability: string
  availabilityUpdatedAt: string | null
  requestsEnabled: boolean
  serviceAreas: {
    city: string
    state: string
  }[]
}

function verificationMessage(status: string) {
  switch (status) {
    case 'NOT_SUBMITTED':
      return 'Your listing has not been submitted for verification. Contact an administrator to arrange review.'
    case 'SUBMITTED':
      return 'Your listing has been submitted and is waiting for review.'
    case 'UNDER_REVIEW':
      return 'An administrator is reviewing your listing.'
    case 'APPROVED':
      return 'Your listing has been approved. Publication is managed separately.'
    case 'REJECTED':
      return 'Your submission needs corrections. Contact an administrator for the required changes.'
    case 'SUSPENDED':
      return 'Your listing is suspended. Contact an administrator before resuming service through this platform.'
    default:
      return 'Contact an administrator for information about verification.'
  }
}

function AmbulanceWorkspace() {
  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [accessStatus, setAccessStatus] =
    useState<401 | 403 | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [saving, setSaving] = useState(false)
  const [actionMessage, setActionMessage] = useState('')
  const actionInFlight = useRef(false)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setListing(null)
      setError('')
      setAccessStatus(null)

      try {
        const response = await fetch('/api/provider/ambulance', {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        })

        const result = await response.json().catch(() => null)

        if (controller.signal.aborted) return

        if (response.status === 401 || response.status === 403) {
          setAccessStatus(response.status)
          setError(result?.message ?? 'Provider access is required.')
          return
        }

        if (!response.ok) {
          throw new Error(
            result?.message ?? 'Could not load your listing.',
          )
        }

        if (result?.listing === null) {
          return
        }

        const item = result?.listing

        if (
          typeof item?.id !== 'string' ||
          !Number.isSafeInteger(item.version) ||
          item.version < 1 ||
          typeof item.providerName !== 'string' ||
          typeof item.status !== 'string' ||
          typeof item.verificationStatus !== 'string' ||
          !Array.isArray(item.species) ||
          !Array.isArray(item.serviceAreas)
        ) {
          throw new Error('Unexpected listing response.')
        }

        setListing(item)
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(
            error instanceof Error
              ? error.message
              : 'Could not load your listing.',
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => controller.abort()
  }, [refresh])

  async function updateAvailability(
    availability: 'AVAILABLE' | 'UNAVAILABLE' | 'UNKNOWN',
  ) {
    if (
      !listing ||
      loading ||
      actionInFlight.current ||
      listing.status !== 'PUBLISHED' ||
      listing.verificationStatus !== 'APPROVED'
    ) {
      return
    }

    actionInFlight.current = true
    setSaving(true)
    setActionMessage('')

    try {
      const response = await fetch(
        '/api/provider/ambulance/availability',
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version: listing.version,
            availability,
          }),
        },
      )

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          result?.message ?? 'Could not update availability.',
        )
      }

      if (
        result?.listing?.id !== listing.id ||
        result.listing.version !== listing.version + 1 ||
        result.listing.availability !== availability
      ) {
        throw new Error('Could not verify the result.')
      }

      setActionMessage(
        `Availability recorded: ${availability.toLowerCase()}.`,
      )
    } catch (error) {
      setActionMessage(
        `${
          error instanceof Error
            ? error.message
            : 'The result is uncertain.'
        } Check the refreshed details before trying again.`,
      )
    } finally {
      setListing(null)
      setLoading(true)
      setRefresh((value) => value + 1)
      setSaving(false)
      actionInFlight.current = false
    }
  }

  return (
    <main className="page-width vet-editor-main">
      <Link className="text-link" to="/account">
        Back to my account
      </Link>

      <div className="vet-editor-heading">
        <p className="eyebrow">PROVIDER WORKSPACE</p>
        <h1>My ambulance listing</h1>
        <p>Check your listing details and current service status.</p>
      </div>

      <div className="vet-editor-actions">
        <button
          className="button dark-button"
          type="button"
          disabled={loading || saving}
          onClick={() => setRefresh((value) => value + 1)}
        >
          {loading ? 'Loading…' : 'Refresh details'}
        </button>

        <Link className="text-link" to="/ambulances">
          Public directory
        </Link>

        <Link
          className="text-link"
          to="/provider/ambulance/requests"
        >
          Transport requests
        </Link>
      </div>

      {actionMessage && (
        <p className="vet-editor-notice" role="status">
          {actionMessage}
        </p>
      )}

      {loading && <p role="status">Loading your listing…</p>}

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

      {!loading && !error && !listing && (
        <div className="vet-editor-notice">
          <h2>No listing linked yet</h2>
          <p>
            Contact an administrator to link your provider account
            to your ambulance listing.
          </p>
        </div>
      )}

      {!loading && !error && listing && (
        <>
          <section style={{ marginTop: '1.5rem' }}>
            <h2>{listing.providerName}</h2>

            <p>
              <strong>Verification:</strong>{' '}
              {listing.verificationStatus.replaceAll('_', ' ')}
            </p>

            <p className="vet-editor-notice">
              {verificationMessage(listing.verificationStatus)}
            </p>

            <p>
              <strong>Publication:</strong>{' '}
              {listing.status.replaceAll('_', ' ')}
            </p>

            {listing.status !== 'PUBLISHED' && (
              <p>Your listing is not currently published.</p>
            )}

            <p>
              <strong>Transport-request setting:</strong>{' '}
              {listing.requestsEnabled ? 'Enabled' : 'Disabled'}
            </p>

            <p>
              <strong>Recorded availability:</strong>{' '}
              {listing.availability.replaceAll('_', ' ')}
            </p>

            <p>
              <strong>Availability last updated:</strong>{' '}
              {listing.availabilityUpdatedAt
                ? new Date(
                    listing.availabilityUpdatedAt,
                  ).toLocaleString()
                : 'Not recorded'}
            </p>

            <p>
              Availability is a recorded status, not a confirmed
              booking or dispatch. It does not enable transport
              requests.
            </p>

            {listing.status === 'PUBLISHED' &&
            listing.verificationStatus === 'APPROVED' ? (
              <>
                <div className="vet-editor-actions">
                  <button
                    className="button dark-button"
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      void updateAvailability('AVAILABLE')
                    }
                  >
                    Mark available
                  </button>

                  <button
                    className="button dark-button"
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      void updateAvailability('UNAVAILABLE')
                    }
                  >
                    Mark unavailable
                  </button>

                  <button
                    className="button dark-button"
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      void updateAvailability('UNKNOWN')
                    }
                  >
                    Mark unknown
                  </button>
                </div>

                {saving && (
                  <p role="status">Saving availability…</p>
                )}

                <p>
                  Select a status again to reconfirm it and update
                  its timestamp.
                </p>
              </>
            ) : (
              <p className="vet-editor-notice">
                Availability controls become available after an
                administrator approves and publishes your listing.
              </p>
            )}
          </section>

          <section style={{ marginTop: '1.5rem' }}>
            <h2>Service details</h2>

            <p>
              <strong>Base:</strong> {listing.city}, {listing.state}
            </p>

            <p>
              <strong>Phone:</strong>{' '}
              {listing.phone || 'Not provided'}
            </p>

            <p>
              <strong>Supported pet groups:</strong>{' '}
              {listing.species.join(', ') || 'Not configured'}
            </p>

            <p>
              <strong>Coverage:</strong>{' '}
              {listing.serviceAreas
                .map((area) => `${area.city}, ${area.state}`)
                .join('; ') || 'Not configured'}
            </p>

            <p style={{ whiteSpace: 'pre-wrap' }}>
              <strong>Operating hours:</strong>{' '}
              {listing.openingHours || 'Not provided'}
            </p>

            <p>
              <strong>Service time zone:</strong> {listing.timeZone}
            </p>

            <p style={{ whiteSpace: 'pre-wrap' }}>
              <strong>Animal restrictions:</strong>{' '}
              {listing.animalRestrictions || 'Not specified'}
            </p>

            <p style={{ whiteSpace: 'pre-wrap' }}>
              <strong>Description:</strong>{' '}
              {listing.description || 'Not provided'}
            </p>

            <p style={{ overflowWrap: 'anywhere' }}>
              <strong>Listing reference:</strong> {listing.id}
            </p>

            <p>
              Contact an administrator if these details need correction.
            </p>
          </section>
        </>
      )}
    </main>
  )
}

export default AmbulanceWorkspace