import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import './AdminVetEditor.css'

type Clinic = {
  clinicName: string
  timeZone: string
  availabilityVersion: number
  availabilityEnabled: boolean
}

type Block = {
  key: string
  startsAt: string
  endsAt: string
  reason: string
}

function localInput(value: string) {
  const date = new Date(value)
  const pad = (number: number) => String(number).padStart(2, '0')

  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  ].join('T')
}

function clinicTime(value: string, timeZone: string) {
  const date = new Date(value)

  if (!Number.isFinite(date.getTime())) return 'Choose a valid time'

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(date)
}

function VetBlockedDates() {
  const [clinic, setClinic] = useState<Clinic | null>(null)
  const [blocks, setBlocks] = useState<Block[]>([])
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
      setClinic(null)
      setError('')
      setMessage('')
      setAccessStatus(null)

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
          throw new Error(data.message ?? 'Could not load blocked dates.')
        }

        if (
          !data.clinic ||
          !Number.isInteger(data.clinic.availabilityVersion) ||
          typeof data.clinic.timeZone !== 'string' ||
          !Array.isArray(data.blocks)
        ) {
          throw new Error('Unexpected schedule response.')
        }

        if (data.hasMoreBlocks) {
          throw new Error(
            'There are more than 100 blocked periods. This editor cannot safely load the full schedule.',
          )
        }

        new Intl.DateTimeFormat(undefined, {
          timeZone: data.clinic.timeZone,
        })

        const loaded = data.blocks.map(
          (block: {
            startsAt: string
            endsAt: string
            reason: string | null
          }) => ({
            key: crypto.randomUUID(),
            startsAt: block.startsAt,
            endsAt: block.endsAt,
            reason: block.reason ?? '',
          }),
        )

        if (controller.signal.aborted) return

        setClinic(data.clinic)
        setBlocks(loaded)
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
  }, [refresh])

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

  function updateBlock(
    key: string,
    field: 'startsAt' | 'endsAt' | 'reason',
    value: string,
  ) {
    let stored = value

    if (field !== 'reason' && value) {
      const date = new Date(value)
      if (!Number.isFinite(date.getTime())) return
      stored = date.toISOString()
    }

    setBlocks((current) =>
      current.map((block) =>
        block.key === key ? { ...block, [field]: stored } : block,
      ),
    )
    changed()
  }

  async function save() {
    if (!clinic || inFlight.current || mustReload) return

    const payload = blocks.map((block) => ({
      startsAt: block.startsAt,
      endsAt: block.endsAt,
      reason: block.reason.trim(),
    }))

    if (
      payload.some((block) => {
        const start = Date.parse(block.startsAt)
        const end = Date.parse(block.endsAt)
        return (
          !Number.isFinite(start) ||
          !Number.isFinite(end) ||
          end <= start ||
          end <= Date.now()
        )
      })
    ) {
      setError(
        'Each period must have valid start/end times, end after it starts, and not have already ended.',
      )
      return
    }

    inFlight.current = true
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch('/api/provider/availability/blocks', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: clinic.availabilityVersion,
          blocks: payload,
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        if (response.status === 409 || response.status >= 500) {
          setMustReload(true)
        }
        setError(data?.message ?? 'Could not save blocked dates.')
        return
      }

      if (
        data?.availabilityVersion !== clinic.availabilityVersion + 1
      ) {
        setMustReload(true)
        setError('Could not verify the save. Reload to check the result.')
        return
      }

      setClinic({
        ...clinic,
        availabilityVersion: data.availabilityVersion,
      })
      setDirty(false)
      setMessage('Draft blocked dates saved. Restrictions are not active yet.')
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

  const locked = saving || mustReload || !!clinic?.availabilityEnabled

  return (
    <main className="page-width vet-editor-main">
      <Link
        className="text-link"
        to="/provider/availability"
        onClick={(event) => {
          if (
            saving ||
            (dirty && !window.confirm('Leave with unsaved changes?'))
          ) {
            event.preventDefault()
          }
        }}
      >
        Back to working hours
      </Link>

      <div className="vet-editor-heading">
        <p className="eyebrow">VET AVAILABILITY</p>
        <h1>Blocked dates</h1>
        {clinic && (
          <p>{clinic.clinicName} · Clinic time zone: {clinic.timeZone}</p>
        )}
      </div>

      {loading && <p role="status">Loading blocked dates…</p>}

      {accessStatus && (
        <p>
          An active vet account is required.{' '}
          <Link to={accessStatus === 401 ? '/login' : '/account'}>
            {accessStatus === 401 ? 'Sign in' : 'My account'}
          </Link>
        </p>
      )}

      {error && <p className="vet-editor-error" role="alert">{error}</p>}
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
          Reload saved blocks
        </button>
      )}

      {!loading && clinic && (
        <>
          <p className="vet-editor-notice">
            Draft settings only. Existing appointments are unchanged.
            Enter dates in your device’s time zone:{' '}
            {Intl.DateTimeFormat().resolvedOptions().timeZone}.
            Check the clinic-time preview before saving.
          </p>

          {mustReload && <p>Reload before making further changes.</p>}
          {clinic.availabilityEnabled && (
            <p>Active availability cannot be edited in this draft editor.</p>
          )}

          <form
            className="vet-editor-form"
            onSubmit={(event) => {
              event.preventDefault()
              void save()
            }}
          >
            {blocks.length === 0 && <p>No current or future blocks.</p>}

            {blocks.map((block, index) => (
              <fieldset
                key={block.key}
                disabled={locked}
                style={{ padding: '1rem', marginBottom: '1rem' }}
              >
                <legend>Blocked period {index + 1}</legend>

                <div className="vet-editor-field">
                  <label htmlFor={`start-${block.key}`}>Start</label>
                  <input
                    id={`start-${block.key}`}
                    type="datetime-local"
                    step={60}
                    required
                    value={block.startsAt ? localInput(block.startsAt) : ''}
                    onChange={(event) =>
                      updateBlock(block.key, 'startsAt', event.target.value)
                    }
                  />
                </div>

                <div className="vet-editor-field">
                  <label htmlFor={`end-${block.key}`}>End</label>
                  <input
                    id={`end-${block.key}`}
                    type="datetime-local"
                    step={60}
                    required
                    value={block.endsAt ? localInput(block.endsAt) : ''}
                    onChange={(event) =>
                      updateBlock(block.key, 'endsAt', event.target.value)
                    }
                  />
                </div>

                {block.startsAt && block.endsAt && (
                  <p>
                    Clinic time: {clinicTime(block.startsAt, clinic.timeZone)}
                    {' → '}
                    {clinicTime(block.endsAt, clinic.timeZone)}
                  </p>
                )}

                <div className="vet-editor-field">
                  <label htmlFor={`reason-${block.key}`}>
                    Internal reason (optional)
                  </label>
                  <input
                    id={`reason-${block.key}`}
                    value={block.reason}
                    maxLength={500}
                    onChange={(event) =>
                      updateBlock(block.key, 'reason', event.target.value)
                    }
                  />
                </div>

                <button
                  className="button dark-button"
                  type="button"
                  onClick={() => {
                    setBlocks((current) =>
                      current.filter((item) => item.key !== block.key),
                    )
                    changed()
                  }}
                >
                  Remove period
                </button>
              </fieldset>
            ))}

            <div className="vet-editor-actions">
              <button
                className="button dark-button"
                type="button"
                disabled={locked || blocks.length >= 100}
                onClick={() => {
                  setBlocks((current) => [
                    ...current,
                    {
                      key: crypto.randomUUID(),
                      startsAt: '',
                      endsAt: '',
                      reason: '',
                    },
                  ])
                  changed()
                }}
              >
                Add blocked period
              </button>

              <button
                className="button dark-button"
                type="submit"
                disabled={locked || !dirty}
              >
                {saving ? 'Saving…' : 'Save draft blocks'}
              </button>
            </div>
          </form>
        </>
      )}
    </main>
  )
}

export default VetBlockedDates