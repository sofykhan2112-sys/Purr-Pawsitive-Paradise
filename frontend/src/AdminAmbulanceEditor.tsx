import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import './AdminVetEditor.css'

type Listing = {
  id: string
  version: number
  status: string
  isDemo: boolean
  countryCode: string
  verificationStatus: string
  timeZone: string
}

type Area = {
  key: string
  city: string
  state: string
}

type FormFields = {
  providerName: string
  description: string
  animalRestrictions: string
  city: string
  state: string
  phone: string
  openingHours: string
}

const emptyFields: FormFields = {
  providerName: '',
  description: '',
  animalRestrictions: '',
  city: '',
  state: '',
  phone: '',
  openingHours: '',
}

const fieldDefinitions: {
  key: keyof FormFields
  label: string
  max: number
  min?: number
  multiline?: boolean
}[] = [
  { key: 'providerName', label: 'Provider name', min: 3, max: 180 },
  { key: 'city', label: 'Base city', min: 2, max: 100 },
  { key: 'state', label: 'Base state', min: 2, max: 100 },
  { key: 'phone', label: 'Provider phone', max: 30 },
  {
    key: 'description',
    label: 'Description',
    max: 5000,
    multiline: true,
  },
  {
    key: 'animalRestrictions',
    label: 'Animal restrictions',
    max: 1000,
    multiline: true,
  },
  {
    key: 'openingHours',
    label: 'Operating hours',
    max: 1000,
    multiline: true,
  },
]

