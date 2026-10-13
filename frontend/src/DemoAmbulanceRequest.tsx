import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import './AdminVetEditor.css'

type DemoProvider = {
  id: string
  providerName: string
  city: string
  state: string
  isDemo: boolean
  species: string[]
  serviceAreas: {
    city: string
    state: string
  }[]
}

type SimulationReceipt = {
  reference: string
  providerName: string
  petSpecies: string
  pickupCity: string
  destinationCity: string
  requestedPickupAt: string
}

function DemoAmbulanceRequest() {
  const { id } = useParams()
  const [provider, setProvider] = useState<DemoProvider | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [empty, setEmpty] = useState(false)
  const [reload, setReload] = useState(0)
  const [petSpecies, setPetSpecies] = useState('')
  const [pickupCity, setPickupCity] = useState('')
  const [destinationCity, setDestinationCity] = useState('')
  const [pickupTime, setPickupTime] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [receipt, setReceipt] = useState<SimulationReceipt | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadProvider() {
      setLoading(true)
      setError('')
      setEmpty(false)
      setProvider(null)

      try {
        if (!id) {
          setEmpty(true)
          return
        }

        const response = await fetch(
          `/api/ambulances?id=${encodeURIComponent(id)}`,
          {
            cache: 'no-store',
            signal: controller.signal,
          },
        )

        const result = await response.json().catch(() => null)

        if (controller.signal.aborted) return

        if (!response.ok) {
          throw new Error(
            typeof result?.message === 'string'
              ? result.message
              : 'Could not load the demo listing.',
          )
        }

        if (!Array.isArray(result?.ambulances)) {
          throw new Error('Unexpected directory response.')
        }

        const match = result.ambulances.find(
          (candidate: DemoProvider) =>
            candidate.id === id && candidate.isDemo === true,
        )

        if (!match) {
          setEmpty(true)
          return
        }

        setProvider(match)
        setPickupCity(match.city)
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Could not load the demo listing.',
          )
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadProvider()
    return () => controller.abort()
  }, [id, reload])

  function submitSimulation() {
    if (
      !provider ||
      !petSpecies ||
      !pickupCity.trim() ||
      !destinationCity.trim() ||
      !pickupTime ||
      !acknowledged
    ) {
      setError('Complete the demo fields and confirm the safety notice.')
      return
    }

    if (!provider.species.includes(petSpecies)) {
      setError('Choose a species supported by this demo listing.')
      return
    }

    const requestedPickupAt = new Date(pickupTime)
    const now = Date.now()

    if (
      !Number.isFinite(requestedPickupAt.getTime()) ||
      requestedPickupAt.getTime() < now + 15 * 60 * 1000 ||
      requestedPickupAt.getTime() > now + 7 * 24 * 60 * 60 * 1000
    ) {
      setError('Choose a demo pickup time between 15 minutes and 7 days ahead.')
      return
    }

    setError('')
    setReceipt({
      reference: `DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      providerName: provider.providerName,
      petSpecies,
      pickupCity: pickupCity.trim(),
      destinationCity: destinationCity.trim(),
      requestedPickupAt: requestedPickupAt.toISOString(),
    })
  }

  function resetSimulation() {
    setReceipt(null)
    setPetSpecies('')
    setDestinationCity('')
    setPickupTime('')
    setAcknowledged(false)
    setError('')
  }

  return (
    <main className="page-width vet-editor-main">
      <Link className="text-link" to="/ambulances">
        Back to transport directory
      </Link>

      <div className="vet-editor-heading">
        <p className="eyebrow">DEMO — Not a real ambulance service</p>
        <h1>Simulate an ambulance request</h1>
        {provider && <p>{provider.providerName}</p>}
      </div>

      <p className="vet-editor-notice">
        This simulation does not contact a provider, save a transport
        request, reserve a vehicle, or dispatch an ambulance. Do not use
        it for an emergency or real transport need.
      </p>

      {loading && <p role="status">Loading demo request…</p>}

      {error && (
        <p className="vet-editor-error" role="alert">{error}</p>
      )}

      {!loading && error && !provider && (
        <button
          className="button dark-button"
          type="button"
          onClick={() => setReload((value) => value + 1)}
        >
          Retry
        </button>
      )}

      {!loading && empty && (
        <section className="vet-editor-summary">
          <h2>Demo listing unavailable</h2>
          <p>
            This listing is missing, is no longer public, or is not a
            demo. No request was sent.
          </p>
        </section>
      )}

      {!loading && provider && receipt && (
        <section className="vet-editor-summary" aria-live="polite">
          <p className="eyebrow">SIMULATION ONLY</p>
          <h2>Simulation complete — no request was sent</h2>
          <p>
            No ambulance has been booked, contacted, reserved, or
            dispatched.
          </p>
          <p><strong>Simulation reference:</strong> {receipt.reference}</p>
          <p><strong>Fictional provider:</strong> {receipt.providerName}</p>
          <p><strong>Pet species:</strong> {receipt.petSpecies}</p>
          <p>
            <strong>Scenario:</strong> {receipt.pickupCity} to{' '}
            {receipt.destinationCity}
          </p>
          <p>
            <strong>Requested demo time:</strong>{' '}
            {new Date(receipt.requestedPickupAt).toLocaleString('en-IN')}
          </p>
          <p>
            This reference exists only on this screen and is not stored
            as a real or demo transport request.
          </p>
          <button
            className="button dark-button"
            type="button"
            onClick={resetSimulation}
          >
            Start another simulation
          </button>
        </section>
      )}

      {!loading && provider && !receipt && (
        <form
          className="vet-editor-form"
          onSubmit={(event) => {
            event.preventDefault()
            submitSimulation()
          }}
        >
          <p>
            Scenario details stay on this page. They are not sent to the
            transport-request API or stored in the database.
          </p>

          <p>
            <strong>Demo coverage:</strong>{' '}
            {provider.serviceAreas.length > 0
              ? provider.serviceAreas
                  .map((area) => `${area.city}, ${area.state}`)
                  .join('; ')
              : `${provider.city}, ${provider.state}`}
          </p>

          <div className="vet-editor-field">
            <label htmlFor="demo-pet-species">Pet species *</label>
            <select
              id="demo-pet-species"
              value={petSpecies}
              required
              onChange={(event) => setPetSpecies(event.target.value)}
            >
              <option value="">Choose a species</option>
              {provider.species.map((species) => (
                <option key={species} value={species}>
                  {species.charAt(0) + species.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="vet-editor-field">
            <label htmlFor="demo-pickup-city">Pickup city *</label>
            <input
              id="demo-pickup-city"
              value={pickupCity}
              minLength={2}
              maxLength={100}
              required
              onChange={(event) => setPickupCity(event.target.value)}
            />
          </div>

          <div className="vet-editor-field">
            <label htmlFor="demo-destination-city">Destination city *</label>
            <input
              id="demo-destination-city"
              value={destinationCity}
              minLength={2}
              maxLength={100}
              required
              onChange={(event) => setDestinationCity(event.target.value)}
            />
          </div>

          <div className="vet-editor-field">
            <label htmlFor="demo-pickup-time">Demo pickup time *</label>
            <input
              id="demo-pickup-time"
              type="datetime-local"
              value={pickupTime}
              required
              onChange={(event) => setPickupTime(event.target.value)}
            />
            <p>Choose a time 15 minutes to 7 days ahead.</p>
          </div>

          <label htmlFor="demo-safety-acknowledgement">
            <input
              id="demo-safety-acknowledgement"
              type="checkbox"
              checked={acknowledged}
              required
              onChange={(event) => setAcknowledged(event.target.checked)}
            />{' '}
            I understand this is only a simulation and no ambulance will
            be booked, contacted, or dispatched.
          </label>

          <button className="button dark-button" type="submit">
            Complete simulated request
          </button>
        </form>
      )}
    </main>
  )
}

export default DemoAmbulanceRequest
