import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import './AdminVetEditor.css'

type AmbulanceListing = {
  id: string
  providerName: string
  description: string | null
  species: string[]
  animalRestrictions: string | null
  city: string
  state: string
  phone: string | null
  openingHours: string | null
  timeZone: string
  isDemo: boolean
  availability: 'UNKNOWN' | 'AVAILABLE' | 'UNAVAILABLE'
  availabilityUpdatedAt: string | null
  availabilityIsFresh: boolean
  canRequest: boolean
  serviceAreas: {
    city: string
    state: string
    countryCode: string
  }[]
}

type DirectoryPage = {
  ambulances: AmbulanceListing[]
  total: number
  totalPages: number
}

type Filters = {
  city: string
  state: string
  species: string
}

function displayTime(value: string, timeZone: string) {
  const date = new Date(value)

  if (!Number.isFinite(date.getTime())) return 'Unknown'

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

function phoneLink(value: string | null) {
  if (!value) return null

  const normalized = value.replace(/[\s().-]/g, '')

  return /^\+?\d{7,15}$/.test(normalized)
    ? `tel:${normalized}`
    : null
}

function AmbulanceDirectory() {
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [species, setSpecies] = useState('')
  const [filters, setFilters] = useState<Filters>({
    city: '',
    state: '',
    species: '',
  })

  const [page, setPage] = useState(1)
  const [refresh, setRefresh] = useState(0)
  const [data, setData] = useState<DirectoryPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [clock, setClock] = useState(Date.now())

  useEffect(() => {
    const controller = new AbortController()

    async function loadDirectory() {
      setLoading(true)
      setError('')
      setData(null)

      const query = new URLSearchParams({
        page: String(page),
      })

      if (filters.city) query.set('city', filters.city)
      if (filters.state) query.set('state', filters.state)
      if (filters.species) query.set('species', filters.species)

      try {
        const response = await fetch(
          `/api/ambulances?${query.toString()}`,
          {
            cache: 'no-store',
            signal: controller.signal,
          },
        )

        const result = await response.json()

        if (controller.signal.aborted) return

        if (!response.ok) {
          throw new Error(
            typeof result?.message === 'string'
              ? result.message
              : 'Could not load transport providers.',
          )
        }

        if (
          !Array.isArray(result?.ambulances) ||
          !Number.isInteger(result.total) ||
          result.total < 0 ||
          !Number.isInteger(result.totalPages) ||
          result.totalPages < 0
        ) {
          throw new Error('Unexpected directory response.')
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
              : 'Could not load transport providers.',
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadDirectory()
    return () => controller.abort()
  }, [filters, page, refresh])

  useEffect(() => {
    // Age availability labels while the page remains open.
    const interval = window.setInterval(
      () => setClock(Date.now()),
      30000,
    )

    function updateClock() {
      setClock(Date.now())
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        updateClock()
      }
    }

    window.addEventListener('focus', updateClock)
    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    )

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', updateClock)
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      )
    }
  }, [])

  function search() {
    setPage(1)
    setFilters({
      city: city.trim(),
      state: state.trim(),
      species,
    })
  }

  function clearFilters() {
    setCity('')
    setState('')
    setSpecies('')
    setPage(1)
    setFilters({ city: '', state: '', species: '' })
  }

  return (
    <main className="page-width vet-editor-main">
      <nav
        className="vet-editor-actions"
        aria-label="Transport directory navigation"
      >
        <Link className="text-link" to="/">Home</Link>
        <Link className="text-link" to="/vets">Find a vet</Link>
        <Link className="text-link" to="/account">My account</Link>
      </nav>

      <div className="vet-editor-heading">
        <p className="eyebrow">ANIMAL TRANSPORT</p>
        <h1>Find an ambulance provider</h1>
        <p>
          Search by pickup city, state, and pet species.
          You can view provider contacts without signing in.
        </p>
      </div>

      <p className="vet-editor-notice">
        A listing or availability update does not confirm a vehicle.
        Contact a real provider directly to confirm coverage,
        animal suitability, charges, and pickup arrangements.
        Eligible providers show a Request transport button.
        Submitting a request does not confirm pickup.
      </p>

      <form
        className="vet-editor-form"
        onSubmit={(event) => {
          event.preventDefault()
          search()
        }}
      >
        <div className="vet-editor-field">
          <label htmlFor="transport-city">Pickup city</label>
          <input
            id="transport-city"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="Mumbai"
            maxLength={100}
            disabled={loading}
          />
        </div>

        <div className="vet-editor-field">
          <label htmlFor="transport-state">State</label>
          <input
            id="transport-state"
            value={state}
            onChange={(event) => setState(event.target.value)}
            placeholder="Maharashtra"
            maxLength={100}
            disabled={loading}
          />
        </div>

        <div className="vet-editor-field">
          <label htmlFor="transport-species">Pet species</label>
          <select
            id="transport-species"
            value={species}
            onChange={(event) => setSpecies(event.target.value)}
            disabled={loading}
          >
            <option value="">All species</option>
            <option value="CAT">Cat</option>
            <option value="DOG">Dog</option>
            <option value="TURTLE">Turtle</option>
          </select>
        </div>

        <div className="vet-editor-actions">
          <button
            className="button dark-button"
            type="submit"
            disabled={loading}
          >
            Search providers
          </button>

          <button
            className="button dark-button"
            type="button"
            disabled={loading}
            onClick={clearFilters}
          >
            Clear filters
          </button>

          <button
            className="button dark-button"
            type="button"
            disabled={loading}
            onClick={() => setRefresh((value) => value + 1)}
          >
            Refresh results
          </button>
        </div>
      </form>

      {loading && <p role="status">Loading providers…</p>}

      {error && (
        <p className="vet-editor-error" role="alert">{error}</p>
      )}

      {!loading && data && (
        <>
          <p role="status">
            {data.total} matching listing
            {data.total === 1 ? '' : 's'}, including any labelled demos.
          </p>

          {data.ambulances.length === 0 ? (
            <div className="vet-editor-summary">
              <h2>No matching providers listed.</h2>
              <p>
                Check the city and state spelling or adjust your filters.
                No transport has been arranged through this page.
              </p>
            </div>
          ) : (
            data.ambulances.map((listing) => {
              const updatedAt = listing.availabilityUpdatedAt
                ? Date.parse(listing.availabilityUpdatedAt)
                : NaN

              const fresh =
                listing.availabilityIsFresh &&
                Number.isFinite(updatedAt) &&
                updatedAt <= clock &&
                clock - updatedAt < 30 * 60 * 1000

              const availability = fresh
                ? listing.availability
                : 'UNKNOWN'

              const callUrl = listing.isDemo
                ? null
                : phoneLink(listing.phone)

              return (
                <article
                  key={listing.id}
                  className="vet-editor-summary"
                  style={{ marginBottom: '1.5rem' }}
                >
                  <p className="eyebrow">
                    {listing.isDemo
                      ? 'FICTIONAL DEMO PROVIDER'
                      : 'ANIMAL TRANSPORT PROVIDER'}
                  </p>

                  <h2>{listing.providerName}</h2>

                  {listing.isDemo && (
                    <p className="vet-editor-notice">
                      Demonstration only. This listing has no real
                      ambulance, phone contact, or transport service.
                    </p>
                  )}

                  {listing.description && <p>{listing.description}</p>}

                  <p>
                    <strong>Based in:</strong>{' '}
                    {listing.city}, {listing.state}
                  </p>

                  <p>
                    <strong>Service areas:</strong>{' '}
                    {listing.serviceAreas.length > 0
                      ? listing.serviceAreas
                          .map((area) => `${area.city}, ${area.state}`)
                          .join('; ')
                      : 'No coverage areas listed'}
                  </p>

                  <p>
                    <strong>Pet groups:</strong>{' '}
                    {listing.species.join(', ') || 'Not specified'}
                  </p>

                  {listing.animalRestrictions && (
                    <p>
                      <strong>Restrictions:</strong>{' '}
                      {listing.animalRestrictions}
                    </p>
                  )}

                  <p>
                    <strong>Operating hours:</strong>{' '}
                    {listing.openingHours || 'Contact provider to confirm'}
                  </p>

                  <p>
                    <strong>Availability:</strong>{' '}
                    {listing.isDemo
                      ? 'Demo only'
                      : !fresh
                        ? 'Not recently confirmed — call to confirm'
                        : availability === 'AVAILABLE'
                          ? 'Provider reports available — call to confirm'
                          : availability === 'UNAVAILABLE'
                            ? 'Provider reports unavailable'
                            : 'Provider reports availability unknown — call to confirm'}
                  </p>

                  <p>
                    <strong>Last availability update:</strong>{' '}
                    {listing.availabilityUpdatedAt
                      ? displayTime(
                          listing.availabilityUpdatedAt,
                          listing.timeZone,
                        )
                      : 'No update recorded'}
                  </p>

                  {!listing.isDemo && (
                    <p>
                      {fresh
                        ? 'This update is less than 30 minutes old. Contact the provider to confirm a vehicle and pickup.'
                        : 'No valid availability update from the last 30 minutes is available. This does not necessarily mean the provider is unavailable.'}
                    </p>
                  )}

                   {!listing.isDemo &&
                        listing.canRequest &&
                         fresh &&
                         availability === 'AVAILABLE' && (
                      <p>
                        <Link
                          className="button dark-button"
                          to={`/ambulances/${listing.id}/request`}
                        >
                          Request transport
                        </Link>
                      </p>
                    )}

                  {!listing.isDemo && (
                    callUrl ? (
                      <div>
                        <p>
                          <strong>Phone:</strong> {listing.phone}
                        </p>
                        <a
                          className="button dark-button"
                          href={callUrl}
                        >
                          Call provider
                        </a>
                      </div>
                    ) : (
                      <p>No usable phone number is listed.</p>
                    )
                  )}
                   {!listing.isDemo && (
                    <p>
                      <Link
                        className="text-link"
                        to={`/reports/new?type=AMBULANCE&id=${encodeURIComponent(listing.id)}`}
                      >
                        Report an issue with this listing
                      </Link>
                    </p>
                  )}
                </article>
              )
            })
          )}

          {data.totalPages > 1 && (
            <nav
              className="vet-editor-actions"
              aria-label="Ambulance directory pages"
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

export default AmbulanceDirectory