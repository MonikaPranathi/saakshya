import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../AuthContext'
import { hashFiles, masterFingerprint, formatSize } from '../bundle'
import { analyzeFile } from '../metadata'
import { MiniChecks } from './BundleList'
import { ArrowLeft, UploadCloud, Lock, FileText, X, AlertCircle } from 'lucide-react'

function randomHex64() {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('')
}

const MAX_FILES = 10

function bundleSummary(items) {
  const warned = items.filter((i) => (i.checks || []).some((c) => c.level === 'warn')).length
  const out = [
    {
      level: 'info',
      text: `Case bundle of ${items.length} files. Each file is fingerprinted separately and combined into one master fingerprint.`,
    },
  ]
  if (warned > 0) {
    out.push({
      level: 'warn',
      text: `${warned} of ${items.length} files need attention (for example, files that are old at sealing). See each file below.`,
    })
  } else {
    out.push({ level: 'good', text: 'No warnings found in any file.' })
  }
  return out
}

/** Seal many files as ONE case bundle with one master fingerprint. */
export default function BundleBuilder({ onBack }) {
  const user = useAuth()
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [items, setItems] = useState([]) // { name, size, sha256 }
  const [master, setMaster] = useState('')
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)

  async function addFiles(fileList) {
    const incoming = Array.from(fileList || [])
    if (!incoming.length) return
    setError('')
    setBusy(true)
    try {
      const hashed = await hashFiles(incoming)
      const merged = [...items]
      for (let i = 0; i < hashed.length; i++) {
        const h = hashed[i]
        if (merged.some((m) => m.sha256 === h.sha256)) continue
        let checks = []
        let fileAgeSeconds = null
        try {
          const meta = await analyzeFile(incoming[i], 'upload')
          checks = meta.signals
          fileAgeSeconds = meta.fileAgeSeconds
        } catch {
          checks = []
        }
        merged.push({ ...h, checks, fileAgeSeconds })
      }
      if (merged.length > MAX_FILES) {
        setError(`A bundle can hold up to ${MAX_FILES} files in this prototype.`)
        return
      }
      setItems(merged)
      setMaster(await masterFingerprint(merged.map((m) => m.sha256)))
    } catch {
      setError('Could not fingerprint one of the files. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function removeItem(idx) {
    const next = items.filter((_, i) => i !== idx)
    setItems(next)
    setMaster(next.length ? await masterFingerprint(next.map((m) => m.sha256)) : '')
  }

  async function handleSeal() {
    if (items.length < 2 || !master) return
    setSaving(true)
    setError('')
    try {
      const docRef = await addDoc(collection(db, 'evidence'), {
        fileName: `Case bundle (${items.length} files)`,
        sha256: master,
        ownerUid: user.uid,
        sealedAt: serverTimestamp(),
        txHash: '0x' + randomHex64(),
        network: 'Simulated testnet',
        captureMethod: 'upload',
        bundle: items.map((i) => ({
          name: i.name,
          size: i.size,
          sha256: i.sha256,
          fileAgeSeconds: i.fileAgeSeconds ?? null,
          checks: i.checks || [],
        })),
        bundleCount: items.length,
        fileChecks: bundleSummary(items),
      })
      navigate(`/certificate/${docRef.id}`)
    } catch (err) {
      setError(err.message || 'Failed to seal the bundle.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <button
          type="button"
          onClick={onBack}
          className="btn-outline"
          style={{ padding: '6px 12px', fontSize: '0.82rem', height: 32, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <ArrowLeft size={14} /> Back to options
        </button>
      </div>

      <div className="demo-note">
        Put all files of one case together (chat screenshots, bank statement, call recording). They are sealed as one bundle with one master fingerprint.
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div
        className="drop-zone"
        style={isDragOver ? { borderColor: 'var(--color-primary)', background: 'rgba(14, 124, 123, 0.08)' } : {}}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false) }}
        onDrop={(e) => { e.preventDefault(); setIsDragOver(false); addFiles(e.dataTransfer.files) }}
        tabIndex={0}
        role="button"
        aria-label="Add files to the case bundle"
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,audio/*,video/*"
          onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
        />
        <UploadCloud size={36} className="drop-zone-icon" strokeWidth={1.75} aria-hidden="true" />
        <div className="drop-zone-label">{items.length ? 'Add more files' : 'Choose 2 or more files'}</div>
        <div className="drop-zone-hint">Select many at once or add them one by one</div>
      </div>

      {busy && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-primary)', fontSize: '0.88rem' }}>
          <span className="spinner spinner-teal" />
          <span>Calculating fingerprints in your browser…</span>
        </div>
      )}

      {items.length > 0 && (
        <div className="bundle-box">
          <div className="bundle-title">Files in this bundle ({items.length})</div>
          <ul className="bundle-list">
            {items.map((it, i) => (
              <li key={it.sha256} className="bundle-row">
                <FileText size={16} color="var(--color-primary)" aria-hidden="true" style={{ flexShrink: 0 }} />
                <div className="bundle-row-main">
                  <div className="bundle-name">{it.name}</div>
                  <div className="bundle-sub">
                    {formatSize(it.size)} · <span className="bundle-hash">{it.sha256.slice(0, 16)}…</span>
                  </div>
                  <MiniChecks signals={it.checks} />
                </div>
                <button type="button" className="bundle-remove" onClick={() => removeItem(i)} aria-label={`Remove ${it.name}`}>
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {master && (
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-muted)', marginBottom: 6 }}>
            Master fingerprint
          </div>
          <div className="hash-box" tabIndex={0} aria-label="Master fingerprint">{master}</div>
        </div>
      )}

      <div className="alert alert-info">
        <Lock size={16} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
        <span>Your files never leave your device. Only fingerprints are saved. Keep your own copy of every file; you need them to verify.</span>
      </div>

      <button
        type="button"
        className="btn btn-accent btn-full"
        onClick={handleSeal}
        disabled={items.length < 2 || !master || busy || saving}
      >
        {saving ? (
          <>
            <span className="spinner" />
            <span>Sealing bundle…</span>
          </>
        ) : (
          <>
            <Lock size={18} strokeWidth={2.2} aria-hidden="true" />
            <span>{items.length < 2 ? 'Add at least 2 files' : 'Seal case bundle'}</span>
          </>
        )}
      </button>
    </div>
  )
}
