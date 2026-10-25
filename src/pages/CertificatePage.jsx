import { useEffect, useState } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { QRCodeSVG } from 'qrcode.react'
import { db } from '../firebase'
import { useToast, ToastContainer } from '../components/Toast'
import {
  Check,
  Copy,
  Printer,
  ArrowLeft,
  Share2,
  ShieldCheck,
  AlertCircle,
  Download,
  Send
} from 'lucide-react'
import CustodyTimeline from '../components/CustodyTimeline'
import FileChecks from '../components/FileChecks'
import { SealedBundleList } from '../components/BundleList'

export default function CertificatePage() {
  const { id } = useParams()
  const location = useLocation()
  const evidenceFile = location.state?.evidenceFile || null
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedHash, setCopiedHash] = useState(false)
  const [copiedTx, setCopiedTx] = useState(false)

  const { toasts, showToast } = useToast()

  const verifyUrl = `${window.location.origin}/verify/${id}`

  useEffect(() => {
    document.title = 'Saakshya — Evidence Certificate'
    async function load() {
      try {
        const snap = await getDoc(doc(db, 'evidence', id))
        if (!snap.exists()) {
          setError('Evidence record not found.')
        } else {
          setRecord(snap.data())
        }
      } catch (err) {
        setError(err.message || 'Failed to load certificate.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(verifyUrl)
      setCopiedLink(true)
      showToast('Verify link copied to clipboard')
      setTimeout(() => setCopiedLink(false), 2000)
    } catch {
      showToast('Could not copy link')
    }
  }

  async function handleCopyHash() {
    if (!record?.sha256) return
    try {
      await navigator.clipboard.writeText(record.sha256)
      setCopiedHash(true)
      showToast('Fingerprint copied to clipboard')
      setTimeout(() => setCopiedHash(false), 2000)
    } catch {
      showToast('Could not copy fingerprint')
    }
  }

  async function handleCopyTx() {
    if (!record?.txHash) return
    try {
      await navigator.clipboard.writeText(record.txHash)
      setCopiedTx(true)
      showToast('Transaction hash copied')
      setTimeout(() => setCopiedTx(false), 2000)
    } catch {
      showToast('Could not copy transaction hash')
    }
  }

  function handleDownloadEvidence() {
    if (!evidenceFile) return
    const url = URL.createObjectURL(evidenceFile)
    const a = document.createElement('a')
    a.href = url
    a.download = evidenceFile.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  async function handleShareWithPolice() {
    const when = record?.sealedAt?.toDate?.()
      ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(record.sealedAt.toDate())
      : ''
    const text =
      `Saakshya evidence certificate: ${record?.fileName || 'evidence'}${when ? `, sealed on ${when}` : ''}.\n` +
      `Verify here (no login needed): ${verifyUrl}\n` +
      `Verification needs the original evidence file, so please attach it with this message.`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Saakshya evidence certificate', text, url: verifyUrl })
        return
      }
    } catch (err) {
      if (err?.name === 'AbortError') return
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }

  function handlePrint() {
    window.print()
  }

  if (loading) {
    return (
      <main className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <div className="spinner spinner-teal" style={{ width: 36, height: 36, borderWidth: 3 }} />
        <p style={{ marginTop: 'var(--sp-4)', color: 'var(--color-muted)', fontSize: '0.9rem' }}>
          Retrieving sealed evidence certificate…
        </p>
      </main>
    )
  }

  if (error || !record) {
    return (
      <main className="page-wrapper">
        <div className="card empty-state">
          <AlertCircle size={44} color="var(--color-danger)" strokeWidth={1.5} />
          <h2 className="empty-state-title">Evidence Not Found</h2>
          <p className="empty-state-sub">{error || 'This certificate does not exist or may have been removed.'}</p>
          <Link to="/locker" className="btn btn-secondary" style={{ marginTop: 'var(--sp-4)' }}>
            <ArrowLeft size={16} /> Return to Locker
          </Link>
        </div>
      </main>
    )
  }

  const sealedDate = record.sealedAt?.toDate?.()
    ? new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'long',
        timeStyle: 'medium',
      }).format(record.sealedAt.toDate())
    : 'Pending verification…'

  const shortTx = record.txHash
    ? `${record.txHash.slice(0, 10)}...${record.txHash.slice(-8)}`
    : '0x—'

  return (
    <main className="page-wrapper">
      <ToastContainer toasts={toasts} />

      {/* Navigation breadcrumb */}
      <div className="no-print" style={{ marginBottom: 'var(--sp-4)' }}>
        <Link to="/locker" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: 'var(--color-muted)', fontWeight: 500 }}>
          <ArrowLeft size={14} /> Back to My Locker
        </Link>
      </div>

      {/* Certificate Card */}
      <div className="cert-card">
        <div className="cert-top-border" />
        <div className="cert-body">
          {/* Header Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--sp-3)', marginBottom: 'var(--sp-6)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 'var(--sp-3)' }}>
                <div className="cert-badge-sealed">
                  <ShieldCheck size={13} strokeWidth={2.5} />
                  <span>Sealed & Verified</span>
                </div>

                {record.captureMethod === 'camera' || record.captureMethod === 'screen' || record.captureMethod === 'audio' ? (
                  <div className="badge-source-app">
                    <Check size={12} strokeWidth={2.5} />
                    <span>Captured in app</span>
                  </div>
                ) : (
                  <div className="badge-source-upload">
                    <AlertCircle size={12} strokeWidth={2} />
                    <span>Uploaded file (source not verified)</span>
                  </div>
                )}
              </div>

              <h1 style={{ fontSize: 'clamp(1.5rem, 3.5vw, 1.9rem)', margin: 0 }}>
                Evidence Certificate
              </h1>
              <p style={{ color: 'var(--color-muted)', fontSize: '0.88rem', marginTop: 4 }}>
                Tamper-evident record sealed on simulated ledger
              </p>
            </div>
          </div>

          <div className="divider" style={{ margin: 'var(--sp-4) 0 var(--sp-6)' }} />

          {/* Details Grid */}
          <div className="cert-grid">
            <div>
              <div className="cert-field-label">File Name</div>
              <div className="cert-field-value">{record.fileName}</div>
            </div>

            <div>
              <div className="cert-field-label">Sealed Timestamp</div>
              <div className="cert-field-value">{sealedDate}</div>
            </div>

            <div>
              <div className="cert-field-label">Blockchain Network</div>
              <div className="cert-field-value">{record.network || 'Simulated testnet'}</div>
            </div>

            <div>
              <div className="cert-field-label">Capture Source</div>
              <div className="cert-field-value">
                {record.captureMethod === 'camera'
                  ? 'Camera (In-app)'
                  : record.captureMethod === 'screen'
                  ? (record.demoCapture ? 'Screen Capture (In-app, demo)' : 'Screen Capture (In-app)')
                  : record.captureMethod === 'audio'
                  ? 'Audio Recording (In-app)'
                  : 'Uploaded File'}
              </div>
            </div>

            <div>
              <div className="cert-field-label">Transaction ID</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="cert-tx-short" title={record.txHash}>{shortTx}</span>
                <button
                  type="button"
                  className="copy-btn no-print"
                  style={{ width: 26, height: 26, marginTop: 0 }}
                  onClick={handleCopyTx}
                  title="Copy full transaction hash"
                  aria-label="Copy full transaction hash"
                >
                  {copiedTx ? <Check size={12} color="var(--color-success)" /> : <Copy size={12} />}
                </button>
              </div>
            </div>
          </div>

          {/* Fingerprint Full Box */}
          <div style={{ marginTop: 'var(--sp-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="cert-field-label" style={{ marginBottom: 0 }}>
                SHA-256 Cryptographic Fingerprint
              </span>
            </div>
            <div className="hash-row">
              <div className="hash-box" tabIndex={0} aria-label="Evidence hash">
                {record.sha256}
              </div>
              <button
                type="button"
                className="copy-btn no-print"
                onClick={handleCopyHash}
                title="Copy hash"
                aria-label="Copy hash"
              >
                {copiedHash ? <Check size={15} color="var(--color-success)" /> : <Copy size={15} />}
              </button>
            </div>
          </div>

          {/* Chain of Custody Timeline */}
          {record.bundle?.length > 0 && <SealedBundleList items={record.bundle} />}

          {record.fileChecks?.length > 0 && (
            <FileChecks signals={record.fileChecks} title="File checks at sealing" />
          )}

          <CustodyTimeline evidenceId={id} evidence={record} />

          <div className="divider" style={{ margin: 'var(--sp-6) 0' }} />

          {/* QR Code Section */}
          <div className="qr-frame">
            <div style={{ padding: 12, background: '#ffffff', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
              <QRCodeSVG
                value={verifyUrl}
                size={168}
                fgColor="#0B3D3F"
                bgColor="#ffffff"
                level="M"
              />
            </div>
            <div className="qr-caption">
              Scan to verify. No login needed.
            </div>
          </div>

          {/* Action Buttons */}
          <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', marginTop: 'var(--sp-6)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--sp-3)' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCopyLink}
              >
                {copiedLink ? <Check size={18} /> : <Share2 size={18} />}
                <span>{copiedLink ? 'Link copied!' : 'Copy verify link'}</span>
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleShareWithPolice}
              >
                <Send size={18} />
                <span>Share with police / bank</span>
              </button>

              {evidenceFile && (
                <button
                  type="button"
                  className="btn btn-accent"
                  onClick={handleDownloadEvidence}
                >
                  <Download size={18} />
                  <span>Download evidence file</span>
                </button>
              )}

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handlePrint}
              >
                <Printer size={18} />
                <span>Print certificate</span>
              </button>
            </div>

            <Link
              to="/locker"
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <ArrowLeft size={16} />
              <span>Back to locker</span>
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