function AdminAmbulanceEditor() {
  const { id } = useParams()
  const [listing, setListing] = useState<Listing | null>(null)
  const [fields, setFields] = useState<FormFields>(emptyFields)
  const [species, setSpecies] = useState<string[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [mustReload, setMustReload] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [accessStatus, setAccessStatus] =
    useState<401 | 403 | null>(null)
  const inFlight = useRef(false)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setListing(null)
      setError('')
      setMessage('')
      setAccessStatus(null)

      try {
        if (!id) throw new Error('Listing ID is missing.')

        const response = await fetch(
          `/api/admin/ambulances/${encodeURIComponent(id)}`,
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
          throw new Error(result.message ?? 'Could not load listing.')
        }

        const item = result.listing

        if (
          typeof item?.id !== 'string' ||
          !Number.isInteger(item.version) ||
          !Array.isArray(item.species) ||
          !Array.isArray(item.serviceAreas)
        ) {
          throw new Error('Unexpected listing response.')
        }

        if (controller.signal.aborted) return

        setListing(item)
        setFields({
          providerName: item.providerName,
          description: item.description ?? '',
          animalRestrictions: item.animalRestrictions ?? '',
          city: item.city,
          state: item.state,
          phone: item.phone ?? '',
          openingHours: item.openingHours ?? '',
        })
        setSpecies(item.species)
        setAreas(
          item.serviceAreas.map((area: {
            city: string
            state: string
          }) => ({
            key: crypto.randomUUID(),
            city: area.city,
            state: area.state,
          })),
        )
        setReason('')
        setDirty(false)
        setMustReload(false)
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(
            error instanceof Error ? error.message : 'Could not load.',
          )
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [id, refresh])

  useEffect(() => {
    if (!dirty && !saving) return

    function warn(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, saving])

  function changed() {
    setDirty(true)
    setError('')
    setMessage('')
  }

  const editable =
    listing !== null &&
    listing.status !== 'PUBLISHED' &&
    listing.countryCode === 'IN' &&
    listing.verificationStatus !== 'SUSPENDED' &&
    (
      listing.isDemo ||
      ['NOT_SUBMITTED', 'REJECTED'].includes(
        listing.verificationStatus,
      )
    )

  const locked = saving || mustReload || !editable

  async function save() {
    if (!listing || inFlight.current || locked) return

    if (species.length === 0 || areas.length === 0) {
      setError('Choose at least one species and one service area.')
      return
    }

    if (reason.trim().length < 5) {
      setError('Enter a reason of at least 5 characters.')
      return
    }

    inFlight.current = true
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch(
        `/api/admin/ambulances/${encodeURIComponent(listing.id)}`,
        {
          method: 'PUT',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...fields,
            phone: listing.isDemo ? '' : fields.phone,
            version: listing.version,
            species,
            serviceAreas: areas.map((area) => ({
              city: area.city,
              state: area.state,
            })),
            reason,
          }),
        },
      )

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        if (response.status === 409 || response.status >= 500) {
          setMustReload(true)
        }
        setError(result?.message ?? 'Could not save the listing.')
        return
      }

      if (
        result?.listing?.id !== listing.id ||
        result.listing.version !== listing.version + 1
      ) {
        setMustReload(true)
        setError('Could not verify the save. Reload to check the result.')
        return
      }

      setListing({
        ...listing,
        version: result.listing.version,
        status: result.listing.status,
      })
      setDirty(false)
      setReason('')
      setMessage('Details saved. The listing has not been republished.')
    } catch {
      setMustReload(true)
      setError(
        'The connection was interrupted. Reload to check whether your changes were saved.',
      )
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  return (
    <main className="page-width vet-editor-main">
      <Link
        className="text-link"
        to="/admin/ambulances"
        onClick={(event) => {
          if (
            saving ||
            (dirty && !window.confirm('Leave with unsaved changes?'))
          ) {
            event.preventDefault()
          }
        }}
      >
        Back to Manage ambulances
      </Link>

      <div className="vet-editor-heading">
        <p className="eyebrow">ADMINISTRATION</p>
        <h1>Edit ambulance listing</h1>
        {listing && (
          <p>
            {listing.isDemo ? 'Fictional demo' : 'Real provider'}
            {' · '}{listing.status}
            {' · Time zone: '}{listing.timeZone}
          </p>
        )}
      </div>

      {loading && <p role="status">Loading listing…</p>}

      {accessStatus && (
        <p role="alert">
          An administrator account is required.{' '}
          <Link to={accessStatus === 401 ? '/login' : '/account'}>
            {accessStatus === 401 ? 'Sign in' : 'My account'}
          </Link>
        </p>
      )}

      {error && (
        <p className="vet-editor-error" role="alert">{error}</p>
      )}

      {message && <p role="status">{message}</p>}

      {!loading && !accessStatus && (
        <button
          className="button dark-button"
          type="button"
          disabled={saving}
          onClick={() => {
            if (
              !dirty ||
              window.confirm('Reload and replace your unsaved changes?')
            ) {
              setRefresh((value) => value + 1)
            }
          }}
        >
          Reload saved details
        </button>
      )}

      {!loading && listing && (
        <>
          {!editable && (
            <p className="vet-editor-notice">
              {listing.status === 'PUBLISHED'
                ? 'Archive this listing in Manage ambulances before editing.'
                : 'This listing is locked by its verification status or country.'}
            </p>
          )}

          {mustReload && (
            <p>Reload the saved details before editing again.</p>
          )}

          <form
            className="vet-editor-form"
            onSubmit={(event) => {
              event.preventDefault()
              void save()
            }}
          >
            <fieldset disabled={locked}>
              <legend>Provider details</legend>

              {fieldDefinitions
                .filter(
                  (field) => field.key !== 'phone' || !listing.isDemo,
                )
                .map((field) => (
                  <div className="vet-editor-field" key={field.key}>
                    <label htmlFor={`ambulance-${field.key}`}>
                      {field.label}
                    </label>

                    {field.multiline ? (
                      <textarea
                        id={`ambulance-${field.key}`}
                        value={fields[field.key]}
                        maxLength={field.max}
                        rows={3}
                        onChange={(event) => {
                          setFields((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                          changed()
                        }}
                      />
                    ) : (
                      <input
                        id={`ambulance-${field.key}`}
                        type={field.key === 'phone' ? 'tel' : 'text'}
                        value={fields[field.key]}
                        minLength={field.min}
                        maxLength={field.max}
                        required
                        onChange={(event) => {
                          setFields((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                          changed()
                        }}
                      />
                    )}
                  </div>
                ))}

              <p>Operating hours are descriptive text in the clinic’s time zone.</p>

              <fieldset>
                <legend>Supported species</legend>
                {['CAT', 'DOG', 'TURTLE'].map((value) => (
                  <label
                    key={value}
                    style={{ display: 'block', margin: '0.5rem 0' }}
                  >
                    <input
                      type="checkbox"
                      checked={species.includes(value)}
                      onChange={() => {
                        setSpecies((current) =>
                          current.includes(value)
                            ? current.filter((item) => item !== value)
                            : [...current, value],
                        )
                        changed()
                      }}
                    />
                    {' '}{value}
                  </label>
                ))}
              </fieldset>

              <h2>Service areas</h2>
              <p>
                List each supported city and state. Changing the base
                location does not automatically change coverage.
              </p>

              {areas.map((area, index) => (
                <fieldset key={area.key} style={{ marginBottom: '1rem' }}>
                  <legend>Area {index + 1}</legend>

                  {(['city', 'state'] as const).map((field) => (
                    <div className="vet-editor-field" key={field}>
                      <label htmlFor={`${area.key}-${field}`}>
                        {field === 'city' ? 'City' : 'State'}
                      </label>
                      <input
                        id={`${area.key}-${field}`}
                        value={area[field]}
                        minLength={2}
                        maxLength={100}
                        required
                        onChange={(event) => {
                          setAreas((current) =>
                            current.map((item) =>
                              item.key === area.key
                                ? { ...item, [field]: event.target.value }
                                : item,
                            ),
                          )
                          changed()
                        }}
                      />
                    </div>
                  ))}

                  <button
                    className="button dark-button"
                    type="button"
                    onClick={() => {
                      setAreas((current) =>
                        current.filter((item) => item.key !== area.key),
                      )
                      changed()
                    }}
                  >
                    Remove area
                  </button>
                </fieldset>
              ))}

              <button
                className="button dark-button"
                type="button"
                disabled={areas.length >= 30}
                onClick={() => {
                  setAreas((current) => [
                    ...current,
                    { key: crypto.randomUUID(), city: '', state: '' },
                  ])
                  changed()
                }}
              >
                Add service area
              </button>

              <div className="vet-editor-field">
                <label htmlFor="ambulance-edit-reason">
                  Reason for this change *
                </label>
                <textarea
                  id="ambulance-edit-reason"
                  value={reason}
                  minLength={5}
                  maxLength={1000}
                  rows={3}
                  required
                  onChange={(event) => {
                    setReason(event.target.value)
                    changed()
                  }}
                />
              </div>

              <button
                className="button dark-button"
                type="submit"
                disabled={!dirty}
              >
                {saving ? 'Saving…' : 'Save listing details'}
              </button>
            </fieldset>
          </form>
        </>
      )}
    </main>
  )
}

export default AdminAmbulanceEditor