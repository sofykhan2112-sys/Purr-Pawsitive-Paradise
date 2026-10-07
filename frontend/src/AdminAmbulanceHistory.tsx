import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import './AdminVetEditor.css'

type AuditEvent = {
  id: string
  actorId: string | null
  actorLabel: string
  action: string
  createdAt: string
  details: Record<string, unknown> | null
}

type HistoryResponse = {
  listing: {
    id: string
    providerName: string
  }
  events: AuditEvent[]
  hasMore: boolean
}

function AdminAmbulanceHistory() {
  const { id } = useParams()
  const [data, setData] = useState<HistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError('')
      setData(null)

      try {
        if (!id) throw new Error('Listing ID is missing.')

        const response = await fetch(
          `/api/admin/ambulances/${encodeURIComponent(id)}/history`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          },
        )

        const result = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(
            result?.message ?? 'Could not load audit history.',
          )
        }

        if (
          result?.listing?.id !== id ||
          typeof result.listing.providerName !== 'string' ||
          !Array.isArray(result.events) ||
          typeof result.hasMore !== 'boolean'
        ) {
          throw new Error('Unexpected history response.')
        }

        if (!controller.signal.aborted) {
          setData(result)
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(
            error instanceof Error
              ? error.message
              : 'Could not load audit history.',
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => controller.abort()
  }, [id, refresh])

  return (
    <main className="page-width vet-editor-main">
      <Link className="text-link" to="/admin/ambulances">
        Back to Manage ambulances
      </Link>

      <div className="vet-editor-heading">
        <p className="eyebrow">ADMINISTRATION</p>
        <h1>Ambulance audit history</h1>
        {data && <p>{data.listing.providerName}</p>}
        <p>Newest events first. Dates use your browser’s local time.</p>
      </div>

      <button
        className="button dark-button"
        type="button"
        disabled={loading}
        onClick={() => setRefresh((value) => value + 1)}
      >
        {loading ? 'Loading…' : 'Refresh history'}
      </button>

      {loading && <p role="status">Loading audit history…</p>}

      {error && (
        <p className="vet-editor-error" role="alert">
          {error}
        </p>
      )}

      {data && (
        <>
          {data.hasMore && (
            <p className="vet-editor-notice">
              Showing the latest 100 events. Older events remain
              stored in the database.
            </p>
          )}

          {data.events.length === 0 && (
            <p>No audit events recorded for this listing.</p>
          )}

          <ol style={{ paddingLeft: '1.5rem' }}>
            {data.events.map((event) => {
              const reason =
                typeof event.details?.reason === 'string'
                  ? event.details.reason
                  : 'No reason recorded.'

              return (
                <li
                  key={event.id}
                  style={{
                    marginBottom: '1.5rem',
                    paddingBottom: '1rem',
                    borderBottom: '1px solid #ddd',
                    overflowWrap: 'anywhere',
                  }}
                >
                  <h2 style={{ fontSize: '1.1rem' }}>
                    {event.action
                      .replace(/^AMBULANCE_/, '')
                      .replaceAll('_', ' ')}
                  </h2>

                  <p>
                    <time dateTime={event.createdAt}>
                      {new Date(event.createdAt).toLocaleString()}
                    </time>
                  </p>

                  <p>
                    <strong>Recorded actor:</strong>{' '}
                    {event.actorLabel}
                  </p>

                  {event.actorId && (
                    <p>
                      <strong>Account reference:</strong>{' '}
                      {event.actorId}
                    </p>
                  )}

                  <p style={{ whiteSpace: 'pre-wrap' }}>
                    <strong>Reason:</strong> {reason}
                  </p>

                  {event.details && (
                    <details>
                      <summary>Full recorded details</summary>
                      <pre
                        style={{
                          whiteSpace: 'pre-wrap',
                          overflowWrap: 'anywhere',
                          fontSize: '0.85rem',
                        }}
                      >
                        {JSON.stringify(event.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </li>
              )
            })}
          </ol>
        </>
      )}
    </main>
  )
}

export default AdminAmbulanceHistory