import { useRef, useState } from 'react'
import { Link } from 'react-router'
import './AdminVetEditor.css'

function AdminAmbulanceCreate() {
  const [providerName, setProviderName] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [phone, setPhone] = useState('')
  const [isDemo, setIsDemo] = useState(true)
  const [species, setSpecies] = useState<string[]>([])
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [error, setError] = useState('')
  const [createdId, setCreatedId] = useState('')
  const inFlight = useRef(false)

  function toggleSpecies(value: string) {
    setSpecies((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    )
  }

  async function save() {
    if (inFlight.current || uncertain || createdId) return

    if (species.length === 0) {
      setError('Choose at least one supported species.')
      return
    }

    inFlight.current = true
    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/admin/ambulances', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerName: providerName.trim(),
          city: city.trim(),
          state: state.trim(),
          phone: isDemo ? null : phone.trim(),
          species,
          isDemo,
          reason: reason.trim(),
        }),
      })

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        if (response.status >= 500) setUncertain(true)

        setError(
          result?.message ??
            'Could not create the listing. Check your administrator login.',
        )
        return
      }

      if (typeof result?.listing?.id !== 'string') {
        setUncertain(true)
        setError('Could not verify the result. Check Manage ambulances.')
        return
      }

      setCreatedId(result.listing.id)
    } catch {
      setUncertain(true)
      setError(
        'The connection was interrupted. Check Manage ambulances before creating another listing.',
      )
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  const locked = saving || uncertain || !!createdId

  return (
    <main className="page-width vet-editor-main">
      <Link className="text-link" to="/admin/ambulances">
        Back to Manage ambulances
      </Link>

      <div className="vet-editor-heading">
        <p className="eyebrow">ADMINISTRATION</p>
        <h1>Create ambulance listing</h1>
        <p>
          New listings are drafts. The base city will also be added
          as the initial service area.
        </p>
      </div>

      {error && (
        <p className="vet-editor-error" role="alert">{error}</p>
      )}

      {uncertain && (
        <p className="vet-editor-notice">
          Saving is paused because the result is uncertain. Open
          Manage ambulances and check whether the draft exists
          before submitting again.
        </p>
      )}

      {createdId ? (
        <div className="vet-editor-summary">
          <h2>Draft listing created.</h2>
          <p>It is not publicly visible and cannot receive requests.</p>
          <p style={{ overflowWrap: 'anywhere' }}>
            <strong>Reference:</strong> {createdId}
          </p>
          <Link className="button dark-button" to="/admin/ambulances">
            Manage ambulances
          </Link>
        </div>
      ) : (
        <form
          className="vet-editor-form"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <div className="vet-editor-field">
            <label htmlFor="ambulance-type">Listing type</label>
            <select
              id="ambulance-type"
              value={isDemo ? 'demo' : 'real'}
              disabled={locked}
              onChange={(event) => {
                setIsDemo(event.target.value === 'demo')
                setPhone('')
              }}
            >
              <option value="demo">Fictional demo</option>
              <option value="real">Real provider</option>
            </select>
          </div>

          <div className="vet-editor-field">
            <label htmlFor="ambulance-name">Provider name *</label>
            <input
              id="ambulance-name"
              value={providerName}
              onChange={(event) => setProviderName(event.target.value)}
              minLength={3}
              maxLength={180}
              required
              disabled={locked}
            />
          </div>

          <div className="vet-editor-field">
            <label htmlFor="ambulance-city">Base and initial coverage city *</label>
            <input
              id="ambulance-city"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              minLength={2}
              maxLength={100}
              required
              disabled={locked}
            />
          </div>

          <div className="vet-editor-field">
            <label htmlFor="ambulance-state">State *</label>
            <input
              id="ambulance-state"
              value={state}
              onChange={(event) => setState(event.target.value)}
              minLength={2}
              maxLength={100}
              required
              disabled={locked}
            />
          </div>

          {!isDemo && (
            <div className="vet-editor-field">
              <label htmlFor="ambulance-phone">Provider phone *</label>
              <input
                id="ambulance-phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                maxLength={30}
                required
                disabled={locked}
              />
            </div>
          )}

          <fieldset disabled={locked}>
            <legend>Supported species *</legend>

            {['CAT', 'DOG', 'TURTLE'].map((value) => (
              <label
                key={value}
                style={{ display: 'block', margin: '0.5rem 0' }}
              >
                <input
                  type="checkbox"
                  checked={species.includes(value)}
                  onChange={() => toggleSpecies(value)}
                />
                {' '}{value}
              </label>
            ))}
          </fieldset>

          <div className="vet-editor-field">
            <label htmlFor="ambulance-create-reason">
              Reason for creating this listing *
            </label>
            <textarea
              id="ambulance-create-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              minLength={5}
              maxLength={1000}
              required
              disabled={locked}
            />
          </div>

          <button
            className="button dark-button"
            type="submit"
            disabled={locked}
          >
            {saving ? 'Creating…' : 'Create draft listing'}
          </button>
        </form>
      )}
    </main>
  )
}

export default AdminAmbulanceCreate