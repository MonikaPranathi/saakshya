import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { sha256Hex } from '../hash'
import { useToast, ToastContainer } from '../components/Toast'
import CustodyTimeline from '../components/CustodyTimeline'
import FileChecks from '../components/FileChecks'
import { BundleResult, SealedBundleList } from '../components/BundleList'
import { hashFiles, compareBundle, masterFingerprint } from '../bundle'
import { isOnChainRecord, verifyOnChain, explorerTxUrl, netOf } from '../chain'
import {
  Shield,
  UploadCloud,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Copy,
  Check,
  FileQuestion,
  Lock,
  AlertCircle,
  MapPin
} from 'lucide-react'

export default function VerifyPage() {
  const { id } = useParams()
  const inputRef = useRef(null)
  const { toasts, showToast } = useToast()

  const [record, setRecord] = useState(null)
  const [loadingRecord, setLoadingRecord] = useState(true)
  const [recordError, setRecordError] = useState('')

  const [file, setFile] = useState(null)
  const [fileHash, setFileHash] = useState('')
  const [hashing, setHashing] = useState(false)
  const [verdict, setVerdict] = useState(null) // 'genuine' | 'tampered' | null
  const [isDragOver, setIsDragOver] = useState(false)
  const [bundleRows, setBundleRows] = useState(null)

  const [copiedOriginal, setCopiedOriginal] = useState(false)
  const [copiedUploaded, setCopiedUploaded] = useState(false)

  // Chain of custody verifier info
  const [verifierName, setVerifierName] = useState('')
  const [location, setLocation] = useState(null) // { lat, lng, accuracy }
  const [geoStatus, setGeoStatus] = useState('idle') // idle | getting | ok | denied | unsupported
  const [loggedCustody, setLoggedCustody] = useState(false)
  const hasLoggedRef = useRef(false)
  const [chainCheck, setChainCheck] = useState(null) // null | {status, block?}

  useEffect(() => {
    document.title = 'Saakshya — Verify Evidence'
    async function load() {
      try {
        const snap = await getDoc(doc(db, 'evidence', id))
        if (!snap.exists()) {
          setRecordError('Evidence record not found.')
        } else {
          setRecord(snap.data())
        }
      } catch (err) {
        setRecordError(err.message || 'Failed to retrieve evidence record.')
      } finally {
        setLoadingRecord(false)
      }
    }
    load()
  }, [id])

  // Independent on-chain check: read the transaction from a public RPC and compare to the sealed fingerprint.
  useEffect(() => {
    if (!record || !isOnChainRecord(record)) return
    let cancelled = false
    verifyOnChain(record.txHash, record.sha256, record.network).then((r) => { if (!cancelled) setChainCheck(r) })
    return () => { cancelled = true }
  }, [record])

  // The verifier must identify themselves (name OR location) before they can upload a file.
  const identified = verifierName.trim().length >= 3 || !!location

  function handleUseLocation() {
    if (!navigator.geolocation) {
      setGeoStatus('unsupported')
      return
    }
    setGeoStatus('getting')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: Math.round(pos.coords.latitude * 1000) / 1000,
          lng: Math.round(pos.coords.longitude * 1000) / 1000,
          accuracy: Math.round(pos.coords.accuracy || 0),
        })
        setGeoStatus('ok')
      },
      () => setGeoStatus('denied'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    )
  }

  async function processFile(selected) {
    if (!selected || !record || !identified) return
    setFile(selected)
    setVerdict(null)
    setFileHash('')
    setLoggedCustody(false)
    hasLoggedRef.current = false
    setHashing(true)
    try {
      const hex = await sha256Hex(selected)
      setFileHash(hex)
      const isMatch = hex === record.sha256
      const verdictResult = isMatch ? 'Genuine' : 'Tampered'
      setVerdict(isMatch ? 'genuine' : 'tampered')

      // Write exactly ONE custody doc (guard against duplicate writes on re-render)
      if (!hasLoggedRef.current) {
        hasLoggedRef.current = true
        const cleanVerifier = (verifierName || '').trim().slice(0, 80) || 'Name not given (location shared)'
        try {
          await addDoc(collection(db, 'evidence', id, 'custody'), {
            result: verdictResult,
            verifierName: cleanVerifier,
            verifiedAt: serverTimestamp(),
            ...(location ? { location } : {}),
          })
          setLoggedCustody(true)
        } catch (logErr) {
          console.error('Failed to log custody verification:', logErr)
        }
      }
    } catch {
      showToast('Could not calculate hash for this file')
    } finally {
      setHashing(false)
    }
  }

  async function processBundle(files) {
    if (!files.length || !record?.bundle || !identified) return
    setFile(files[0])
    setVerdict(null)
    setFileHash('')
    setBundleRows(null)
    setLoggedCustody(false)
    hasLoggedRef.current = false
    setHashing(true)
    try {
      const uploaded = await hashFiles(files)
      const { ok, rows } = compareBundle(record.bundle, uploaded)
      // the master fingerprint of exactly what was uploaded must also equal the sealed master
      const uploadedMaster = await masterFingerprint(uploaded.map((u) => u.sha256))
      const genuine = ok && uploadedMaster === record.sha256
      setBundleRows(rows)
      setFileHash(uploadedMaster)
      setVerdict(genuine ? 'genuine' : 'tampered')

      if (!hasLoggedRef.current) {
        hasLoggedRef.current = true
        const cleanVerifier = (verifierName || '').trim().slice(0, 80) || 'Name not given (location shared)'
        try {
          await addDoc(collection(db, 'evidence', id, 'custody'), {
            result: genuine ? 'Genuine' : 'Tampered',
            verifierName: cleanVerifier,
            verifiedAt: serverTimestamp(),
            ...(location ? { location } : {}),
          })
          setLoggedCustody(true)
        } catch (logErr) {
          console.error('Failed to log custody verification:', logErr)
        }
      }
    } catch {
      showToast('Could not calculate hashes for these files')
    } finally {
      setHashing(false)
    }
  }

  function handleFileChange(e) {
    if (record?.bundle) {
      processBundle(Array.from(e.target.files || []))
      return
    }
    const selected = e.target.files?.[0]
    if (selected) {
      processFile(selected)
    }
  }

  function handleDragOver(e) {
    e.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave(e) {
    e.preventDefault()
    setIsDragOver(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    setIsDragOver(false)
    if (record?.bundle) {
      processBundle(Array.from(e.dataTransfer.files || []))
      return
    }
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) {
      processFile(dropped)
    }
  }

  function handleReset() {
    setBundleRows(null)
    setFile(null)
    setFileHash('')
    setVerdict(null)
    setLoggedCustody(false)
    hasLoggedRef.current = false
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  async function handleCopyHash(text, type) {
    try {
      await navigator.clipboard.writeText(text)
      if (type === 'original') {
        setCopiedOriginal(true)
        setTimeout(() => setCopiedOriginal(false), 2000)
      } else {
        setCopiedUploaded(true)
        setTimeout(() => setCopiedUploaded(false), 2000)
      }
      showToast('Hash copied to clipboard')
    } catch {
      showToast('Failed to copy hash')
    }
  }

  const sealedDate = record?.sealedAt?.toDate?.()
    ? new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'long',
        timeStyle: 'medium',
      }).format(record.sealedAt.toDate())
    : null

  if (loadingRecord) {
    return (
      <main className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <div className="spinner spinner-teal" style={{ width: 36, height: 36, borderWidth: 3 }} />
        <p style={{ marginTop: 'var(--sp-4)', color: 'var(--color-muted)', fontSize: '0.9rem' }}>
          Loading evidence verification record…
        </p>
      </main>
    )
  }

  if (recordError || !record) {
    return (
      <main className="page-wrapper">
        <div className="card empty-state">
          <FileQuestion size={48} color="var(--color-muted)" strokeWidth={1.5} />
          <h2 className="empty-state-title">Record not found</h2>
          <p className="empty-state-sub">
            {recordError || 'The evidence identifier provided in this link does not correspond to any sealed record.'}
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="page-wrapper">
      <ToastContainer toasts={toasts} />

      <div className="card">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--sp-6)' }}>
          <div style={{ display: 'inline-flex', padding: 10, background: 'rgba(14, 124, 123, 0.08)', borderRadius: '50%', color: 'var(--color-primary)', marginBottom: 8 }}>
            <Shield size={28} strokeWidth={2.2} />
          </div>
          <h1 style={{ fontSize: 'clamp(1.5rem, 3.5vw, 1.85rem)', margin: 0 }}>
            Verify Evidence
          </h1>
          <p className="subtitle" style={{ marginBottom: 0, marginTop: 4 }}>
            Compare your file against the immutable sealed fingerprint
          </p>
        </div>

        {/* Sealed file info chip */}
        <div style={{
          background: 'rgba(14, 124, 123, 0.05)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-btn)',
          padding: 'var(--sp-4)',
          marginBottom: 'var(--sp-6)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-primary)' }}>
              Original Sealed Record
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

          <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--color-primary-dark)', wordBreak: 'break-all' }}>
            {record.fileName}
          </div>
          {sealedDate && (
            <div style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginTop: 2 }}>
              Sealed on {sealedDate}
            </div>
          )}
        </div>

        {isOnChainRecord(record) && (
          <div className={`chain-check chain-${chainCheck?.status || 'loading'}`}>
            {!chainCheck && <span>Checking the blockchain…</span>}
            {chainCheck?.status === 'match' && (
              <span>
                <strong>Found on {netOf(record.network).label}</strong> (block {chainCheck.block}). The sealed fingerprint is recorded on-chain.{' '}
                <a href={explorerTxUrl(record.txHash, record.network)} target="_blank" rel="noreferrer">View transaction ↗</a>
              </span>
            )}
            {chainCheck?.status === 'pending' && <span>Transaction not confirmed on-chain yet. Try again in a minute.</span>}
            {chainCheck?.status === 'mismatch' && <span><strong>Warning:</strong> the on-chain record does not match this fingerprint.</span>}
            {chainCheck?.status === 'error' && <span>Could not reach the blockchain right now.</span>}
          </div>
        )}

        {!verdict && record.bundle?.length > 0 && <SealedBundleList items={record.bundle} />}

        {/* Verifier identity: required before upload */}
        {!verdict && (
          <div style={{ marginBottom: 'var(--sp-4)' }}>
            <label
              htmlFor="verifier-name-input"
              style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: 'var(--color-primary-dark)', marginBottom: 6 }}
            >
              Who is verifying? (your name / department) <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              id="verifier-name-input"
              type="text"
              maxLength={80}
              value={verifierName}
              onChange={(e) => setVerifierName(e.target.value)}
              placeholder="e.g. Inspector Rao, Cyber Crime Cell, Tirupati"
              disabled={hashing}
              style={{
                width: '100%',
                height: 42,
                padding: '0 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1.5px solid var(--color-border)',
                background: '#fff',
                color: 'var(--color-text)',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />

            <div className="verifier-or">or</div>

            <button
              type="button"
              className="btn-outline verifier-loc-btn"
              onClick={handleUseLocation}
              disabled={hashing || geoStatus === 'getting'}
            >
              <MapPin size={15} />
              <span>
                {geoStatus === 'getting'
                  ? 'Getting location…'
                  : location
                  ? `Location shared (${location.lat}, ${location.lng})`
                  : 'Share my location instead'}
              </span>
            </button>

            {geoStatus === 'denied' && (
              <div className="verifier-hint verifier-hint-warn">Location permission was denied. Please type your name instead.</div>
            )}
            {geoStatus === 'unsupported' && (
              <div className="verifier-hint verifier-hint-warn">This browser cannot share location. Please type your name instead.</div>
            )}
            <div className="verifier-hint">
              Required so that every verification is traceable. Each check is logged permanently and cannot be edited or deleted.
            </div>
          </div>
        )}

        {/* File drop zone if no verdict yet */}
        {!verdict && (
          <div>
            <div
              className="drop-zone"
              style={{
                ...(isDragOver && identified ? { borderColor: 'var(--color-primary)', background: 'rgba(14, 124, 123, 0.08)' } : {}),
                ...(!identified ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
              }}
              onClick={() => identified && inputRef.current?.click()}
              onKeyDown={(e) => identified && (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
              onDragOver={(e) => (identified ? handleDragOver(e) : e.preventDefault())}
              onDragLeave={handleDragLeave}
              onDrop={(e) => (identified ? handleDrop(e) : e.preventDefault())}
              tabIndex={identified ? 0 : -1}
              role="button"
              aria-disabled={!identified}
              aria-label="Upload file to verify"
            >
              <input
                ref={inputRef}
                type="file"
                multiple={!!record.bundle}
                disabled={!identified}
                onChange={handleFileChange}
              />
              <UploadCloud size={38} className="drop-zone-icon" strokeWidth={1.75} aria-hidden="true" />
              <div className="drop-zone-label">
                {record.bundle ? `Upload all ${record.bundle.length} files of this case` : 'Upload the file you received'}
              </div>
              <div className="drop-zone-hint">
                {identified ? 'Drag and drop here or click to browse' : 'Enter your name or share your location above to unlock'}
              </div>
            </div>

            {/* Spinner while hashing */}
            {hashing && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 'var(--sp-4)', color: 'var(--color-primary)' }}>
                <span className="spinner spinner-teal" />
                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                  Computing cryptographic fingerprint in browser…
                </span>
              </div>
            )}
          </div>
        )}

        {/* Verdict Cards */}
        {verdict === 'genuine' && (
          <div className="verdict-card genuine">
            <CheckCircle size={56} className="verdict-icon" strokeWidth={2} />
            <div className="verdict-title">Genuine</div>
            <p className="verdict-sub">
              {record.bundle ? 'All files match the sealed case bundle exactly.' : 'This file matches the sealed fingerprint exactly.'}
            </p>
          </div>
        )}

        {verdict === 'tampered' && (
          <div className="verdict-card tampered">
            <AlertTriangle size={56} className="verdict-icon danger" strokeWidth={2} />
            <div className="verdict-title danger">Tampered</div>
            <p className="verdict-sub">
              {record.bundle
                ? 'The files do not match the sealed case bundle. One or more files were changed, missing or added.'
                : 'This file is different from the one that was sealed. Even one changed letter changes the fingerprint.'}
            </p>
          </div>
        )}

        {/* Note indicating verification was logged */}
        {loggedCustody && (
          <div style={{ marginTop: 'var(--sp-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.86rem', color: 'var(--color-success)', fontWeight: 600 }}>
            <Check size={16} strokeWidth={2.5} />
            <span>This verification has been logged.</span>
          </div>
        )}

        {/* Bundle: file by file result */}
        {verdict && record.bundle && bundleRows && <BundleResult rows={bundleRows} />}

        {/* Bundle: reset */}
        {verdict && record.bundle && (
          <div style={{ marginTop: 'var(--sp-4)' }}>
            <button type="button" className="btn btn-secondary btn-full" onClick={handleReset}>
              <RotateCcw size={16} />
              <span>Verify again</span>
            </button>
          </div>
        )}

        {/* Fingerprint Comparison Section */}
        {verdict && !record.bundle && (
          <div style={{ marginTop: 'var(--sp-6)' }}>
            <div className="divider" style={{ margin: '0 0 var(--sp-6)' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
              {/* Sealed original hash */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-muted)' }}>
                    Original Sealed Fingerprint
                  </span>
                </div>
                <div className="hash-row">
                  <div className="hash-box success" tabIndex={0} aria-label="Original hash">
                    {record.sha256}
                  </div>
                  <button
                    type="button"
                    className="copy-btn"
                    onClick={() => handleCopyHash(record.sha256, 'original')}
                    title="Copy original hash"
                    aria-label="Copy original hash"
                  >
                    {copiedOriginal ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {/* Uploaded file hash */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-muted)' }}>
                    Uploaded File Fingerprint {file?.name ? `(${file.name})` : ''}
                  </span>
                  {verdict === 'tampered' && (
                    <span style={{ fontSize: '0.74rem', color: 'var(--color-danger)', fontWeight: 600 }}>
                      Mismatches highlighted
                    </span>
                  )}
                </div>

                <div className="hash-row">
                  <div
                    className={`hash-box ${verdict === 'genuine' ? 'success' : 'danger'}`}
                    tabIndex={0}
                    aria-label="Uploaded file hash"
                  >
                    {verdict === 'tampered' ? (
                      fileHash.split('').map((char, idx) => {
                        const isDiff = char !== record.sha256[idx]
                        return (
                          <span key={idx} className={isDiff ? 'diff-char' : ''}>
                            {char}
                          </span>
                        )
                      })
                    ) : (
                      fileHash
                    )}
                  </div>
                  <button
                    type="button"
                    className="copy-btn"
                    onClick={() => handleCopyHash(fileHash, 'uploaded')}
                    title="Copy uploaded hash"
                    aria-label="Copy uploaded hash"
                  >
                    {copiedUploaded ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Reset button */}
            <div style={{ marginTop: 'var(--sp-6)' }}>
              <button
                type="button"
                className="btn btn-secondary btn-full"
                onClick={handleReset}
              >
                <RotateCcw size={16} />
                <span>Verify another file</span>
              </button>
            </div>
          </div>
        )}

        {/* Chain of Custody Timeline under the fingerprint section */}
        {record.fileChecks?.length > 0 && (
          <FileChecks signals={record.fileChecks} title="File checks at sealing" />
        )}

        <CustodyTimeline evidenceId={id} evidence={record} />
      </div>
    </main>
  )
}
