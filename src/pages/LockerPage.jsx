import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../AuthContext'
import {
  FileText,
  Image as ImageIcon,
  Music,
  Video,
  File as FileIcon,
  ArrowRight,
  Plus,
  Shield,
  FolderOpen,
  AlertCircle
} from 'lucide-react'

function getFileIcon(fileName = '') {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return ImageIcon
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) return Music
  if (['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)) return Video
  if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) return FileText
  return FileIcon
}

export default function LockerPage() {
  const user = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [indexLink, setIndexLink] = useState('')

  useEffect(() => {
    document.title = 'Saakshya — My Locker'

    if (!user) return

    async function fetchEvidence() {
      try {
        const q = query(
          collection(db, 'evidence'),
          where('ownerUid', '==', user.uid),
          orderBy('sealedAt', 'desc'),
        )
        const snap = await getDocs(q)
        setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (err) {
        console.warn('Primary query failed:', err)
        const errMsg = err?.message || ''

        // Check for Firestore index error
        if (errMsg.toLowerCase().includes('index')) {
          // Extract URL if present
          const urlMatch = errMsg.match(/https:\/\/[^\s]+/g)
          if (urlMatch) {
            setIndexLink(urlMatch[0])
          }

          // Fallback: query without order and sort client-side
          try {
            const fallbackQ = query(
              collection(db, 'evidence'),
              where('ownerUid', '==', user.uid)
            )
            const snap = await getDocs(fallbackQ)
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            docs.sort((a, b) => {
              const timeA = a.sealedAt?.toDate ? a.sealedAt.toDate().getTime() : 0
              const timeB = b.sealedAt?.toDate ? b.sealedAt.toDate().getTime() : 0
              return timeB - timeA
            })
            setItems(docs)
          } catch (fallbackErr) {
            setError('A Firestore index is needed to sort your records. Please create it in your Firebase console.')
          }
        } else {
          setError(errMsg || 'Failed to retrieve evidence items.')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchEvidence()
  }, [user])

  return (
    <main className="main-content">
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 'var(--sp-4)', marginBottom: 'var(--sp-6)' }}>
        <div>
          <div className="eyebrow">Vault</div>
          <h1 style={{ margin: 0 }}>My Locker</h1>
          <p className="subtitle" style={{ marginBottom: 0, marginTop: 4 }}>
            All cryptographic evidence you have sealed
          </p>
        </div>

        {!loading && items.length > 0 && (
          <Link to="/add" className="btn btn-primary" style={{ height: 42, padding: '0 18px', fontSize: '0.88rem' }}>
            <Plus size={16} strokeWidth={2.5} />
            <span>Seal new evidence</span>
          </Link>
        )}
      </div>

      {/* Firestore Index Notice if applicable */}
      {indexLink && (
        <div className="alert alert-info" style={{ marginBottom: 'var(--sp-4)' }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <span>Firestore index recommended for optimal ordering. Create index here: </span>
            <a
              href={indexLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-primary)', textDecoration: 'underline', wordBreak: 'break-all' }}
            >
              {indexLink}
            </a>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="alert alert-error" role="alert" style={{ marginBottom: 'var(--sp-6)' }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ wordBreak: 'break-all' }}>{error}</span>
        </div>
      )}

      {/* Loading Skeletons */}
      {loading && (
        <div className="locker-grid">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="card" style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 8 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ height: 16, width: '70%', marginBottom: 6 }} />
                  <div className="skeleton" style={{ height: 12, width: '40%' }} />
                </div>
              </div>
              <div className="skeleton" style={{ height: 26, width: '100%', borderRadius: 4 }} />
              <div className="skeleton" style={{ height: 14, width: '35%', marginTop: 6 }} />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && items.length === 0 && (
        <div className="card empty-state">
          <div style={{ padding: 16, background: 'rgba(14, 124, 123, 0.08)', borderRadius: '50%', color: 'var(--color-primary)' }}>
            <FolderOpen size={48} strokeWidth={1.5} />
          </div>
          <h2 className="empty-state-title">No evidence sealed yet</h2>
          <p className="empty-state-sub" style={{ maxWidth: 420 }}>
            Protect your digital files against tampering. Fingerprint any document, photo, or audio record to establish mathematical proof of integrity.
          </p>
          <Link to="/add" className="btn btn-primary" style={{ marginTop: 'var(--sp-3)' }}>
            <Plus size={18} strokeWidth={2.5} />
            <span>Seal your first evidence</span>
          </Link>
        </div>
      )}

      {/* Items Grid */}
      {!loading && items.length > 0 && (
        <div className="locker-grid">
          {items.map((item) => {
            const Icon = getFileIcon(item.fileName)
            const date = item.sealedAt?.toDate?.()
              ? new Intl.DateTimeFormat('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(item.sealedAt.toDate())
              : 'Sealed recently'

            const shortHash = item.sha256
              ? `${item.sha256.slice(0, 10)}...`
              : 'Fingerprint pending'

            return (
              <Link
                key={item.id}
                to={`/certificate/${item.id}`}
                className="locker-card"
                aria-label={`View certificate for ${item.fileName}`}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-3)' }}>
                  <div style={{
                    padding: 8,
                    background: 'rgba(14, 124, 123, 0.08)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--color-primary)',
                    flexShrink: 0
                  }}>
                    <Icon size={20} strokeWidth={2} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="locker-card-name" title={item.fileName}>
                      {item.fileName}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginTop: 2 }}>
                      <span className="locker-card-date">{date}</span>
                      {item.captureMethod && item.captureMethod !== 'upload' && (
                        <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--color-success)', background: 'var(--color-success-bg)', padding: '1px 6px', borderRadius: 'var(--radius-pill)' }}>
                          In-app
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{
                  background: 'var(--color-bg)',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.74rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--color-muted)',
                  border: '1px solid var(--color-border)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {shortHash}
                </div>

                <div className="locker-card-footer">
                  <span>View certificate</span>
                  <ArrowRight size={14} />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
