import { useEffect, useState } from 'react'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { ShieldCheck, CheckCircle, AlertTriangle, User, Clock, MapPin } from 'lucide-react'

function formatTimestamp(timestamp) {
  if (!timestamp) return 'Just now'
  if (typeof timestamp.toDate === 'function') {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(timestamp.toDate())
  }
  return 'Just now'
}

function getCaptureMethodText(method, demo) {
  if (method === 'camera') return 'Captured in app (Camera)'
  if (method === 'screen') return demo ? 'Captured in app (Screen capture, demo)' : 'Captured in app (Screen capture)'
  if (method === 'audio') return 'Captured in app (Audio recording)'
  return 'Uploaded file'
}

export default function CustodyTimeline({ evidenceId, evidence }) {
  const [custodyLogs, setCustodyLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!evidenceId) return

    const q = query(
      collection(db, 'evidence', evidenceId, 'custody'),
      orderBy('verifiedAt', 'asc')
    )

    let fallbackUnsubscribe = null

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const logs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setCustodyLogs(logs)
        setLoading(false)
      },
      (error) => {
        console.warn('Ordered custody query error, falling back to unordered listener:', error)
        // Fallback: listener without orderBy to guard against any index issues
        const fallbackQuery = collection(db, 'evidence', evidenceId, 'custody')
        fallbackUnsubscribe = onSnapshot(
          fallbackQuery,
          (fallbackSnap) => {
            const logs = fallbackSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
            logs.sort((a, b) => {
              const timeA = a.verifiedAt?.toDate ? a.verifiedAt.toDate().getTime() : 0
              const timeB = b.verifiedAt?.toDate ? b.verifiedAt.toDate().getTime() : 0
              return timeA - timeB
            })
            setCustodyLogs(logs)
            setLoading(false)
          },
          (fallbackErr) => {
            console.error('Fallback custody listener failed:', fallbackErr)
            setLoading(false)
          }
        )
      }
    )

    return () => {
      unsubscribe()
      if (fallbackUnsubscribe) fallbackUnsubscribe()
    }
  }, [evidenceId])

  const sealedDate = formatTimestamp(evidence?.sealedAt)
  const captureMethodLabel = getCaptureMethodText(evidence?.captureMethod, evidence?.demoCapture)

  return (
    <div className="custody-section">
      <div className="divider" style={{ margin: 'var(--sp-6) 0' }} />

      <h3 className="custody-title">Chain of custody</h3>
      <p className="custody-subtitle">
        Records who verified this evidence and when. It does not prove the verifier checked correctly.
      </p>

      <div className="timeline">
        {/* Entry 1: Always "Sealed" from the evidence doc */}
        <div className="timeline-item">
          <div className="timeline-node">
            <ShieldCheck size={14} strokeWidth={2.5} />
          </div>
          <div className="timeline-header">
            <span className="timeline-action">Sealed</span>
            <span className="timeline-meta">{sealedDate}</span>
          </div>
          <div className="timeline-detail">
            Source: <span style={{ fontWeight: 600 }}>{captureMethodLabel}</span>
          </div>
        </div>

        {/* Subsequent entries: Each custody verification doc */}
        {custodyLogs.map((log) => {
          const isGenuine = log.result === 'Genuine'
          const time = formatTimestamp(log.verifiedAt)

          return (
            <div key={log.id} className="timeline-item">
              <div className={`timeline-node ${isGenuine ? 'genuine' : 'tampered'}`}>
                {isGenuine ? (
                  <CheckCircle size={14} strokeWidth={2.5} />
                ) : (
                  <AlertTriangle size={14} strokeWidth={2.5} />
                )}
              </div>

              <div className="timeline-header">
                <span className="timeline-action">Verified</span>
                <span className={isGenuine ? 'badge-genuine-sm' : 'badge-tampered-sm'}>
                  {isGenuine ? (
                    <CheckCircle size={10} strokeWidth={3} />
                  ) : (
                    <AlertTriangle size={10} strokeWidth={3} />
                  )}
                  <span>{log.result}</span>
                </span>
                <span className="timeline-meta">{time}</span>
              </div>

              <div className="timeline-detail" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <User size={13} color="var(--color-muted)" />
                <span>
                  Verified by: <span className="timeline-verifier">{log.verifierName || 'Anonymous'}</span>
                </span>
              </div>
              {log.location && typeof log.location.lat === 'number' && (
                <div className="timeline-location">
                  <MapPin size={13} color="var(--color-muted)" />
                  <span>
                    Location: {log.location.lat}, {log.location.lng}
                    {log.location.accuracy ? ` (about ${log.location.accuracy} m)` : ''}{' '}
                    <a href={`https://www.google.com/maps?q=${log.location.lat},${log.location.lng}`} target="_blank" rel="noopener noreferrer">
                      View on map
                    </a>
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Empty State when no verifications exist yet */}
      {!loading && custodyLogs.length === 0 && (
        <div style={{ marginTop: 'var(--sp-4)' }}>
          <div className="timeline-empty">No verifications yet.</div>
        </div>
      )}
    </div>
  )
}
