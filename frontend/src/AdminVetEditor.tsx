import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import './AdminVetEditor.css'

type Species = 'CAT' | 'DOG' | 'TURTLE'

type VerificationStatus =
  | 'NOT_SUBMITTED'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED'

type VerificationAction =
  | 'SUBMIT'
  | 'START_REVIEW'
  | 'APPROVE'
  | 'REJECT'
  | 'SUSPEND'

type VetListing = {
  id: string
  slug: string
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
  latitude: number | null
  longitude: number | null
  phone: string | null
  email: string | null
  websiteUrl: string | null
  openingHours: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  isDemo: boolean
  verificationStatus: VerificationStatus
  verificationSubmittedAt: string | null
  verificationReviewedAt: string | null
  verificationNotes: string | null
  verificationEvidenceReferences: string | null
  updatedAt: string
  user: {
    id: string
    name: string
    email: string
    role: string
    status: string
  } | null
  verificationReviewedBy?: {
    id: string
    name: string
  } | null
}

type FormValues = {
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
  latitude: string
  longitude: string
  phone: string
  email: string
  websiteUrl: string
  openingHours: string
}

type TextField = Exclude<
  keyof FormValues,
  'species' | 'latitude' | 'longitude'
>

const speciesOptions: { value: Species; label: string }[] = [
  { value: 'CAT', label: 'Cats' },
  { value: 'DOG', label: 'Dogs' },
  { value: 'TURTLE', label: 'Turtles' },
]

const textFields: {
  key: TextField
  label: string
  maxLength: number
  required?: boolean
  minLength?: number
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

const actionLabels: Record<VerificationAction, string> = {
  SUBMIT: 'Submit for verification',
  START_REVIEW: 'Start review',
  APPROVE: 'Approve provider',
  REJECT: 'Reject submission',
  SUSPEND: 'Suspend provider',
}

function formFromVet(vet: VetListing): FormValues {
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
    latitude:
  vet.latitude === null
    ? ''
    : String(vet.latitude),
    longitude:
  vet.longitude === null
    ? ''
    : String(vet.longitude),
    phone: vet.phone ?? '',
    email: vet.email ?? '',
    websiteUrl: vet.websiteUrl ?? '',
    openingHours: vet.openingHours ?? '',
  }
}

function readableStatus(value: string) {
  return value.replaceAll('_', ' ').toLowerCase()
}

function displayDate(value: string | null) {
  if (!value) return 'Not recorded'

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? 'Not recorded'
    : date.toLocaleString()
}

function availableActions(vet: VetListing): VerificationAction[] {
  if (vet.isDemo) return []

  // An approved listing can still be suspended when archived.
  if (vet.verificationStatus === 'APPROVED') {
    return ['SUSPEND']
  }

  if (vet.status === 'ARCHIVED') return []

  switch (vet.verificationStatus) {
    case 'NOT_SUBMITTED':
    case 'REJECTED':
    case 'SUSPENDED':
      return ['SUBMIT']

    case 'SUBMITTED':
      return ['START_REVIEW']

    case 'UNDER_REVIEW':
      return ['APPROVE', 'REJECT']

    default:
      return []
  }
}

