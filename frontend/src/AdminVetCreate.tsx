import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import './AdminVetEditor.css'

type Species = 'CAT' | 'DOG' | 'TURTLE'

type DraftForm = {
  providerEmail: string
  slug: string
  vetName: string
  clinicName: string
  addressLine1: string
  city: string
  state: string
  species: Species[]
  isDemo: boolean
}

type TextField = Exclude<keyof DraftForm, 'species' | 'isDemo'>

const initialForm: DraftForm = {
  providerEmail: '',
  slug: '',
  vetName: '',
  clinicName: '',
  addressLine1: '',
  city: '',
  state: '',
  species: [],
  isDemo: true,
}

const fields: {
  key: TextField
  label: string
  maxLength: number
  minLength?: number
  type?: 'text' | 'email'
  help?: string
}[] = [
  {
    key: 'providerEmail',
    label: 'Provider account email',
    type: 'email',
    maxLength: 254,
    help: 'Use an existing active VET account that does not already own a listing.',
  },
  {
    key: 'slug',
    label: 'Listing slug',
    minLength: 3,
    maxLength: 180,
    help: 'Use lowercase letters, numbers, and hyphens. Example: demo-mumbai-pet-clinic. The slug cannot be changed in the editor.',
  },
  {
    key: 'vetName',
    label: 'Vet name',
    minLength: 2,
    maxLength: 150,
  },
  {
    key: 'clinicName',
    label: 'Clinic name',
    minLength: 2,
    maxLength: 180,
  },
  {
    key: 'addressLine1',
    label: 'Address line 1',
    minLength: 2,
    maxLength: 200,
  },
  {
    key: 'city',
    label: 'City',
    minLength: 2,
    maxLength: 100,
  },
  {
    key: 'state',
    label: 'State',
    minLength: 2,
    maxLength: 100,
  },
]

const speciesOptions: { value: Species; label: string }[] = [
  { value: 'CAT', label: 'Cats' },
  { value: 'DOG', label: 'Dogs' },
  { value: 'TURTLE', label: 'Turtles' },
]

