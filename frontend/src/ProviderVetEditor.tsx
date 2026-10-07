import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import './AdminVetEditor.css'

type Species = 'CAT' | 'DOG' | 'TURTLE'

type ListingForm = {
  vetName: string
  clinicName: string
  qualifications: string
  registrationNumber: string
  registrationBody: string
  description: string
  species: Species[]
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  postalCode: string
  countryCode: string
  phone: string
  email: string
  websiteUrl: string
  openingHours: string
}

type TextField = Exclude<keyof ListingForm, 'species'>

type VetListing = {
  id: string
  vetName: string
  clinicName: string
  qualifications: string | null
  registrationNumber: string | null
  registrationBody: string | null
  description: string | null
  species: Species[]
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string
  postalCode: string | null
  countryCode: string
  phone: string | null
  email: string | null
  websiteUrl: string | null
  openingHours: string | null
  status: string
  verificationStatus: string
  isDemo: boolean
  updatedAt: string
}

const speciesOptions: { value: Species; label: string }[] = [
  { value: 'CAT', label: 'Cats' },
  { value: 'DOG', label: 'Dogs' },
  { value: 'TURTLE', label: 'Turtles' },
]

const fields: {
  key: TextField
  label: string
  maxLength: number
  minLength?: number
  required?: boolean
  type?: 'text' | 'email' | 'tel' | 'url'
}[] = [
  {
    key: 'vetName',
    label: 'Vet name',
    maxLength: 150,
    minLength: 2,
    required: true,
  },
  {
    key: 'clinicName',
    label: 'Clinic name',
    maxLength: 180,
    minLength: 2,
    required: true,
  },
  {
    key: 'qualifications',
    label: 'Qualifications',
    maxLength: 250,
  },
  {
    key: 'registrationNumber',
    label: 'Professional registration number',
    maxLength: 100,
  },
  {
    key: 'registrationBody',
    label: 'Registration body',
    maxLength: 180,
  },
  {
    key: 'addressLine1',
    label: 'Address line 1',
    maxLength: 200,
    minLength: 2,
    required: true,
  },
  {
    key: 'addressLine2',
    label: 'Address line 2',
    maxLength: 200,
  },
  {
    key: 'city',
    label: 'City',
    maxLength: 100,
    minLength: 2,
    required: true,
  },
  {
    key: 'state',
    label: 'State',
    maxLength: 100,
    minLength: 2,
    required: true,
  },
  {
    key: 'postalCode',
    label: 'Postal code',
    maxLength: 20,
  },
  {
    key: 'countryCode',
    label: 'Country code, such as IN',
    maxLength: 2,
    minLength: 2,
    required: true,
  },
  {
    key: 'phone',
    label: 'Public clinic phone',
    maxLength: 30,
    type: 'tel',
  },
  {
    key: 'email',
    label: 'Public clinic email',
    maxLength: 254,
    type: 'email',
  },
  {
    key: 'websiteUrl',
    label: 'Website URL',
    maxLength: 2048,
    type: 'url',
  },
]

function formFromListing(vet: VetListing): ListingForm {
  return {
    vetName: vet.vetName,
    clinicName: vet.clinicName,
    qualifications: vet.qualifications ?? '',
    registrationNumber: vet.registrationNumber ?? '',
    registrationBody: vet.registrationBody ?? '',
    description: vet.description ?? '',
    species: speciesOptions
      .map((option) => option.value)
      .filter((species) => vet.species.includes(species)),
    addressLine1: vet.addressLine1,
    addressLine2: vet.addressLine2 ?? '',
    city: vet.city,
    state: vet.state,
    postalCode: vet.postalCode ?? '',
    countryCode: vet.countryCode,
    phone: vet.phone ?? '',
    email: vet.email ?? '',
    websiteUrl: vet.websiteUrl ?? '',
    openingHours: vet.openingHours ?? '',
  }
}

function readableStatus(value: string) {
  return value.replaceAll('_', ' ').toLowerCase()
}

