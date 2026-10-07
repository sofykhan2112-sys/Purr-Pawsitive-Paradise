import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import './AdminVetEditor.css'

type Report = {
  id: string
  targetLabel: string
  category: string
  details: string
  status: string
  resolutionSummary: string | null
  createdAt: string
  closedAt: string | null
}

type ReportPage = {
  reports: Report[]
  total: number
  totalPages: number
}

function displayTime(value: string) {
  const date = new Date(value)

  if (!Number.isFinite(date.getTime())) return 'Unknown'

  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
  })
}

function MyReports() {
  const [data, setData] = useState<ReportPage | null>(null)
  const [page, setPage] = useState(1)
  const [refresh, setRefresh] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [needsLogin, setNeedsLogin] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setData(null)
      setError('')
      setNeedsLogin(false)

      try {
        const response = await fetch(
          `/api/issue-reports?page=${page}`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          },
        )

        const result = await response.json().catch(() => null)

        if (controller.signal.aborted) return

        if (response.status === 401) {
          setNeedsLogin(true)
        }

        if (!response.ok) {
          throw new Error(result?.message ?? 'Could not load your reports.')
        }

        if (
          !Array.isArray(result?.reports) ||
          !Number.isInteger(result.total) ||
          result.total < 0 ||
          !Number.isInteger(result.totalPages) ||
          result.totalPages < 0
        ) {
          throw new Error('Unexpected reports response.')
        }

        const lastPage = Math.max(1, result.totalPages)

        if (page > lastPage) {
          setPage(lastPage)
          return
        }

        setData(result)
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(
            error instanceof Error
              ? error.message
              : 'Could not load your reports.',
          )
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [page, refresh])

  return (
    <main className="page-width vet-editor-main">
      <Link className="text-link" to="/account">
        Back to my account
      </Link>

      <div className="vet-editor-heading">
        <p className="eyebrow">FEEDBACK AND CORRECTIONS</p>
        <h1>My reports</h1>
        <p>
          Track issues you reported. Reports are not an emergency
          contact service. Dates are shown in IST.
        </p>
      </div>

      <button
        className="button dark-button"
        type="button"
        disabled={loading}
        onClick={() => setRefresh((value) => value + 1)}
      >
        {loading ? 'Loading…' : 'Refresh reports'}
      </button>

      {loading && <p role="status">Loading your reports…</p>}

      {error && (
        <p className="vet-editor-error" role="alert">
          {error}
        </p>
      )}

      {needsLogin && (
        <Link className="text-link" to="/login">
          Sign in
        </Link>
      )}

      {!loading && data && (
        <>
          <p>{data.total} report(s).</p>

          {data.reports.length === 0 && (
            <p>You have not submitted any reports yet.</p>
          )}

          {data.reports.map((report) => (
            <section
              key={report.id}
              style={{
                marginTop: '1.5rem',
                padding: '1.25rem',
                border: '1px solid #ddd',
                borderRadius: '12px',
                overflowWrap: 'anywhere',
              }}
            >
              <h2>{report.targetLabel}</h2>

              <p>
                <strong>Status:</strong>{' '}
                {report.status.replaceAll('_', ' ')}
              </p>

              <p>
                <strong>Category:</strong>{' '}
                {report.category.replaceAll('_', ' ')}
              </p>

              <p style={{ whiteSpace: 'pre-wrap' }}>
                <strong>Your report:</strong> {report.details}
              </p>

              {report.resolutionSummary && (
                <p style={{ whiteSpace: 'pre-wrap' }}>
                  <strong>Review outcome:</strong>{' '}
                  {report.resolutionSummary}
                </p>
              )}

              <p>
                <strong>Submitted:</strong>{' '}
                {displayTime(report.createdAt)} IST
              </p>

              {report.closedAt && (
                <p>
                  <strong>Closed:</strong>{' '}
                  {displayTime(report.closedAt)} IST
                </p>
              )}

              <p>
                <strong>Report reference:</strong> {report.id}
              </p>
            </section>
          ))}

          {data.totalPages > 1 && (
            <nav
              className="vet-editor-actions"
              aria-label="My report pages"
              style={{ marginTop: '1rem' }}
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

export default MyReports