function AdminVetEditor() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [vet, setVet] = useState<VetListing | null>(null)
  const [form, setForm] = useState<FormValues | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [accessDenied, setAccessDenied] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState<'save' | 'verification' | null>(
    null,
  )
  const [needsReload, setNeedsReload] = useState(false)
  const [retry, setRetry] = useState(0)

  const [selectedAction, setSelectedAction] =
    useState<VerificationAction | null>(null)
  const [reason, setReason] = useState('')
  const [evidenceReferences, setEvidenceReferences] = useState('')
  const [verificationConfirmed, setVerificationConfirmed] =
    useState(false)

  useEffect(() => {
    const controller = new AbortController()

    async function loadVet() {
      setLoading(true)
      setLoadError('')
      setAccessDenied(false)

      try {
        if (!id) {
          throw new Error('Listing ID is missing.')
        }

        const response = await fetch(
          `/api/admin/vets/${encodeURIComponent(id)}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          },
        )

        if (controller.signal.aborted) return

        if (response.status === 401) {
          navigate('/login', { replace: true })
          return
        }

        if (response.status === 403) {
          setAccessDenied(true)
          return
        }

        if (response.status === 404) {
          throw new Error('This listing was not found.')
        }

        if (!response.ok) {
          throw new Error('Could not load this listing.')
        }

        const data = await response.json()

        if (
          !data?.vet?.id ||
          !Array.isArray(data.vet.species) ||
          typeof data.vet.updatedAt !== 'string'
        ) {
          throw new Error('Invalid listing response.')
        }

        if (!controller.signal.aborted) {
          setVet(data.vet)
          setForm(formFromVet(data.vet))
          setNeedsReload(false)
          setError('')
          setSuccess('')
          setSelectedAction(null)
          setReason('')
          setEvidenceReferences('')
          setVerificationConfirmed(false)
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Could not load this listing.',
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadVet()

    return () => controller.abort()
  }, [id, navigate, retry])

  const dirty =
    vet !== null &&
    form !== null &&
    JSON.stringify(form) !== JSON.stringify(formFromVet(vet))

  const reviewDirty =
    reason.trim().length > 0 ||
    evidenceReferences.trim().length > 0 ||
    verificationConfirmed

  const hasUnsavedChanges = dirty || reviewDirty

  const editable =
    vet?.status === 'DRAFT' &&
    vet.verificationStatus !== 'SUBMITTED' &&
    vet.verificationStatus !== 'UNDER_REVIEW'

  const locked = !editable || busy !== null || needsReload

  useEffect(() => {
    if (!hasUnsavedChanges) return

    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', warnBeforeLeaving)

    return () => {
      window.removeEventListener('beforeunload', warnBeforeLeaving)
    }
  }, [hasUnsavedChanges])

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

  function clearReviewForm() {
    setSelectedAction(null)
    setReason('')
    setEvidenceReferences('')
    setVerificationConfirmed(false)
  }

  function reloadListing() {
    if (busy) return

    if (
      hasUnsavedChanges &&
      !window.confirm(
        'Reloading discards unsaved listing changes and review notes. Continue?',
      )
    ) {
      return
    }

    setRetry((value) => value + 1)
  }

  function selectAction(action: VerificationAction) {
    if (!vet || busy || dirty || needsReload) return
    if (!availableActions(vet).includes(action)) return
    if (selectedAction === action) return

    if (
      reviewDirty &&
      !window.confirm('Discard the current unsaved review notes?')
    ) {
      return
    }

    setSelectedAction(action)
    setReason('')
    setEvidenceReferences('')
    setVerificationConfirmed(false)
    setError('')
    setSuccess('')
  }

  function cancelReview() {
    if (busy) return

    if (
      reviewDirty &&
      !window.confirm('Discard the unsaved review notes?')
    ) {
      return
    }

    clearReviewForm()
  }

  async function saveListing() {
    if (!vet || !form || locked || !dirty) return

    if (form.species.length === 0) {
      setError('Choose at least one supported pet group.')
      return
    }

    const latitudeText =
  form.latitude.trim()

const longitudeText =
  form.longitude.trim()

const hasLatitude =
  latitudeText !== ''

const hasLongitude =
  longitudeText !== ''

if (hasLatitude !== hasLongitude) {
  setError(
    'Enter both latitude and longitude, or leave both blank.',
  )
  return
}

let latitude: number | null =
  null

let longitude: number | null =
  null

if (hasLatitude && hasLongitude) {
  latitude =
    Number(latitudeText)

  longitude =
    Number(longitudeText)

  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90
  ) {
    setError(
      'Latitude must be between -90 and 90.',
    )
    return
  }

  if (
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    setError(
      'Longitude must be between -180 and 180.',
    )
    return
  }
}

    if (
      reviewDirty &&
      !window.confirm(
        'Saving listing changes will clear your unsaved review form. Continue?',
      )
    ) {
      return
    }

    setBusy('save')
    setError('')
    setSuccess('')

    try {
      const response = await fetch(
        `/api/admin/vets/${encodeURIComponent(vet.id)}`,
        {
          method: 'PUT',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...form,
            latitude,
            longitude,
            updatedAt: vet.updatedAt,
          }),
        },
      )

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
            : 'Could not save the listing.',
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

      const saved: VetListing = {
        ...data.vet,
        user: vet.user,
        verificationReviewedBy:
          data.vet.verificationReviewedById ===
          undefined
            ? null
            : data.vet.verificationReviewedById === null
              ? null
              : vet.verificationReviewedBy ?? null,
      }

      setVet(saved)
      setForm(formFromVet(saved))
      clearReviewForm()

      setSuccess(
        saved.isDemo
          ? 'Demo draft saved. It has not been published.'
          : 'Draft saved. Updated details require verification before publication.',
      )
    } catch {
      setNeedsReload(true)
      setError(
        'Could not confirm whether the changes were saved. Copy any edits you want to keep, then reload.',
      )
    } finally {
      setBusy(null)
    }
  }

  async function submitVerification() {
    if (
      !vet ||
      !selectedAction ||
      busy ||
      dirty ||
      needsReload ||
      !availableActions(vet).includes(selectedAction)
    ) {
      return
    }

    const trimmedReason = reason.trim()
    const trimmedEvidence = evidenceReferences.trim()

    if (
      trimmedReason.length < 5 ||
      trimmedReason.length > 2000
    ) {
      setError('Enter a reason containing 5–2,000 characters.')
      return
    }

    if (selectedAction === 'APPROVE') {
      if (
        trimmedEvidence.length < 10 ||
        trimmedEvidence.length > 5000
      ) {
        setError(
          'Enter evidence references containing 10–5,000 characters.',
        )
        return
      }

      if (!verificationConfirmed) {
        setError('Confirm that the required checks were completed.')
        return
      }
    }

    const confirmation =
      selectedAction === 'APPROVE'
        ? 'Record provider approval for this saved version? It will remain a draft until separately published.'
        : selectedAction === 'SUSPEND'
          ? 'Suspend this provider listing? It will be removed from the public directory.'
          : `${actionLabels[selectedAction]} for this saved version?`

    if (!window.confirm(confirmation)) return

    const action = selectedAction

    setBusy('verification')
    setError('')
    setSuccess('')

    try {
      const response = await fetch(
        `/api/admin/vets/${encodeURIComponent(vet.id)}/transition`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action,
            updatedAt: vet.updatedAt,
            reason: trimmedReason,
            ...(action === 'APPROVE'
              ? {
                  evidenceReferences: trimmedEvidence,
                  verificationConfirmed,
                }
              : {}),
          }),
        },
      )

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
            : 'Could not update verification.',
        )
        return
      }

      if (
        data?.vet?.id !== vet.id ||
        typeof data.vet.updatedAt !== 'string'
      ) {
        setNeedsReload(true)
        setError(
          'Could not confirm the result. Reload before continuing.',
        )
        return
      }

      // Fetch the latest listing with its provider and reviewer relations.
      const latestResponse = await fetch(
        `/api/admin/vets/${encodeURIComponent(vet.id)}`,
        {
          credentials: 'same-origin',
          cache: 'no-store',
        },
      )

      if (latestResponse.status === 401) {
        navigate('/login', { replace: true })
        return
      }

      if (!latestResponse.ok) {
        setNeedsReload(true)
        setError(
          'The action succeeded, but the latest details could not be loaded. Reload before continuing.',
        )
        return
      }

      const latest = await latestResponse.json()

      if (
        latest?.vet?.id !== vet.id ||
        !Array.isArray(latest.vet.species) ||
        typeof latest.vet.updatedAt !== 'string'
      ) {
        setNeedsReload(true)
        setError(
          'The action succeeded, but its details could not be confirmed. Reload before continuing.',
        )
        return
      }

      setVet(latest.vet)
      setForm(formFromVet(latest.vet))
      clearReviewForm()

      const messages: Record<VerificationAction, string> = {
        SUBMIT: 'Submitted for verification. Editing is now locked.',
        START_REVIEW: 'The listing is now under review.',
        APPROVE:
          'Approval recorded. Publishing is a separate action on the listings page.',
        REJECT:
          'Submission rejected. The listing is a draft and can be corrected.',
        SUSPEND:
          'Listing suspended and removed from the public directory.',
      }

      setSuccess(
        `${messages[action]} Current verification: ${readableStatus(
          latest.vet.verificationStatus,
        )}.`,
      )
    } catch {
      setNeedsReload(true)
      setError(
        'Could not confirm the result. Reload to check the current status before trying again.',
      )
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <main className="page-width vet-editor-main" role="status">
        Loading listing…
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

  if (loadError || !vet || !form) {
    return (
      <main className="page-width vet-editor-main">
        <p className="vet-editor-error" role="alert">
          {loadError || 'Listing unavailable.'}
        </p>

        <div className="vet-editor-actions">
          <button
            className="button dark-button"
            type="button"
            onClick={reloadListing}
          >
            Try again
          </button>

          <Link className="text-link" to="/admin/vets">
            Back to vet listings
          </Link>
        </div>
      </main>
    )
  }

  const actions = availableActions(vet)
  const reviewLocked = busy !== null || dirty || needsReload

  return (
    <main className="page-width vet-editor-main">
      <Link
        className="text-link"
        to="/admin/vets"
        onClick={(event) => {
          if (
            busy ||
            (hasUnsavedChanges &&
              !window.confirm('Leave without saving your changes?'))
          ) {
            event.preventDefault()
          }
        }}
      >
        Back to vet listings
      </Link>

      <div className="vet-editor-heading">
        <p className="eyebrow">THE PROVIDER DESK</p>
        <h1>{editable ? 'Edit the listing.' : 'Listing details.'}</h1>
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

        <p>
          <strong>Provider account:</strong>{' '}
          {vet.user
            ? `${vet.user.name} (${vet.user.email})`
            : 'Not linked'}
        </p>

        <p>
          <strong>Slug:</strong> {vet.slug}
        </p>
      </div>

      {vet.isDemo && (
        <p className="vet-editor-notice">
          This is a fictional demo listing. Real provider verification
          is unavailable for demos. Keep its details clearly labelled
          as examples.
        </p>
      )}

      {!editable && (
        <p className="vet-editor-notice">
          Editing is available only for drafts that are not awaiting
          verification. Published or archived listings must first be
          returned to draft. A submission under review must receive a
          decision before its details can be edited.
        </p>
      )}

      {editable && !vet.isDemo && (
        <p className="vet-editor-notice">
          Saving changes clears previous approval and requires a new
          review. An existing suspension remains in place.
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
              disabled={busy !== null}
              onClick={reloadListing}
            >
              Reload latest version
            </button>
          )}
        </div>
      )}

      <form
        className="vet-editor-form"
        aria-busy={busy === 'save'}
        onSubmit={(event) => {
          event.preventDefault()
          void saveListing()
        }}
      >
        <div className="vet-editor-grid">
          {textFields.map((field) => (
            <div className="vet-editor-field" key={field.key}>
              <label htmlFor={`vet-edit-${field.key}`}>
                {field.label}
                {field.required ? ' *' : ''}
              </label>

              <input
                id={`vet-edit-${field.key}`}
                type={field.type ?? 'text'}
                value={form[field.key]}
                onChange={(event) =>
                  updateField(field.key, event.target.value)
                }
                required={field.required}
                minLength={field.minLength}
                maxLength={field.maxLength}
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
          
        <div className="vet-editor-grid">
  <div className="vet-editor-field">
    <label htmlFor="vet-edit-latitude">
      Latitude
    </label>

    <input
      id="vet-edit-latitude"
      type="number"
      inputMode="decimal"
      step="any"
      min="-90"
      max="90"
      value={form.latitude}
      onChange={(event) => {
        setForm((current) =>
          current
            ? {
                ...current,
                latitude:
                  event.target.value,
              }
            : current,
        )

        setSuccess('')
      }}
      placeholder="For example, 19.0760"
      disabled={locked}
    />

    <small>
      Optional. Required together with
      longitude for nearby search.
    </small>
  </div>

  <div className="vet-editor-field">
    <label htmlFor="vet-edit-longitude">
      Longitude
    </label>

    <input
      id="vet-edit-longitude"
      type="number"
      inputMode="decimal"
      step="any"
      min="-180"
      max="180"
      value={form.longitude}
      onChange={(event) => {
        setForm((current) =>
          current
            ? {
                ...current,
                longitude:
                  event.target.value,
              }
            : current,
        )

        setSuccess('')
      }}
      placeholder="For example, 72.8777"
      disabled={locked}
    />

    <small>
      Optional. Required together with
      latitude for nearby search.
    </small>
  </div>
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
          <label htmlFor="vet-edit-description">Description</label>
          <textarea
            id="vet-edit-description"
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
          <label htmlFor="vet-edit-hours">Opening hours</label>
          <textarea
            id="vet-edit-hours"
            value={form.openingHours}
            onChange={(event) =>
              updateField('openingHours', event.target.value)
            }
            rows={3}
            maxLength={1000}
            disabled={locked}
          />
          <small>
            Enter confirmed hours and any appointment-only arrangements.
          </small>
        </div>

        {editable && (
          <div className="vet-editor-actions">
            <button
              className="button dark-button"
              type="submit"
              disabled={locked || !dirty}
            >
              {busy === 'save' ? 'Saving…' : 'Save draft'}
            </button>

            <span role="status">
              {dirty
                ? 'You have unsaved changes.'
                : 'You are viewing the saved version.'}
            </span>
          </div>
        )}
      </form>

      {!vet.isDemo && (
        <section
          className="vet-verification-panel"
          aria-labelledby="verification-title"
        >
          <p className="eyebrow">PROVIDER VERIFICATION</p>
          <h2 id="verification-title">Review before publication.</h2>

          <p>
            Record checks against this exact saved listing.
            Approval does not automatically publish it.
          </p>

          <dl className="vet-verification-details">
            <div>
              <dt>Status</dt>
              <dd>{readableStatus(vet.verificationStatus)}</dd>
            </div>

            <div>
              <dt>Submitted</dt>
              <dd>{displayDate(vet.verificationSubmittedAt)}</dd>
            </div>

            <div>
              <dt>Latest decision</dt>
              <dd>{displayDate(vet.verificationReviewedAt)}</dd>
            </div>

            <div>
              <dt>Administrator</dt>
              <dd>
                {vet.verificationReviewedBy?.name ?? 'Not recorded'}
              </dd>
            </div>
          </dl>

          {vet.verificationNotes && (
            <div className="vet-verification-record">
              <h3>Latest internal notes</h3>
              <p>{vet.verificationNotes}</p>
            </div>
          )}

          {vet.verificationEvidenceReferences && (
            <div className="vet-verification-record">
              <h3>Recorded evidence references</h3>
              <p>{vet.verificationEvidenceReferences}</p>
            </div>
          )}

          {vet.status === 'ARCHIVED' && (
            <p className="vet-editor-notice">
              Return this listing to draft before starting or resuming
              verification. An existing approval can still be suspended.
            </p>
          )}

          {dirty && (
            <p className="vet-editor-notice">
              Save your listing changes before taking a verification action.
            </p>
          )}

          {actions.length > 0 && (
            <div className="vet-editor-actions">
              {actions.map((action) => (
                <button
                  className="vet-verification-button"
                  type="button"
                  key={action}
                  disabled={reviewLocked}
                  aria-pressed={selectedAction === action}
                  onClick={() => selectAction(action)}
                >
                  {actionLabels[action]}
                </button>
              ))}
            </div>
          )}

          {selectedAction && actions.includes(selectedAction) && (
            <form
              className="vet-editor-form"
              aria-busy={busy === 'verification'}
              onSubmit={(event) => {
                event.preventDefault()
                void submitVerification()
              }}
            >
              <h3>{actionLabels[selectedAction]}</h3>

              <div className="vet-editor-field">
                <label htmlFor="verification-reason">
                  Reason or review notes *
                </label>
                <textarea
                  id="verification-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  minLength={5}
                  maxLength={2000}
                  rows={4}
                  required
                  disabled={reviewLocked}
                />
                <small>
                  Record the reason for this action. These notes are
                  restricted to administrators.
                </small>
              </div>

              {selectedAction === 'APPROVE' && (
                <>
                  <div className="vet-editor-field">
                    <label htmlFor="verification-evidence">
                      Evidence references *
                    </label>
                    <textarea
                      id="verification-evidence"
                      value={evidenceReferences}
                      onChange={(event) =>
                        setEvidenceReferences(event.target.value)
                      }
                      minLength={10}
                      maxLength={5000}
                      rows={5}
                      required
                      disabled={reviewLocked}
                    />
                    <small>
                      Reference the registration check, contact
                      confirmation, and other evidence reviewed.
                      This field records references; it does not upload
                      documents.
                    </small>
                  </div>

                  <label className="vet-verification-confirmation">
                    <input
                      type="checkbox"
                      checked={verificationConfirmed}
                      onChange={(event) =>
                        setVerificationConfirmed(event.target.checked)
                      }
                      required
                      disabled={reviewLocked}
                    />
                    <span>
                      I checked this provider’s identity, professional
                      credentials, contact details, location, and supported
                      species against the saved listing and recorded evidence.
                    </span>
                  </label>
                </>
              )}

              {selectedAction === 'SUSPEND' && (
                <p className="vet-editor-notice">
                  Suspension removes this listing from the public
                  directory. It must go through verification again
                  before it can be republished.
                </p>
              )}

              <div className="vet-editor-actions">
                <button
                  className="button dark-button"
                  type="submit"
                  disabled={reviewLocked}
                >
                  {busy === 'verification'
                    ? 'Saving decision…'
                    : actionLabels[selectedAction]}
                </button>

                <button
                  className="vet-verification-button"
                  type="button"
                  disabled={busy !== null}
                  onClick={cancelReview}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </main>
  )
}

export default AdminVetEditor