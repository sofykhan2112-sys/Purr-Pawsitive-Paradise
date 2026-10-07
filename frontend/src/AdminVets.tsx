import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import './AdminVets.css'

type VetSummary = {
  id: string
  clinicName: string
  vetName: string
  city: string
  state: string
  species: string[]
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  isDemo: boolean
  verificationStatus: string
  updatedAt: string
  user: {
    id: string
    name: string
    role: string
    status: string
  } | null
}

type ListingAction =
  | 'RETURN_TO_DRAFT'
  | 'PUBLISH'
  | 'ARCHIVE'

function readableStatus(value: string) {
  return value.replaceAll('_', ' ').toLowerCase()
}

function AdminVets() {
  const navigate = useNavigate()

  const [vets, setVets] = useState<VetSummary[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [accessDenied, setAccessDenied] = useState(false)
  const [actionError, setActionError] = useState('')
  const [success, setSuccess] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [needsReload, setNeedsReload] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function loadVets() {
      setLoading(true)
      setLoadError('')
      setAccessDenied(false)

      try {
        const response = await fetch(
          `/api/admin/vets?page=${page}`,
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

        if (!response.ok) {
          throw new Error('Could not load vet listings.')
        }

        const data = await response.json()

        if (
          !Array.isArray(data.vets) ||
          !Number.isInteger(data.total) ||
          data.total < 0 ||
          !Number.isInteger(data.totalPages) ||
          data.totalPages < 0
        ) {
          throw new Error('Invalid directory response.')
        }

        if (!controller.signal.aborted) {
          setVets(data.vets)
          setTotal(data.total)
          setTotalPages(data.totalPages)
          setNeedsReload(false)
          setActionError('')
        }
      } catch {
        if (!controller.signal.aborted) {
          setLoadError(
            'Could not load vet listings. Please try again.',
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadVets()

    return () => controller.abort()
  }, [navigate, page, retry])

  function reloadListings() {
    if (busyId) return

    setLoading(true)
    setRetry((value) => value + 1)
  }

  function changePage(nextPage: number) {
    if (
      loading ||
      busyId ||
      nextPage < 1 ||
      nextPage > totalPages
    ) {
      return
    }

    setSuccess('')
    setActionError('')
    setLoading(true)
    setPage(nextPage)
  }

  async function changeStatus(
    vet: VetSummary,
    action: ListingAction,
  ) {
    if (busyId || loading || needsReload) return

    const explanation = {
      RETURN_TO_DRAFT:
        'Return this listing to draft? It will disappear from the public directory.',
      PUBLISH:
        'Publish this listing? Eligible listings will appear in the public directory.',
      ARCHIVE:
        'Archive this listing? It will disappear from the public directory, but its record will remain.',
    }[action]

    const enteredReason = window.prompt(
      `${explanation}\n\nEnter a reason (5–2,000 characters):`,
    )

    if (enteredReason === null) return

    const reason = enteredReason.trim()

    if (reason.length < 5 || reason.length > 2000) {
      setActionError(
        'Please enter a reason containing 5–2,000 characters.',
      )
      return
    }

    setBusyId(vet.id)
    setActionError('')
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
            reason,
            updatedAt: vet.updatedAt,
          }),
        },
      )

      if (response.status === 401) {
        navigate('/login', { replace: true })
        return
      }

      if (response.status === 403) {
        // A 403 may indicate a session permission or origin problem.
        setNeedsReload(true)
        setActionError(
          'This action was denied. Reload to check your access.',
        )
        return
      }

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        if (response.status === 409 || response.status >= 500) {
          setNeedsReload(true)
        }

        setActionError(
          typeof data?.message === 'string'
            ? data.message
            : 'Could not update the listing.',
        )
        return
      }

      if (
        data?.vet?.id !== vet.id ||
        typeof data.vet.updatedAt !== 'string' ||
        !['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(
          data.vet.status,
        )
      ) {
        setNeedsReload(true)
        setActionError(
          'Could not confirm the result. Reload before continuing.',
        )
        return
      }

      setSuccess(
        `${vet.clinicName}: ${readableStatus(data.vet.status)}.`,
      )

      // Reload to receive the latest version and list ordering.
      setLoading(true)
      setRetry((value) => value + 1)
    } catch {
      setNeedsReload(true)
      setActionError(
        'Could not confirm whether the change was saved. Reload before trying again.',
      )
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="admin-vets-page">
      <header className="header">
        <Link className="brand" to="/">
          <span className="brand-mark" aria-hidden="true">
            pp.
          </span>

          <span>
            Purr-Pawsitive
            <small>PARADISE</small>
          </span>
        </Link>

        <nav aria-label="Admin navigation">
          <Link to="/account">My account</Link>
          <Link to="/admin/articles">Articles</Link>
          <Link to="/vets">Public directory</Link>
        </nav>
      </header>

      <main className="page-width admin-vets-main">
        <div className="admin-vets-heading">
          <div>
            <p className="eyebrow">THE PROVIDER DESK</p>
            <h1>Vet listings.</h1>
            <p>
              Manage which listings appear in the directory.
              Publication and provider verification are separate.
            </p>
          </div>
        </div>

        {success && (
          <p className="admin-vets-success" role="status">
            {success}
          </p>
        )}

        {actionError && (
          <div className="admin-vets-error">
            <p role="alert">{actionError}</p>

            {needsReload && (
              <button
                className="button dark-button"
                type="button"
                disabled={busyId !== null || loading}
                onClick={reloadListings}
              >
                Reload listings
              </button>
            )}
          </div>
        )}

        {loading ? (
          <p role="status">Loading vet listings…</p>
        ) : accessDenied ? (
          <div className="admin-vets-notice">
            <h2>Administrator access required.</h2>
            <p>This account cannot manage vet listings.</p>
            <Link className="text-link" to="/account">
              Back to your account
            </Link>
          </div>
        ) : loadError ? (
          <div className="admin-vets-error">
            <p role="alert">{loadError}</p>
            <button
              className="button dark-button"
              type="button"
              onClick={reloadListings}
            >
              Try again
            </button>
          </div>
        ) : (
          <>
          <Link
            className="button dark-button"
            to="/admin/vets/new"
             onClick={(event) => {
             if (busyId !== null) {
              event.preventDefault()
            }
          }}
>
  Create vet listing
</Link>


<p className="admin-vets-count" role="status">
  {total} {total === 1 ? 'listing' : 'listings'}
</p>

            {vets.length === 0 ? (
              <p className="admin-vets-notice">
                No listings on this page.
              </p>
            ) : (
              <div className="admin-vets-grid">
                {vets.map((vet) => {
                  const busy = busyId === vet.id
                  const locked =
                    busyId !== null || needsReload || loading

                  const eligibleToPublish =
                    vet.verificationStatus !== 'SUSPENDED' &&
                    (vet.isDemo ||
                      (vet.verificationStatus === 'APPROVED' &&
                        vet.user?.role === 'VET' &&
                        vet.user.status === 'ACTIVE'))

                  return (
                    <article
                      className="admin-vet-card"
                      key={vet.id}
                      aria-busy={busy}
                    >
                      <div className="admin-vet-badges">
                        <span
                          className={`admin-vet-badge admin-vet-${vet.status.toLowerCase()}`}
                        >
                          {readableStatus(vet.status)}
                        </span>

                        {vet.isDemo && (
                          <span className="admin-vet-badge admin-vet-demo">
                            Demo
                          </span>
                        )}
                      </div>

                      <h2>{vet.clinicName}</h2>
                      <p>{vet.vetName}</p>

                      <dl className="admin-vet-details">
                        <div>
                          <dt>Location</dt>
                          <dd>
                            {vet.city}, {vet.state}
                          </dd>
                        </div>

                        <div>
                          <dt>Species</dt>
                          <dd>{vet.species.join(', ')}</dd>
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

                        <div>
                          <dt>Provider account</dt>
                          <dd>
                            {vet.user
                              ? `${vet.user.name} (${readableStatus(
                                  vet.user.status,
                                )})`
                              : 'Not linked'}
                          </dd>
                        </div>
                      </dl>

                      {vet.status === 'DRAFT' &&
                        !eligibleToPublish && (
                          <p className="admin-vet-note">
                            Publishing requires approved verification
                            and an active vet account.
                          </p>
                        )}

                      <div className="admin-vet-actions">
                      <Link
                       className="admin-vet-secondary"
                         to={`/admin/vets/${vet.id}/booking`}
                        onClick={(event) => {
                          if (busyId !== null) {
                          event.preventDefault()
    }
  }}
>
  Booking settings
</Link>
                      <Link
  className="admin-vet-secondary"
  to={`/admin/vets/${vet.id}`}
  onClick={(event) => {
    if (busyId !== null) {
      event.preventDefault()
    }
  }}
>
  {vet.status === 'DRAFT' ? 'Edit listing' : 'View details'}
</Link>
                        {vet.status !== 'DRAFT' && (
                          <button
                            className="admin-vet-secondary"
                            type="button"
                            disabled={locked}
                            onClick={() =>
                              void changeStatus(
                                vet,
                                'RETURN_TO_DRAFT',
                              )
                            }
                          >
                            Return to draft
                          </button>
                        )}

                        {vet.status === 'DRAFT' && (
                          <button
                            className="button dark-button"
                            type="button"
                            disabled={
                              locked || !eligibleToPublish
                            }
                            onClick={() =>
                              void changeStatus(vet, 'PUBLISH')
                            }
                          >
                            {vet.isDemo
                              ? 'Publish demo'
                              : 'Publish listing'}
                          </button>
                        )}

                        {vet.status !== 'ARCHIVED' && (
                          <button
                            className="admin-vet-secondary"
                            type="button"
                            disabled={locked}
                            onClick={() =>
                              void changeStatus(vet, 'ARCHIVE')
                            }
                          >
                            Archive
                          </button>
                        )}
                      </div>

                      {busy && (
                        <p role="status">Saving change…</p>
                      )}
                    </article>
                  )
                })}
              </div>
            )}

            {totalPages > 1 && (
              <nav
                className="admin-vets-pagination"
                aria-label="Admin listing pages"
              >
                <button
                  type="button"
                  disabled={page <= 1 || busyId !== null}
                  onClick={() => changePage(page - 1)}
                >
                  Previous
                </button>

                <span>
                  Page {page} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={
                    page >= totalPages || busyId !== null
                  }
                  onClick={() => changePage(page + 1)}
                >
                  Next
                </button>
              </nav>
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default AdminVets