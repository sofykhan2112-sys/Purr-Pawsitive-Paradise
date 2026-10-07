import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import './AdminVetEditor.css'

type Ambulance = {
  id: string
  providerName: string
  city: string
  state: string
  species: string[]
  status: string
  isDemo: boolean
  verificationStatus: string
  verificationNotes: string | null
  verificationEvidenceReferences: string | null
  availability: string
  availabilityUpdatedAt: string | null
  requestsEnabled: boolean
  version: number
  user: {
    id: string
    name: string
    role: string
    status: string
  } | null
  serviceAreas: {
    city: string
    state: string
  }[]
}

type ListingPage = {
  ambulances: Ambulance[]
  total: number
  totalPages: number
}

function AdminAmbulances() {
  const [data, setData] = useState<ListingPage | null>(null)
  const [page, setPage] = useState(1)
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

    async function load() {
      setLoading(true)
      setError('')
      setAccessStatus(null)
      setData(null)

      try {
        const response = await fetch(
          `/api/admin/ambulances?page=${page}`,
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
            result.message ?? 'Could not load ambulance listings.',
          )
        }

        if (
          !Array.isArray(result.ambulances) ||
          !Number.isInteger(result.total) ||
          result.total < 0 ||
          !Number.isInteger(result.totalPages) ||
          result.totalPages < 0
        ) {
          throw new Error('Unexpected listing response.')
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
              : 'Could not load ambulance listings.',
          )
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [page, refresh])

  async function changePublication(
    listing: Ambulance,
    action: 'PUBLISH_DEMO' | 'PUBLISH_REAL' | 'ARCHIVE',
  ) {
    if (actionInFlight.current) return

    const promptText =
      action === 'PUBLISH_DEMO'
        ? `Publish ${listing.providerName} as a fictional demo?`
        : action === 'PUBLISH_REAL'
          ? `Publish ${listing.providerName} as an approved real provider? Transport requests will remain disabled.`
          : `Archive ${listing.providerName} and remove it from the public directory?`

    const enteredReason = window.prompt(
      `${promptText}\nEnter a reason of 5–1000 characters.`,
    )

    if (enteredReason === null) return

    const reason = enteredReason.trim()

    if (reason.length < 5 || reason.length > 1000) {
      setActionMessage('Enter a reason of 5–1000 characters.')
      return
    }

    actionInFlight.current = true
    setBusyId(listing.id)
    setActionMessage('')

    try {
      const response = await fetch(
        `/api/admin/ambulances/${encodeURIComponent(listing.id)}/publication`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version: listing.version,
            action,
            reason,
          }),
        },
      )

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          result?.message ?? 'Could not update publication.',
        )
      }

      const expectedStatus =
        action === 'ARCHIVE' ? 'ARCHIVED' : 'PUBLISHED'

      if (
        result?.listing?.id !== listing.id ||
        result.listing.status !== expectedStatus ||
        result.listing.version !== listing.version + 1
      ) {
        throw new Error('Could not verify the result.')
      }

      setActionMessage(
        action === 'PUBLISH_DEMO'
          ? 'Demo listing published.'
          : action === 'PUBLISH_REAL'
            ? 'Approved provider published. Transport requests remain disabled.'
            : 'Listing archived.',
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

  async function changeVerification(
    listing: Ambulance,
    action:
    | 'SUBMIT'
    | 'START_REVIEW'
    | 'APPROVE'
    | 'REJECT'
    | 'SUSPEND'
    | 'REOPEN',
  ) {
    if (actionInFlight.current) return
  
    const labels = {
      SUBMIT: 'Submit for review',
      START_REVIEW: 'Start review',
      APPROVE: 'Approve provider',
      REJECT: 'Reject submission',
      SUSPEND: 'Suspend provider and remove it from the public directory',
      REOPEN: 'Return provider to draft for corrections and a fresh review',
    }
  
    const enteredReason = window.prompt(
      `${labels[action]}: ${listing.providerName}\nEnter a reason of 5–1000 characters.`,
    )
  
    if (enteredReason === null) return
  
    const reason = enteredReason.trim()
  
    if (reason.length < 5 || reason.length > 1000) {
      setActionMessage('Enter a reason of 5–1000 characters.')
      return
    }
  
    let evidence = ''
  
    if (action === 'SUBMIT' || action === 'APPROVE') {
      const enteredEvidence = window.prompt(
        action === 'APPROVE'
          ? 'Identify the evidence you checked, including confirmation references and dates. Enter 10–5000 characters.'
          : 'Identify the evidence available for review. Enter 10–5000 characters.',
      )
  
      if (enteredEvidence === null) return
  
      evidence = enteredEvidence.trim()
  
      if (evidence.length < 10 || evidence.length > 5000) {
        setActionMessage('Enter evidence references of 10–5000 characters.')
        return
      }
    }
  
    actionInFlight.current = true
    setBusyId(listing.id)
    setActionMessage('')
  
    try {
      const response = await fetch(
        `/api/admin/ambulances/${encodeURIComponent(listing.id)}/verification`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version: listing.version,
            action,
            reason,
            evidence,
          }),
        },
      )
  
      const result = await response.json().catch(() => null)
  
      if (!response.ok) {
        throw new Error(result?.message ?? 'Could not update verification.')
      }
  
      const expected = {
        SUBMIT: 'SUBMITTED',
        START_REVIEW: 'UNDER_REVIEW',
        APPROVE: 'APPROVED',
        REJECT: 'REJECTED',
        SUSPEND: 'SUSPENDED',
        REOPEN: 'NOT_SUBMITTED',
      }
  
      const expectedPublication =
      action === 'SUSPEND'
        ? 'ARCHIVED'
        : action === 'REOPEN'
          ? 'DRAFT'
          : listing.status

    if (
      result?.listing?.id !== listing.id ||
      result.listing.version !== listing.version + 1 ||
      result.listing.verificationStatus !== expected[action] ||
      result.listing.status !== expectedPublication
    ) {
      throw new Error('Could not verify the result.')
    }

    setActionMessage(
      action === 'SUSPEND'
        ? 'Provider suspended and archived. Transport requests are disabled.'
        : action === 'REOPEN'
          ? 'Provider returned to draft. Edit its details, then submit it for a fresh review.'
          : `Verification updated to ${expected[action].replaceAll('_', ' ')}. Publication status is unchanged.`,
    )
    } catch (error) {
      setActionMessage(
        `${
          error instanceof Error ? error.message : 'The result is uncertain.'
        } Check the refreshed list before trying again.`,
      )
    } finally {
      // Remove stale action buttons until the next list fetch succeeds.
      setData(null)
      setLoading(true)
      setRefresh((value) => value + 1)
      setBusyId(null)
      actionInFlight.current = false
    }
  }
  
  async function linkProviderAccount(listing: Ambulance) {
    if (actionInFlight.current) return

    const enteredEmail = window.prompt(
      `Enter the exact login email of the provider account for ${listing.providerName}.`,
    )

    if (enteredEmail === null) return

    const email = enteredEmail.trim().toLowerCase()

    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      setActionMessage('Enter a valid provider account email.')
      return
    }

    const enteredReason = window.prompt(
      'Enter a reason of 5–1000 characters explaining this account association.',
    )

    if (enteredReason === null) return

    const reason = enteredReason.trim()

    if (reason.length < 5 || reason.length > 1000) {
      setActionMessage('Enter a reason of 5–1000 characters.')
      return
    }

    if (
      !window.confirm(
        `Link ${email} to ${listing.providerName}?\n\nThe listing will become a draft and require a fresh review. Transport requests will remain disabled.`,
      )
    ) {
      return
    }

    actionInFlight.current = true
    setBusyId(listing.id)
    setActionMessage('')

    try {
      const response = await fetch(
        `/api/admin/ambulances/${encodeURIComponent(listing.id)}/link-account`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version: listing.version,
            email,
            reason,
          }),
        },
      )

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          result?.message ?? 'Could not link the provider account.',
        )
      }

      if (
        result?.listing?.id !== listing.id ||
        result.listing.version !== listing.version + 1 ||
        result.listing.status !== 'DRAFT' ||
        result.listing.verificationStatus !== 'NOT_SUBMITTED' ||
        typeof result.listing.user?.id !== 'string'
      ) {
        throw new Error('Could not verify the result.')
      }

      setActionMessage(
        'Provider account linked. Submit the draft for a fresh review.',
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

  async function changeRequestSetting(
    listing: Ambulance,
    enabled: boolean,
  ) {
    if (actionInFlight.current) return

    const enteredReason = window.prompt(
      enabled
        ? `Enable transport requests for ${listing.providerName}? Enter a reason of 5–1000 characters.`
        : `Disable new transport requests for ${listing.providerName}? Existing requests will remain unchanged. Enter a reason of 5–1000 characters.`,
    )

    if (enteredReason === null) return

    const reason = enteredReason.trim()

    if (reason.length < 5 || reason.length > 1000) {
      setActionMessage('Enter a reason of 5–1000 characters.')
      return
    }

    actionInFlight.current = true
    setBusyId(listing.id)
    setActionMessage('')

    try {
      const response = await fetch(
        `/api/admin/ambulances/${encodeURIComponent(listing.id)}/requests`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version: listing.version,
            enabled,
            reason,
          }),
        },
      )

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          result?.message ?? 'Could not change the request setting.',
        )
      }

      if (
        result?.listing?.id !== listing.id ||
        result.listing.version !== listing.version + 1 ||
        result.listing.requestsEnabled !== enabled
      ) {
        throw new Error('Could not verify the result.')
      }

      setActionMessage(
        enabled
          ? 'Transport requests enabled. The provider must also have recently reported availability.'
          : 'New transport requests disabled. Existing requests are unchanged.',
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
        <p className="eyebrow">ADMINISTRATION</p>
        <h1>Manage ambulance listings</h1>
        <p>
          Review provider listings, publication status, and verification.
        </p>
      </div>

      {accessStatus ? (
        <p role="alert">
          {accessStatus === 401
            ? 'Please sign in with an administrator account.'
            : 'Administrator access is required.'}
          {' '}
          <Link to={accessStatus === 401 ? '/login' : '/account'}>
            {accessStatus === 401 ? 'Sign in' : 'My account'}
          </Link>
        </p>
      ) : (
        <div className="vet-editor-actions">
            <Link
              className="button dark-button"
              to="/admin/ambulances/new"
            >
             Create listing
           </Link>
          <button
            className="button dark-button"
            type="button"
            disabled={loading}
            onClick={() => setRefresh((value) => value + 1)}
          >
            {loading ? 'Loading…' : 'Refresh listings'}
          </button>

          <Link className="text-link" to="/ambulances">
            Public directory
          </Link>
        </div>
      )}

      {actionMessage && (
         <p className="vet-editor-notice" role="status">
         {actionMessage}
     </p>
    )}

      {loading && <p role="status">Loading listings…</p>}

      {error && (
        <p className="vet-editor-error" role="alert">{error}</p>
      )}

      {!loading && data && (
        <>
          <p role="status">{data.total} listings.</p>

          {data.ambulances.length === 0 && (
            <p>No ambulance listings have been created.</p>
          )}

          {data.ambulances.map((listing) => (
            <article
              className="vet-editor-summary"
              key={listing.id}
              style={{ marginBottom: '1.5rem' }}
            >
              <p className="eyebrow">
                {listing.isDemo ? 'FICTIONAL DEMO' : 'REAL PROVIDER'}
              </p>

              <h2>{listing.providerName}</h2>

              <p>
                <strong>Base:</strong> {listing.city}, {listing.state}
              </p>

              <p>
                <strong>Publication:</strong>{' '}
                {listing.status.replaceAll('_', ' ')}
              </p>

              <p>
                <strong>Verification:</strong>{' '}
                {listing.verificationStatus.replaceAll('_', ' ')}
              </p>

              <p>
                <strong>Pet groups:</strong>{' '}
                {listing.species.join(', ') || 'None configured'}
              </p>

              <p>
                <strong>Coverage:</strong>{' '}
                {listing.serviceAreas
                  .map((area) => `${area.city}, ${area.state}`)
                  .join('; ') || 'None configured'}
              </p>

              <p>
                <strong>Linked account:</strong>{' '}
                {listing.user
                  ? `${listing.user.name} (${listing.user.role}, ${listing.user.status})`
                  : 'No account linked'}
              </p>

              <p>
                <strong>Transport-request setting:</strong>{' '}
                {listing.requestsEnabled ? 'Enabled' : 'Disabled'}
              </p>

              {!listing.isDemo && (
                <details>
                  <summary>Internal verification notes</summary>

                  <p
                    style={{
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    <strong>Latest reason:</strong>{' '}
                    {listing.verificationNotes || 'No review notes yet.'}
                  </p>

                  <p
                    style={{
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    <strong>Evidence references:</strong>{' '}
                    {listing.verificationEvidenceReferences ||
                      'None recorded.'}
                  </p>
                </details>
              )}

              <p style={{ overflowWrap: 'anywhere' }}>
                <strong>Listing reference:</strong> {listing.id}
              </p>
              <Link
  className="text-link"
  to={`/admin/ambulances/${listing.id}`}
  onClick={(event) => {
    if (busyId !== null) event.preventDefault()
  }}
>
  Edit listing details
</Link>

<Link
                className="text-link"
                style={{ marginLeft: '1rem' }}
                to={`/admin/ambulances/${listing.id}/history`}
                onClick={(event) => {
                  if (busyId !== null) event.preventDefault()
                }}
              >
                View audit history
              </Link>
              <div className="vet-editor-actions">
  {listing.isDemo &&
    listing.status !== 'PUBLISHED' &&
    listing.verificationStatus !== 'SUSPENDED' && (
      <button
        className="button dark-button"
        type="button"
        disabled={busyId !== null}
        onClick={() =>
          void changePublication(listing, 'PUBLISH_DEMO')
        }
      >
        Publish demo
      </button>
    )}

{!listing.isDemo &&
    listing.status !== 'PUBLISHED' &&
    listing.verificationStatus === 'APPROVED' && (
      <button
        className="button dark-button"
        type="button"
        disabled={busyId !== null}
        onClick={() =>
          void changePublication(listing, 'PUBLISH_REAL')
        }
      >
        Publish provider
      </button>
    )}

  {listing.status !== 'ARCHIVED' && (
    <button
      className="button dark-button"
      type="button"
      disabled={busyId !== null}
      onClick={() => void changePublication(listing, 'ARCHIVE')}
    >
      Archive listing
    </button>
  )}

{!listing.isDemo && listing.status !== 'PUBLISHED' && (
  <>
    {['NOT_SUBMITTED', 'REJECTED'].includes(
      listing.verificationStatus,
    ) && (
      <button
        className="button dark-button"
        type="button"
        disabled={busyId !== null}
        onClick={() => void changeVerification(listing, 'SUBMIT')}
      >
        Submit for review
      </button>
    )}

    {listing.verificationStatus === 'SUBMITTED' && (
      <button
        className="button dark-button"
        type="button"
        disabled={busyId !== null}
        onClick={() => void changeVerification(listing, 'START_REVIEW')}
      >
        Start review
      </button>
    )}

    {listing.verificationStatus === 'UNDER_REVIEW' && (
      <>
        <button
          className="button dark-button"
          type="button"
          disabled={busyId !== null}
          onClick={() => void changeVerification(listing, 'APPROVE')}
        >
          Approve provider
        </button>

        <button
          className="button dark-button"
          type="button"
          disabled={busyId !== null}
          onClick={() => void changeVerification(listing, 'REJECT')}
        >
          Reject submission
        </button>
      </>
    )}
  </>
)}

  {!listing.isDemo &&
    listing.verificationStatus === 'APPROVED' && (
      <button
        className="button dark-button"
        type="button"
        disabled={busyId !== null}
        onClick={() => void changeVerification(listing, 'SUSPEND')}
      >
        Suspend provider
      </button>
    )}

{!listing.isDemo &&
    listing.status !== 'PUBLISHED' &&
    listing.verificationStatus === 'SUSPENDED' && (
      <button
        className="button dark-button"
        type="button"
        disabled={busyId !== null}
        onClick={() => void changeVerification(listing, 'REOPEN')}
      >
        Return to draft
      </button>
    )}
   
   {!listing.isDemo &&
    !listing.user &&
    listing.status !== 'PUBLISHED' &&
    ['NOT_SUBMITTED', 'REJECTED', 'APPROVED'].includes(
      listing.verificationStatus,
    ) && (
      <button
        className="button dark-button"
        type="button"
        disabled={busyId !== null}
        onClick={() => void linkProviderAccount(listing)}
      >
        Link provider account
      </button>
    )}

{listing.requestsEnabled ? (
    <button
      className="button dark-button"
      type="button"
      disabled={busyId !== null}
      onClick={() => void changeRequestSetting(listing, false)}
    >
      Disable transport requests
    </button>
  ) : (
    !listing.isDemo &&
    listing.status === 'PUBLISHED' &&
    listing.verificationStatus === 'APPROVED' &&
    listing.user?.role === 'AMBULANCE_PROVIDER' &&
    listing.user.status === 'ACTIVE' && (
      <button
        className="button dark-button"
        type="button"
        disabled={busyId !== null}
        onClick={() => void changeRequestSetting(listing, true)}
      >
        Enable transport requests
      </button>
    )
  )}

  {busyId === listing.id && (
    <span role="status">Saving…</span>
  )}
</div>
            </article>
          ))}

          {data.totalPages > 1 && (
            <nav
              className="vet-editor-actions"
              aria-label="Admin ambulance listing pages"
            >
              <button
                className="button dark-button"
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </button>

              <span>Page {page} of {data.totalPages}</span>

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
    </main>
  )
}

export default AdminAmbulances