function AdminVetCreate() {
  const navigate = useNavigate()

  const [form, setForm] = useState<DraftForm>(initialForm)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [accessDenied, setAccessDenied] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uncertainResult, setUncertainResult] = useState(false)
  const [retry, setRetry] = useState(0)

  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm)

  useEffect(() => {
    const controller = new AbortController()

    async function checkAccess() {
      setLoading(true)
      setLoadError('')
      setAccessDenied(false)

      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        })

        if (controller.signal.aborted) return

        if (response.status === 401) {
          navigate('/login', { replace: true })
          return
        }

        if (!response.ok) {
          throw new Error('Could not check your account.')
        }

        const data = await response.json()

        if (!data?.user?.id) {
          throw new Error('Invalid account response.')
        }

        if (!controller.signal.aborted) {
          setAccessDenied(
            data.user.role !== 'ADMIN' ||
              data.user.status !== 'ACTIVE',
          )
        }
      } catch {
        if (!controller.signal.aborted) {
          setLoadError(
            'Could not check your access. Please try again.',
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void checkAccess()

    return () => controller.abort()
  }, [navigate, retry])

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

  function updateField(key: TextField, value: string) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function toggleSpecies(species: Species) {
    setForm((current) => {
      const selected = new Set(current.species)

      if (selected.has(species)) {
        selected.delete(species)
      } else {
        selected.add(species)
      }

      return {
        ...current,
        species: speciesOptions
          .map((option) => option.value)
          .filter((value) => selected.has(value)),
      }
    })
  }

  async function createListing() {
    if (saving || uncertainResult) return

    if (form.species.length === 0) {
      setError('Choose at least one pet group.')
      return
    }

    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
        form.slug.trim().toLowerCase(),
      )
    ) {
      setError(
        'Use lowercase letters, numbers, and single hyphens between words for the slug.',
      )
      return
    }

    const confirmation = form.isDemo
      ? 'Create this fictional demo draft?'
      : 'Create a real provider draft? Use this only for an actual provider. Verification and publication are separate steps.'

    if (!window.confirm(confirmation)) return

    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/admin/vets', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...form,
          providerEmail: form.providerEmail.trim().toLowerCase(),
          slug: form.slug.trim().toLowerCase(),
          vetName: form.vetName.trim(),
          clinicName: form.clinicName.trim(),
          addressLine1: form.addressLine1.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
        }),
      })

      if (response.status === 401) {
        navigate('/login', { replace: true })
        return
      }

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        if (response.status >= 500) {
          setUncertainResult(true)
        }

        setError(
          typeof data?.message === 'string'
            ? data.message
            : 'Could not create the listing.',
        )
        return
      }

      if (typeof data?.vet?.id !== 'string') {
        setUncertainResult(true)
        setError(
          'Could not confirm the result. Check Manage vets before trying again.',
        )
        return
      }

      setForm(initialForm)

      navigate(`/admin/vets/${encodeURIComponent(data.vet.id)}`, {
        replace: true,
      })
    } catch {
      setUncertainResult(true)
      setError(
        'The connection was interrupted. The draft may have been created. Check Manage vets before trying again.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="page-width vet-editor-main" role="status">
        Checking administrator access…
      </main>
    )
  }

  if (loadError) {
    return (
      <main className="page-width vet-editor-main">
        <p className="vet-editor-error" role="alert">
          {loadError}
        </p>

        <button
          className="button dark-button"
          type="button"
          onClick={() => setRetry((value) => value + 1)}
        >
          Try again
        </button>
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

  const locked = saving || uncertainResult

  return (
    <main className="page-width vet-editor-main">
      <Link
        className="text-link"
        to="/admin/vets"
        onClick={(event) => {
          if (
            saving ||
            (dirty &&
              !window.confirm(
                'Leave this form? Copy any details you want to keep first.',
              ))
          ) {
            event.preventDefault()
          }
        }}
      >
        Back to vet listings
      </Link>

      <div className="vet-editor-heading">
        <p className="eyebrow">THE PROVIDER DESK</p>
        <h1>Create a listing.</h1>
        <p>
          Start with a draft, then complete its details in the editor.
        </p>
      </div>

      <p className="vet-editor-notice">
        Each provider account can own one listing. Creating a draft
        does not verify the provider or make it publicly visible.
      </p>

      {error && (
        <div className="vet-editor-error">
          <p role="alert">{error}</p>

          {uncertainResult && (
            <p>
              <Link
                className="text-link"
                to="/admin/vets"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Manage vets in a new tab
              </Link>
              {' '}to check whether the draft exists. This form remains
              open so you can copy its details.
            </p>
          )}
        </div>
      )}

      <form
        className="vet-editor-form"
        aria-busy={saving}
        onSubmit={(event) => {
          event.preventDefault()
          void createListing()
        }}
      >
        <div className="vet-editor-field">
          <label htmlFor="new-vet-kind">Listing type *</label>

          <select
            id="new-vet-kind"
            value={form.isDemo ? 'demo' : 'real'}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                isDemo: event.target.value === 'demo',
              }))
            }
            disabled={locked}
          >
            <option value="demo">Demo — fictional test listing</option>
            <option value="real">Real provider — requires verification</option>
          </select>

          <small>
            Demo status cannot be changed in the listing editor.
            Keep fictional records marked as Demo.
          </small>
        </div>

        <div className="vet-editor-grid">
          {fields.map((field) => (
            <div className="vet-editor-field" key={field.key}>
              <label htmlFor={`new-vet-${field.key}`}>
                {field.label} *
              </label>

              <input
                id={`new-vet-${field.key}`}
                type={field.type ?? 'text'}
                value={form[field.key]}
                onChange={(event) =>
                  updateField(field.key, event.target.value)
                }
                required
                minLength={field.minLength}
                maxLength={field.maxLength}
                disabled={locked}
                aria-describedby={
                  field.help ? `new-vet-${field.key}-help` : undefined
                }
              />

              {field.help && (
                <small id={`new-vet-${field.key}-help`}>
                  {field.help}
                </small>
              )}
            </div>
          ))}
        </div>

        <fieldset className="vet-editor-species" disabled={locked}>
          <legend>Animals treated *</legend>

          <div className="vet-editor-species-options">
            {speciesOptions.map((option) => (
              <label key={option.value}>
                <input
                  type="checkbox"
                  checked={form.species.includes(option.value)}
                  onChange={() => toggleSpecies(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>

          <p>Choose at least one pet group.</p>
        </fieldset>

        <p>
          New listings start with country code IN. You can change it
          and add contact information in the draft editor.
        </p>

        <button
          className="button dark-button"
          type="submit"
          disabled={locked}
        >
          {saving ? 'Creating draft…' : 'Create draft'}
        </button>
      </form>
    </main>
  )
}

export default AdminVetCreate