function ProviderVetEditor() {
  const navigate = useNavigate()

  const [vet, setVet] = useState<VetListing | null>(null)
  const [form, setForm] = useState<ListingForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [accessDenied, setAccessDenied] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [needsReload, setNeedsReload] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function loadListing() {
      setLoading(true)
      setLoadError('')
      setAccessDenied(false)

      try {
        const response = await fetch('/api/provider/vet', {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        })

        if (controller.signal.aborted) return

        if (response.status === 401) {
          navigate('/login', { replace: true })
          return
        }

        if (response.status === 403) {
          setAccessDenied(true)
          return
        }

        if (!response.ok) {
          throw new Error('Could not load your listing.')
        }

        const data = await response.json()

        if (data.vet === null) {
          if (!controller.signal.aborted) {
            setVet(null)
            setForm(null)
          }
          return
        }

        if (
          typeof data?.vet?.id !== 'string' ||
          !Array.isArray(data.vet.species) ||
          typeof data.vet.updatedAt !== 'string'
        ) {
          throw new Error('Invalid listing response.')
        }

        if (!controller.signal.aborted) {
          setVet(data.vet)
          setForm(formFromListing(data.vet))
          setNeedsReload(false)
          setError('')
          setSuccess('')
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(
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

    void loadListing()

    return () => controller.abort()
  }, [navigate, retry])

  const dirty =
    vet !== null &&
    form !== null &&
    JSON.stringify(form) !==
      JSON.stringify(formFromListing(vet))

  const editable =
    vet?.status === 'DRAFT' &&
    vet.verificationStatus !== 'SUBMITTED' &&
    vet.verificationStatus !== 'UNDER_REVIEW'

  const locked = !editable || saving || needsReload

  useEffect(() => {
    if (!dirty) return

    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', warnBeforeLeaving)

    return () => {
      window.removeEventListener(
        'beforeunload',
        warnBeforeLeaving,
      )
    }
  }, [dirty])

  function updateField(key: TextField, value: string) {
    setForm((current) =>
      current ? { ...current, [key]: value } : current,
    )
    setSuccess('')
  }

  function toggleSpecies(species: Species) {
    setForm((current) => {
      if (!current) return current

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

    setSuccess('')
  }

  function reloadListing() {
    if (saving) return

    if (
      dirty &&
      !window.confirm(
        'Reloading discards unsaved changes. Copy anything you want to keep first. Continue?',
      )
    ) {
      return
    }

    setRetry((value) => value + 1)
  }

  async function saveListing() {
    if (!vet || !form || locked || !dirty) return

    if (form.species.length === 0) {
      setError('Choose at least one pet group.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/provider/vet', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...form,
          updatedAt: vet.updatedAt,
        }),
      })

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
            : 'Could not save your listing.',
        )
        return
      }

      if (
        data?.vet?.id !== vet.id ||
        !Array.isArray(data.vet.species) ||
        typeof data.vet.updatedAt !== 'string'
      ) {
        setNeedsReload(true)
        setError(
          'Could not confirm the saved result. Reload before continuing.',
        )
        return
      }

      setVet(data.vet)
      setForm(formFromListing(data.vet))
      setSuccess(
        typeof data.message === 'string'
          ? data.message
          : 'Draft saved successfully.',
      )
    } catch {
      setNeedsReload(true)
      setError(
        'Could not confirm whether the changes were saved. Copy any edits you want to keep, then reload.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main
        className="page-width vet-editor-main"
        role="status"
      >
        Loading your listing…
      </main>
    )
  }

  if (accessDenied) {
    return (
      <main className="page-width vet-editor-main">
        <h1>A veterinarian account is required.</h1>
        <Link className="text-link" to="/account">
          Back to your account
        </Link>
      </main>
    )
  }

  if (loadError) {
    return (
      <main className="page-width vet-editor-main">
        <p className="vet-editor-error" role="alert">
          {loadError}
        </p>

        <div className="vet-editor-actions">
          <button
            className="button dark-button"
            type="button"
            onClick={reloadListing}
          >
            Try again
          </button>

          <Link className="text-link" to="/provider/vet">
            Back to workspace
          </Link>
        </div>
      </main>
    )
  }

  if (!vet || !form) {
    return (
      <main className="page-width vet-editor-main">
        <h1>No listing linked yet.</h1>
        <p>
          Ask the administrator to link a listing to your
          provider account.
        </p>

        <Link className="text-link" to="/provider/vet">
          Back to workspace
        </Link>
      </main>
    )
  }

  return (
    <main className="page-width vet-editor-main">
      <Link
        className="text-link"
        to="/provider/vet"
        onClick={(event) => {
          if (
            saving ||
            (dirty &&
              !window.confirm(
                'Leave without saving your changes?',
              ))
          ) {
            event.preventDefault()
          }
        }}
      >
        Back to workspace
      </Link>

      <div className="vet-editor-heading">
        <p className="eyebrow">YOUR PROVIDER WORKSPACE</p>
        <h1>
          {editable ? 'Edit your listing.' : 'Your listing details.'}
        </h1>
        <p>{vet.clinicName}</p>
      </div>

      <div className="vet-editor-summary">
        <p>
          <strong>Publication:</strong>{' '}
          {readableStatus(vet.status)}
        </p>

        <p>
          <strong>Verification:</strong>{' '}
          {vet.isDemo
            ? 'Demo — not a verified provider'
            : readableStatus(vet.verificationStatus)}
        </p>
      </div>

      {vet.isDemo && (
        <p className="vet-editor-notice">
          This is a fictional demo listing. Keep the description
          clearly labelled as a demonstration and leave real
          contact details out.
        </p>
      )}

      {!editable && (
        <p className="vet-editor-notice">
          Editing is locked while verification is pending or the
          listing is published or archived. Contact the
          administrator if your details need correcting.
        </p>
      )}

      {editable && !vet.isDemo && (
        <p className="vet-editor-notice">
          Saving changes requires fresh verification before
          publication. Editing does not remove a suspension.
        </p>
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
              Reload latest version
            </button>
          )}
        </div>
      )}

      <form
        className="vet-editor-form"
        aria-busy={saving}
        onSubmit={(event) => {
          event.preventDefault()
          void saveListing()
        }}
      >
        <div className="vet-editor-grid">
          {fields.map((field) => (
            <div
              className="vet-editor-field"
              key={field.key}
            >
              <label htmlFor={`provider-${field.key}`}>
                {field.label}
                {field.required ? ' *' : ''}
              </label>

              <input
                id={`provider-${field.key}`}
                type={field.type ?? 'text'}
                value={form[field.key]}
                onChange={(event) =>
                  updateField(field.key, event.target.value)
                }
                minLength={field.minLength}
                maxLength={field.maxLength}
                required={field.required}
                pattern={
                  field.key === 'countryCode'
                    ? '[A-Za-z]{2}'
                    : undefined
                }
                disabled={locked}
              />
            </div>
          ))}
        </div>

        <fieldset
          className="vet-editor-species"
          disabled={locked}
        >
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

        <div className="vet-editor-field">
          <label htmlFor="provider-description">
            Description
          </label>

          <textarea
            id="provider-description"
            value={form.description}
            onChange={(event) =>
              updateField('description', event.target.value)
            }
            rows={5}
            maxLength={5000}
            disabled={locked}
          />
        </div>

        <div className="vet-editor-field">
          <label htmlFor="provider-hours">
            Opening hours
          </label>

          <textarea
            id="provider-hours"
            value={form.openingHours}
            onChange={(event) =>
              updateField('openingHours', event.target.value)
            }
            rows={3}
            maxLength={1000}
            disabled={locked}
          />

          <small>
            For real providers, enter confirmed opening hours.
            These are not appointment slots.
          </small>
        </div>

        {editable && (
          <div className="vet-editor-actions">
            <button
              className="button dark-button"
              type="submit"
              disabled={locked || !dirty}
            >
              {saving ? 'Saving…' : 'Save draft'}
            </button>

            <span role="status">
              {dirty
                ? 'You have unsaved changes.'
                : 'You are viewing the saved version.'}
            </span>
          </div>
        )}
      </form>
    </main>
  )
}

export default ProviderVetEditor