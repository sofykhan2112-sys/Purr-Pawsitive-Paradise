import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import './VetWorkspace.css'

type ProviderUser = {
  id: string
  name: string
}

type VetListing = {
  id: string
  vetName: string
  clinicName: string
  qualifications: string | null
  registrationNumber: string | null
  registrationBody: string | null
  description: string | null
  species: string[]
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
  isDemo: boolean
  verificationStatus: string
  verificationSubmittedAt: string | null
  verificationReviewedAt: string | null
  updatedAt: string
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

function verificationMessage(status: string) {
  switch (status) {
    case 'NOT_SUBMITTED':
      return 'Your listing has not been submitted for verification.'

    case 'SUBMITTED':
      return 'Your listing is waiting for an administrator to start reviewing it. Editing is locked.'

    case 'UNDER_REVIEW':
      return 'An administrator is reviewing your listing. Editing is locked.'

    case 'APPROVED':
      return 'Your provider verification is approved. Publication is managed separately.'

    case 'REJECTED':
      return 'Your submission was rejected. Contact the administrator about the changes required before resubmitting.'

    case 'SUSPENDED':
      return 'Your listing is suspended and hidden from the public directory. Contact the administrator about resubmission.'

    default:
      return 'Contact the administrator about your verification status.'
  }
}

function missingDetails(vet: VetListing): string[] {
  const missing: string[] = []

  if (!vet.vetName.trim()) missing.push('vet name')
  if (!vet.clinicName.trim()) missing.push('clinic name')
  if (!vet.qualifications?.trim()) missing.push('qualifications')
  if (!vet.registrationNumber?.trim()) {
    missing.push('registration number')
  }
  if (!vet.registrationBody?.trim()) {
    missing.push('registration body')
  }
  if (!vet.addressLine1.trim()) missing.push('address')
  if (!vet.city.trim()) missing.push('city')
  if (!vet.state.trim()) missing.push('state')
  if (!/^[A-Z]{2}$/.test(vet.countryCode)) {
    missing.push('valid country code')
  }
  if (vet.species.length === 0) missing.push('supported species')
  if (!vet.phone?.trim() && !vet.email?.trim()) {
    missing.push('phone or email')
  }
  if (!vet.openingHours?.trim()) missing.push('opening hours')

  return missing
}

function VetWorkspace() {
  const navigate = useNavigate()

  const [user, setUser] = useState<ProviderUser | null>(null)
  const [vet, setVet] = useState<VetListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [accessDenied, setAccessDenied] = useState(false)
  const [retry, setRetry] = useState(0)

  const [detailsConfirmed, setDetailsConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [success, setSuccess] = useState('')
  const [needsReload, setNeedsReload] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    async function loadWorkspace() {
      setLoading(true)
      setError('')
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
          throw new Error('Workspace request failed.')
        }

        const data = await response.json()

        if (
          typeof data?.user?.id !== 'string' ||
          typeof data.user.name !== 'string'
        ) {
          throw new Error('Invalid account response.')
        }

        if (
          data.vet !== null &&
          (
            typeof data.vet?.id !== 'string' ||
            !Array.isArray(data.vet.species) ||
            typeof data.vet.status !== 'string' ||
            typeof data.vet.verificationStatus !== 'string' ||
            typeof data.vet.updatedAt !== 'string'
          )
        ) {
          throw new Error('Invalid listing response.')
        }

        if (!controller.signal.aborted) {
          setUser(data.user)
          setVet(data.vet)
          setNeedsReload(false)
          setSubmitError('')
          setSuccess('')
          setDetailsConfirmed(false)
        }
      } catch {
        if (!controller.signal.aborted) {
          setError(
            'Could not load your workspace. Please try again.',
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadWorkspace()

    return () => controller.abort()
  }, [navigate, retry])

  const canEdit =
    vet?.status === 'DRAFT' &&
    vet.verificationStatus !== 'SUBMITTED' &&
    vet.verificationStatus !== 'UNDER_REVIEW'

  const canSubmit =
    vet !== null &&
    !vet.isDemo &&
    vet.status === 'DRAFT' &&
    (
      vet.verificationStatus === 'NOT_SUBMITTED' ||
      vet.verificationStatus === 'REJECTED'
    )

  const missing = vet ? missingDetails(vet) : []

  function reloadWorkspace() {
    if (submitting) return

    setLoading(true)
    setRetry((value) => value + 1)
  }

  async function submitForVerification() {
    if (
      !vet ||
      !canSubmit ||
      submitting ||
      needsReload ||
      !detailsConfirmed ||
      missing.length > 0
    ) {
      return
    }

    if (
      !window.confirm(
        'Submit this saved listing for verification? Editing will be locked until the review receives a decision.',
      )
    ) {
      return
    }

    setSubmitting(true)
    setSubmitError('')
    setSuccess('')

    try {
      const response = await fetch(
        '/api/provider/vet/submit-review',
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            updatedAt: vet.updatedAt,
            detailsConfirmed: true,
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

        setSubmitError(
          typeof data?.message === 'string'
            ? data.message
            : 'Could not submit your listing.',
        )
        return
      }

      if (
        data?.vet?.id !== vet.id ||
        data.vet.verificationStatus !== 'SUBMITTED' ||
        !Array.isArray(data.vet.species) ||
        typeof data.vet.updatedAt !== 'string'
      ) {
        setNeedsReload(true)
        setSubmitError(
          'Could not confirm the result. Reload before trying again.',
        )
        return
      }

      setVet(data.vet)
      setDetailsConfirmed(false)
      setSuccess(
        'Submitted for verification. Editing is locked while your listing awaits review. It has not been published.',
      )
    } catch {
      setNeedsReload(true)
      setSubmitError(
        'Could not confirm whether submission succeeded. Reload to check the status before trying again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="vet-workspace-page">
      <a className="skip-link" href="#workspace-main">
        Skip to content
      </a>

      <header className="header">
        <Link
          className="brand"
          to="/"
          onClick={(event) => {
            if (submitting) event.preventDefault()
          }}
        >
          <span className="brand-mark" aria-hidden="true">
            pp.
          </span>

          <span>
            Purr-Pawsitive
            <small>PARADISE</small>
          </span>
        </Link>

        <nav aria-label="Provider navigation">
          <Link
            to="/account"
            onClick={(event) => {
              if (submitting) event.preventDefault()
            }}
          >
            My account
          </Link>

          <Link
            to="/vets"
            onClick={(event) => {
              if (submitting) event.preventDefault()
            }}
          >
            Public directory
          </Link>

          <Link
            to="/"
            onClick={(event) => {
              if (submitting) event.preventDefault()
            }}
          >
            Home
          </Link>
        </nav>
      </header>

      <main
        className="page-width vet-workspace-main"
        id="workspace-main"
      >
        {loading ? (
          <p role="status">Loading your workspace…</p>
        ) : accessDenied ? (
          <div className="vet-workspace-notice">
            <h1>A veterinarian account is required.</h1>
            <p>
              Administrators manage listings through Manage vets.
            </p>

            <Link className="text-link" to="/account">
              Back to your account
            </Link>
          </div>
        ) : error ? (
          <div className="vet-workspace-error">
            <p role="alert">{error}</p>

            <button
              className="button dark-button"
              type="button"
              onClick={reloadWorkspace}
            >
              Try again
            </button>
          </div>
        ) : user ? (
          <>
            <div className="vet-workspace-heading">
              <p className="eyebrow">YOUR PROVIDER WORKSPACE</p>
              <h1>Hello, {user.name}.</h1>
              <p>
                Manage your saved listing and follow its
                verification and publication status.
              </p>
            </div>

            {success && (
              <p className="vet-workspace-notice" role="status">
                {success}
              </p>
            )}

            {submitError && (
              <div className="vet-workspace-error">
                <p role="alert">{submitError}</p>

                {needsReload && (
                  <button
                    className="button dark-button"
                    type="button"
                    disabled={submitting}
                    onClick={reloadWorkspace}
                  >
                    Reload latest status
                  </button>
                )}
              </div>
            )}

            {!vet ? (
              <section className="vet-workspace-card">
                <h2>No listing linked yet.</h2>
                <p>
                  Ask the administrator to link a clinic listing
                  to your account.
                </p>
              </section>
            ) : (
              <>
                {vet.isDemo && (
                  <p className="vet-workspace-notice">
                    This is a fictional demo provider. Real provider
                    verification is unavailable for demo listings.
                    It does not offer real veterinary services.
                  </p>
                )}

                <section
                  className="vet-workspace-card"
                  aria-labelledby="workspace-clinic-title"
                >
                  <div className="vet-workspace-badges">
                    <span>{readableStatus(vet.status)}</span>
                    {vet.isDemo && <span>Demo</span>}
                  </div>

                  <h2 id="workspace-clinic-title">
                    {vet.clinicName}
                  </h2>

                  <p>{vet.vetName}</p>

                  {vet.description && (
                    <p className="vet-workspace-description">
                      {vet.description}
                    </p>
                  )}

                  <ul
                    className="vet-workspace-species"
                    aria-label="Animals treated"
                  >
                    {vet.species.map((species) => (
                      <li key={species}>
                        {species === 'CAT'
                          ? 'Cats'
                          : species === 'DOG'
                            ? 'Dogs'
                            : species === 'TURTLE'
                              ? 'Turtles'
                              : species}
                      </li>
                    ))}
                  </ul>

                  <div className="vet-workspace-actions">
                    <Link
                      className="button dark-button"
                      to="/provider/vet/edit"
                      onClick={(event) => {
                        if (submitting || needsReload) {
                          event.preventDefault()
                        }
                      }}
                    >
                      {canEdit
                        ? 'Edit my listing'
                        : 'View listing details'}
                    </Link>

                    <button
                      className="vet-workspace-secondary"
                      type="button"
                      disabled={submitting}
                      onClick={reloadWorkspace}
                    >
                      Refresh status
                    </button>
                  </div>
                </section>

                <div className="vet-workspace-grid">
                  <section className="vet-workspace-card">
                    <h2>Listing status</h2>

                    <dl className="vet-workspace-details">
                      <div>
                        <dt>Publication</dt>
                        <dd>{readableStatus(vet.status)}</dd>
                      </div>

                      <div>
                        <dt>Verification</dt>
                        <dd>
                          {vet.isDemo
                            ? 'Demo — not a verified provider'
                            : readableStatus(
                                vet.verificationStatus,
                              )}
                        </dd>
                      </div>

                      {!vet.isDemo && (
                        <>
                          <div>
                            <dt>Submitted for verification</dt>
                            <dd>
                              {displayDate(
                                vet.verificationSubmittedAt,
                              )}
                            </dd>
                          </div>

                          <div>
                            <dt>Latest verification decision</dt>
                            <dd>
                              {displayDate(
                                vet.verificationReviewedAt,
                              )}
                            </dd>
                          </div>
                        </>
                      )}

                      <div>
                        <dt>Last updated</dt>
                        <dd>{displayDate(vet.updatedAt)}</dd>
                      </div>
                    </dl>

                    {!vet.isDemo && (
                      <p>
                        {verificationMessage(
                          vet.verificationStatus,
                        )}
                      </p>
                    )}

                    <p className="vet-workspace-note">
                      Only drafts outside pending verification can
                      be edited. Approval and publication are
                      separate administrator actions.
                    </p>
                  </section>

                  <section className="vet-workspace-card">
                    <h2>Verification submission</h2>

                    {vet.isDemo ? (
                      <p>
                        Demo listings cannot be submitted for real
                        verification. You can continue testing draft
                        editing with this account.
                      </p>
                    ) : canSubmit ? (
                      <>
                        <p>
                          Review the saved details before submitting.
                          Your confirmation requests a review; it
                          does not approve the provider.
                        </p>

                        {missing.length > 0 ? (
                          <>
                            <p>Complete these details first:</p>
                            <ul>
                              {missing.map((field) => (
                                <li key={field}>{field}</li>
                              ))}
                            </ul>
                            <p className="vet-workspace-note">
                              Use Edit my listing, save your changes,
                              and return here.
                            </p>
                          </>
                        ) : (
                          <form
                            aria-busy={submitting}
                            onSubmit={(event) => {
                              event.preventDefault()
                              void submitForVerification()
                            }}
                          >
                            <label className="vet-workspace-confirmation">
                              <input
                                type="checkbox"
                                checked={detailsConfirmed}
                                onChange={(event) =>
                                  setDetailsConfirmed(
                                    event.target.checked,
                                  )
                                }
                                required
                                disabled={
                                  submitting || needsReload
                                }
                              />

                              <span>
                                I confirm that my saved professional
                                details, clinic location, contact
                                information, supported species, and
                                opening hours are accurate.
                              </span>
                            </label>

                            <button
                              className="button dark-button"
                              type="submit"
                              disabled={
                                submitting ||
                                needsReload ||
                                !detailsConfirmed
                              }
                            >
                              {submitting
                                ? 'Submitting…'
                                : 'Submit for verification'}
                            </button>
                          </form>
                        )}
                      </>
                    ) : (
                      <>
                        <p>
                          {verificationMessage(
                            vet.verificationStatus,
                          )}
                        </p>

                        {vet.status !== 'DRAFT' && (
                          <p className="vet-workspace-note">
                            A submission requires a draft listing.
                            Contact the administrator if a published
                            or archived listing needs changes.
                          </p>
                        )}
                      </>
                    )}
                  </section>

                  <section className="vet-workspace-card">
                    <h2>Location and contact</h2>

                    <dl className="vet-workspace-details">
                      <div>
                        <dt>Address</dt>
                        <dd>
                          {[
                            vet.addressLine1,
                            vet.addressLine2,
                            vet.city,
                            vet.state,
                            vet.postalCode,
                            vet.countryCode,
                          ]
                            .filter(Boolean)
                            .join(', ')}
                        </dd>
                      </div>

                      <div>
                        <dt>Phone</dt>
                        <dd>{vet.phone || 'Not provided'}</dd>
                      </div>

                      <div>
                        <dt>Email</dt>
                        <dd>{vet.email || 'Not provided'}</dd>
                      </div>

                      <div>
                        <dt>Website</dt>
                        <dd>{vet.websiteUrl || 'Not provided'}</dd>
                      </div>

                      <div>
                        <dt>Opening hours</dt>
                        <dd>
                          {vet.openingHours || 'Not provided'}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <section className="vet-workspace-card">
                    <h2>Professional details</h2>

                    <dl className="vet-workspace-details">
                      <div>
                        <dt>Qualifications</dt>
                        <dd>
                          {vet.qualifications || 'Not provided'}
                        </dd>
                      </div>

                      <div>
                        <dt>Registration number</dt>
                        <dd>
                          {vet.registrationNumber ||
                            'Not provided'}
                        </dd>
                      </div>

                      <div>
                        <dt>Registration body</dt>
                        <dd>
                          {vet.registrationBody || 'Not provided'}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <section className="vet-workspace-card">
                    <p className="eyebrow">APPOINTMENTS</p>
                    <h2>Appointment requests</h2>
                    <p>
                      View pending appointment requests submitted
                      for your clinic.
                    </p>

                    <a
                      className="button dark-button"
                      href="/provider/appointments"
                    >
                      View appointment requests
                    </a>

                    <p className="vet-workspace-note">
                      Requests require provider confirmation.
                      Availability management is coming next.
                    </p>
                  </section>
                </div>
              </>
            )}
          </>
        ) : null}
      </main>
    </div>
  )
}

export default VetWorkspace