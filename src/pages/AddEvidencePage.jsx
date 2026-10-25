import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../AuthContext'
import { sha256Hex } from '../hash'
import { useToast, ToastContainer } from '../components/Toast'
import DemoCapture from '../components/DemoCapture'
import FileChecks from '../components/FileChecks'
import BundleBuilder from '../components/BundleBuilder'
import { analyzeFile } from '../metadata'
import {
  Camera,
  Monitor,
  Mic,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Music,
  Video,
  File as FileIcon,
  Copy,
  Check,
  Lock,
  AlertCircle,
  Square,
  ArrowLeft,
  RefreshCw,
  Smartphone,
  Download
} from 'lucide-react'

/** Generate 64 random hex characters */
function randomHex64() {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Get representative icon for file type */
function getFileIcon(type = '') {
  if (type.startsWith('image/')) return ImageIcon
  if (type.startsWith('audio/')) return Music
  if (type.startsWith('video/')) return Video
  if (type.includes('pdf')) return FileText
  return FileIcon
}

/** Save a File to the user's device */
function downloadFile(f) {
  const url = URL.createObjectURL(f)
  const a = document.createElement('a')
  a.href = url
  a.download = f.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Format seconds to MM:SS */
function formatTimer(totalSecs) {
  const m = Math.floor(totalSecs / 60).toString().padStart(2, '0')
  const s = (totalSecs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function AddEvidencePage() {
  const user = useAuth()
  const navigate = useNavigate()
  const { toasts, showToast } = useToast()

  // References
  const fileInputRef = useRef(null)
  const mobileCameraInputRef = useRef(null)
  const videoRef = useRef(null)
  const cameraStreamRef = useRef(null)
  const audioStreamRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioIntervalRef = useRef(null)

  // Main state
  // mode: 'select' | 'camera' | 'audio' | 'upload' | 'ready'
  const [mode, setMode] = useState('select')
  const [captureMethod, setCaptureMethod] = useState('upload') // 'camera' | 'screen' | 'audio' | 'upload'
  const [file, setFile] = useState(null)
  const [hash, setHash] = useState('')
  const [hashing, setHashing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isDemoCapture, setIsDemoCapture] = useState(false)
  const [fileMeta, setFileMeta] = useState(null)

  // Audio recording state
  const [isRecordingAudio, setIsRecordingAudio] = useState(false)
  const [audioSeconds, setAudioSeconds] = useState(0)

  // Camera readiness & permission states
  const [cameraReady, setCameraReady] = useState(false)
  const [waitingPermission, setWaitingPermission] = useState(false)

  // Capability check
  const supportsDisplayMedia =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === 'function'

  useEffect(() => {
    document.title = 'Saakshya — Add Evidence'
    return () => {
      stopCameraStream()
      stopAudioStream()
    }
  }, [])

  function stopCameraStream() {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(t => t.stop())
      cameraStreamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraReady(false)
    setWaitingPermission(false)
  }

  function stopAudioStream() {
    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current)
      audioIntervalRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop()
      } catch (err) {
        console.warn('Error stopping media recorder:', err)
      }
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop())
      audioStreamRef.current = null
    }
  }

  // File hashing & processing
  async function processFile(selectedFile, method) {
    if (!selectedFile) return
    setFile(selectedFile)
    setFileMeta(null)
    setHash('')
    setError('')
    setCopied(false)
    setHashing(true)
    setMode('ready')
    try {
      const hex = await sha256Hex(selectedFile)
      setHash(hex)
      try {
        setFileMeta(await analyzeFile(selectedFile, method || 'upload'))
      } catch {
        setFileMeta(null)
      }
    } catch {
      setError('Could not compute cryptographic fingerprint. Please try another file.')
    } finally {
      setHashing(false)
    }
  }

  // 1. Take Photo Flow
  async function initCamera() {
    setError('')
    stopCameraStream()
    stopAudioStream()
    setMode('camera')
    setWaitingPermission(true)
    setCameraReady(false)

    if (!navigator.mediaDevices?.getUserMedia) {
      setWaitingPermission(false)
      setError('Camera API is not supported in this browser. Please use native capture or file upload.')
      return
    }

    try {
      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      }
      setWaitingPermission(false)
      cameraStreamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(e => console.warn(e))
          if ((videoRef.current?.readyState ?? 0) >= 2) {
            setCameraReady(true)
          }
        }
        videoRef.current.oncanplay = () => {
          if ((videoRef.current?.readyState ?? 0) >= 2) {
            setCameraReady(true)
          }
        }
        videoRef.current.onplaying = () => {
          if ((videoRef.current?.readyState ?? 0) >= 2) {
            setCameraReady(true)
          }
        }
      }
    } catch (err) {
      setWaitingPermission(false)
      setCameraReady(false)
      console.warn('Camera permission error:', err)
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera permission was denied. Please allow camera access in browser settings, or use the native camera option below.')
      } else {
        setError(err.message || 'Unable to open camera stream on this device.')
      }
    }
  }

  function capturePhotoFrame() {
    const video = videoRef.current
    if (!video || (video.readyState < 2) || !video.videoWidth) {
      return
    }

    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      stopCameraStream()

      canvas.toBlob((blob) => {
        if (!blob) {
          setError('Failed to create image from camera frame.')
          return
        }
        const capturedFile = new window.File([blob], `photo_${Date.now()}.png`, { type: 'image/png' })
        setCaptureMethod('camera')
        processFile(capturedFile, 'camera')
      }, 'image/png')
    } catch (err) {
      setError(err.message || 'Error capturing frame from camera.')
    }
  }

  // 2. Capture Screen Flow
  async function startScreenCapture() {
    setError('')
    stopCameraStream()
    stopAudioStream()

    if (!supportsDisplayMedia) {
      setError('Screen capture is not supported on this browser or platform.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false,
      })

      const video = document.createElement('video')
      video.srcObject = stream
      video.muted = true
      video.playsInline = true
      await video.play()

      // Give a tiny delay to ensure first frame is decoded
      await new Promise(res => setTimeout(res, 250))

      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 1920
      canvas.height = video.videoHeight || 1080
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Stop tracks immediately
      stream.getTracks().forEach(t => t.stop())
      video.srcObject = null

      canvas.toBlob((blob) => {
        if (!blob) {
          setError('Failed to capture screen image.')
          return
        }
        const screenFile = new window.File([blob], `screen_${Date.now()}.png`, { type: 'image/png' })
        setCaptureMethod('screen')
        processFile(screenFile, 'screen')
      }, 'image/png')
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Screen capture was cancelled or permission was denied.')
      } else {
        setError(err.message || 'Unable to capture screen.')
      }
    }
  }

  // 3. Record Audio Flow
  async function initAudio() {
    setError('')
    stopCameraStream()
    stopAudioStream()
    setMode('audio')
    setAudioSeconds(0)
    setIsRecordingAudio(false)

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Audio recording is not supported in this browser.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioStreamRef.current = stream

      let mimeType = 'audio/webm'
      if (typeof MediaRecorder !== 'undefined') {
        if (!MediaRecorder.isTypeSupported('audio/webm')) {
          if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4'
          else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg'
          else mimeType = ''
        }
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = recorder
      const chunks = []

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data)
        }
      }

      recorder.onstop = () => {
        if (audioIntervalRef.current) {
          clearInterval(audioIntervalRef.current)
          audioIntervalRef.current = null
        }
        setIsRecordingAudio(false)

        if (chunks.length > 0) {
          const finalMime = recorder.mimeType || 'audio/webm'
          const ext = finalMime.includes('mp4') ? 'm4a' : finalMime.includes('ogg') ? 'ogg' : 'webm'
          const audioBlob = new Blob(chunks, { type: finalMime })
          const audioFile = new window.File([audioBlob], `recording_${Date.now()}.${ext}`, { type: finalMime })
          setCaptureMethod('audio')
          processFile(audioFile, 'audio')
        }
        stopAudioStream()
      }

      recorder.start(100)
      setIsRecordingAudio(true)

      audioIntervalRef.current = setInterval(() => {
        setAudioSeconds(prev => prev + 1)
      }, 1000)
    } catch (err) {
      console.warn('Audio permission error:', err)
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Microphone permission was denied. Please allow microphone access in browser settings.')
      } else {
        setError(err.message || 'Could not access microphone on this device.')
      }
      setMode('select')
    }
  }

  function stopAudioRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }

  // 4. Upload File Flow
  function handleFileChange(e) {
    const selected = e.target.files?.[0]
    if (selected) {
      setCaptureMethod('upload')
      processFile(selected, 'upload')
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
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) {
      setCaptureMethod('upload')
      processFile(droppedFile, 'upload')
    }
  }

  // Reset to option selection
  function handleReset() {
    stopCameraStream()
    stopAudioStream()
    setFile(null)
    setHash('')
    setError('')
    setMode('select')
    setCaptureMethod('upload')
    setIsDemoCapture(false)
    setFileMeta(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (mobileCameraInputRef.current) mobileCameraInputRef.current.value = ''
  }

  async function handleCopyHash() {
    if (!hash) return
    try {
      await navigator.clipboard.writeText(hash)
      setCopied(true)
      showToast('Fingerprint copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast('Failed to copy')
    }
  }

  async function handleGenerateFingerprint() {
    if (!file || !hash) return
    setError('')
    setSaving(true)
    try {
      const docRef = await addDoc(collection(db, 'evidence'), {
        fileName: file.name,
        sha256: hash,
        ownerUid: user.uid,
        sealedAt: serverTimestamp(),
        txHash: '0x' + randomHex64(),
        network: 'Simulated testnet',
        captureMethod: captureMethod || 'upload',
        ...(isDemoCapture ? { demoCapture: true } : {}),
        ...(fileMeta
          ? {
              fileChecks: fileMeta.signals,
              fileAgeSeconds: fileMeta.fileAgeSeconds ?? null,
              exifSoftware: fileMeta.exifSoftware || '',
              exifDate: fileMeta.exifDate || '',
            }
          : {}),
      })
      navigate(`/certificate/${docRef.id}`, { state: { evidenceFile: file } })
    } catch (err) {
      setError(err.message || 'Failed to save evidence. Check your Firebase configuration.')
    } finally {
      setSaving(false)
    }
  }

  const step1Done = !!file
  const step2Done = !!hash && !hashing
  const FileTypeIcon = file ? getFileIcon(file.type) : FileIcon

  return (
    <main className="page-wrapper">
      <ToastContainer toasts={toasts} />

      {/* Hidden mobile camera fallback input */}
      <input
        ref={mobileCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => {
          const selected = e.target.files?.[0]
          if (selected) {
            setCaptureMethod('camera')
            processFile(selected, 'camera')
          }
        }}
      />

      {/* Page Header */}
      <div className="page-header">
        <div className="eyebrow">Evidence Locker</div>
        <h1>Add Evidence</h1>
        <p className="subtitle">
          Capture or select a file to fingerprint. The file is never uploaded — only its cryptographic hash is stored.
        </p>
      </div>

      <div className="card">
        {/* Stepper */}
        <div className="stepper" aria-label="Evidence sealing progress">
          <div className="step">
            <div className={`step-dot ${step1Done ? 'done' : 'active'}`}>
              {step1Done ? <Check size={14} strokeWidth={3} /> : '1'}
            </div>
            <span className={`step-label ${step1Done ? 'done' : 'active'}`}>
              Choose source
            </span>
          </div>

          <div className={`step-line ${step1Done ? 'done' : ''}`} />

          <div className="step">
            <div className={`step-dot ${step2Done ? 'done' : file ? 'active' : ''}`}>
              {step2Done ? <Check size={14} strokeWidth={3} /> : '2'}
            </div>
            <span className={`step-label ${step2Done ? 'done' : file ? 'active' : ''}`}>
              Fingerprint
            </span>
          </div>

          <div className={`step-line ${saving ? 'done' : ''}`} />

          <div className="step">
            <div className={`step-dot ${saving ? 'active' : ''}`}>
              3
            </div>
            <span className={`step-label ${saving ? 'active' : ''}`}>
              Sealed
            </span>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="alert alert-error" role="alert" style={{ marginBottom: 'var(--sp-4)' }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* ── MODE 1: SELECT 4 CAPTURE OPTIONS ── */}
        {mode === 'select' && (
          <div>
            <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--color-primary-dark)', marginBottom: 4 }}>
              Choose capture method:
            </div>

            <div className="capture-grid">
              {/* Option 1: Take Photo */}
              <button
                type="button"
                className="capture-card"
                onClick={initCamera}
                aria-label="Take photo with camera"
              >
                <div className="capture-card-icon">
                  <Camera size={24} strokeWidth={2} />
                </div>
                <div className="capture-card-title">Take photo</div>
                <div className="capture-card-desc">
                  Open device camera and snap instant proof
                </div>
              </button>

              {/* Option 2: Capture Screen (hidden if unsupported) */}
              {supportsDisplayMedia && (
                <button
                  type="button"
                  className="capture-card"
                  onClick={startScreenCapture}
                  aria-label="Capture screen frame"
                >
                  <div className="capture-card-icon">
                    <Monitor size={24} strokeWidth={2} />
                  </div>
                  <div className="capture-card-title">Capture screen</div>
                  <div className="capture-card-desc">
                    Grab one frame from your window or screen
                  </div>
                </button>
              )}

              {/* Option: Demo capture (works on phones too) */}
              <button
                type="button"
                className="capture-card"
                onClick={() => { stopCameraStream(); stopAudioStream(); setError(''); setMode('demo') }}
                aria-label="Capture a sample screen (demo)"
              >
                <div className="capture-card-icon">
                  <Smartphone size={24} strokeWidth={2} />
                </div>
                <div className="capture-card-title">Capture screen (demo)</div>
                <div className="capture-card-desc">
                  Capture a sample scam chat. Works on phones too
                </div>
              </button>

              {/* Option 3: Record Audio */}
              <button
                type="button"
                className="capture-card"
                onClick={initAudio}
                aria-label="Record audio with microphone"
              >
                <div className="capture-card-icon">
                  <Mic size={24} strokeWidth={2} />
                </div>
                <div className="capture-card-title">Record audio</div>
                <div className="capture-card-desc">
                  Record voice memo or live audio evidence
                </div>
              </button>

              {/* Option: Case bundle (many files, one master seal) */}
              <button
                type="button"
                className="capture-card"
                onClick={() => { stopCameraStream(); stopAudioStream(); setError(''); setMode('bundle') }}
                aria-label="Seal many files as one case bundle"
              >
                <div className="capture-card-icon">
                  <FileText size={24} strokeWidth={2} />
                </div>
                <div className="capture-card-title">Case bundle</div>
                <div className="capture-card-desc">
                  Seal many files of one case with one master fingerprint
                </div>
              </button>

              {/* Option 4: Upload File */}
              <button
                type="button"
                className="capture-card"
                onClick={() => setMode('upload')}
                aria-label="Upload file from device"
              >
                <div className="capture-card-icon">
                  <UploadCloud size={24} strokeWidth={2} />
                </div>
                <div className="capture-card-title">Upload file</div>
                <div className="capture-card-desc">
                  Select existing image, PDF, audio or video
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ── MODE 2: LIVE CAMERA ── */}
        {mode === 'camera' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={handleReset}
                className="btn-outline"
                style={{ padding: '6px 12px', fontSize: '0.82rem', height: 32, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <ArrowLeft size={14} /> Back to options
              </button>

              <button
                type="button"
                onClick={() => mobileCameraInputRef.current?.click()}
                style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Smartphone size={14} /> Device camera fallback
              </button>
            </div>

            <div className="camera-container" style={{ minHeight: 260, justifyContent: 'center' }}>
              {waitingPermission && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: '#fff', padding: 'var(--sp-6)', textAlign: 'center' }}>
                  <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
                  <div style={{ fontWeight: 600, fontSize: '0.98rem' }}>Waiting for camera permission…</div>
                  <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.72)', maxWidth: 320 }}>
                    Please grant camera access when prompted by your browser to capture photo evidence.
                  </div>
                </div>
              )}

              {cameraReady && (
                <div className="camera-badge">
                  <span className="pulse-dot" />
                  <span>LIVE CAMERA</span>
                </div>
              )}

              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={waitingPermission ? { display: 'none' } : {}}
                className="camera-preview"
                onLoadedMetadata={() => {
                  videoRef.current?.play().catch(e => console.warn(e))
                  if ((videoRef.current?.readyState ?? 0) >= 2) {
                    setCameraReady(true)
                  }
                }}
                onCanPlay={() => {
                  if ((videoRef.current?.readyState ?? 0) >= 2) {
                    setCameraReady(true)
                  }
                }}
                onPlaying={() => {
                  if ((videoRef.current?.readyState ?? 0) >= 2) {
                    setCameraReady(true)
                  }
                }}
              />
            </div>

            <button
              type="button"
              className="btn btn-primary btn-full"
              onClick={capturePhotoFrame}
              disabled={!cameraReady || hashing || saving}
            >
              {waitingPermission ? (
                <>
                  <span className="spinner" />
                  <span>Waiting for camera permission…</span>
                </>
              ) : !cameraReady ? (
                <>
                  <span className="spinner" />
                  <span>Starting camera…</span>
                </>
              ) : (
                <>
                  <Camera size={18} />
                  <span>Capture Photo</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* ── MODE: DEMO SCREEN CAPTURE ── */}
        {mode === 'demo' && !file && (
          <DemoCapture
            onBack={handleReset}
            onCaptured={(f) => {
              setCaptureMethod('screen')
              setIsDemoCapture(true)
              processFile(f, 'screen')
            }}
          />
        )}

        {/* ── MODE: CASE BUNDLE ── */}
        {mode === 'bundle' && !file && <BundleBuilder onBack={handleReset} />}

        {/* ── MODE 3: RECORD AUDIO ── */}
        {mode === 'audio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <button
                type="button"
                onClick={handleReset}
                className="btn-outline"
                style={{ padding: '6px 12px', fontSize: '0.82rem', height: 32, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <ArrowLeft size={14} /> Back to options
              </button>
            </div>

            <div className="audio-recorder-box">
              <div className="record-pulse-ring">
                <Mic size={32} />
              </div>

              <div>
                <div className="record-timer">{formatTimer(audioSeconds)}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginTop: 4 }}>
                  {isRecordingAudio ? 'Recording audio in progress…' : 'Preparing microphone…'}
                </div>
              </div>

              <button
                type="button"
                className="btn btn-accent"
                onClick={stopAudioRecording}
                disabled={!isRecordingAudio}
                style={{ minWidth: 200 }}
              >
                <Square size={16} fill="currentColor" />
                <span>Stop and fingerprint</span>
              </button>
            </div>
          </div>
        )}

        {/* ── MODE 4: UPLOAD FILE ── */}
        {mode === 'upload' && !file && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <button
                type="button"
                onClick={handleReset}
                className="btn-outline"
                style={{ padding: '6px 12px', fontSize: '0.82rem', height: 32, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <ArrowLeft size={14} /> Back to options
              </button>
            </div>

            <div
              className="drop-zone"
              style={isDragOver ? { borderColor: 'var(--color-primary)', background: 'rgba(14, 124, 123, 0.08)' } : {}}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              tabIndex={0}
              role="button"
              aria-label="Upload file to fingerprint"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf,audio/*,video/*"
                onChange={handleFileChange}
              />
              <UploadCloud size={40} className="drop-zone-icon" strokeWidth={1.75} aria-hidden="true" />
              <div className="drop-zone-label">Drag and drop or click to choose</div>
              <div className="drop-zone-hint">
                Supports images, PDF documents, audio, and video files
              </div>
            </div>
          </div>
        )}

        {/* ── READY STATE: FILE SELECTED & FINGERPRINT COMPUTED ── */}
        {file && (
          <div style={{ marginTop: 'var(--sp-2)' }}>
            {/* File info card with source badge */}
            <div className="file-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <FileTypeIcon size={24} color="var(--color-primary)" strokeWidth={2} style={{ flexShrink: 0 }} aria-hidden="true" />
                <div style={{ minWidth: 0 }}>
                  <div className="file-card-name">{file.name}</div>
                  <div className="file-card-meta">
                    {(file.size / 1024).toFixed(1)} KB · {file.type || 'Binary file'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {captureMethod === 'upload' ? (
                  <span className="badge-source-upload" style={{ fontSize: '0.72rem' }}>Uploaded file</span>
                ) : (
                  <span className="badge-source-app" style={{ fontSize: '0.72rem' }}>
                    Captured in app ({captureMethod}{isDemoCapture ? ', demo' : ''})
                  </span>
                )}
                {captureMethod !== 'upload' && (
                  <button
                    type="button"
                    onClick={() => downloadFile(file)}
                    className="btn-outline"
                    style={{ height: 28, padding: '0 8px', fontSize: '0.75rem', borderRadius: 6 }}
                    title="Save a copy of this evidence file"
                  >
                    <Download size={12} />
                    <span>Save copy</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleReset}
                  className="btn-outline"
                  style={{ height: 28, padding: '0 8px', fontSize: '0.75rem', borderRadius: 6 }}
                  title="Choose another method or file"
                >
                  <RefreshCw size={12} />
                  <span>Change</span>
                </button>
              </div>
            </div>

            {/* Calculating shimmer */}
            {hashing && (
              <div style={{ marginTop: 'var(--sp-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--color-primary)', marginBottom: 6 }}>
                  <span className="spinner spinner-teal" />
                  <span>Calculating SHA-256 fingerprint in browser…</span>
                </div>
                <div className="hash-shimmer" />
              </div>
            )}

            {/* Fingerprint display */}
            {hash && !hashing && (
              <div style={{ marginTop: 'var(--sp-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-muted)' }}>
                    SHA-256 Fingerprint
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-primary)', fontWeight: 500 }}>
                    Computed in browser
                  </span>
                </div>

                <div className="hash-row">
                  <div className="hash-box" tabIndex={0} aria-label="Computed hash">
                    {hash}
                  </div>
                  <button
                    type="button"
                    className="copy-btn"
                    onClick={handleCopyHash}
                    title="Copy hash"
                    aria-label="Copy hash"
                  >
                    {copied ? <Check size={16} color="var(--color-success)" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            )}

            {fileMeta && !hashing && <FileChecks signals={fileMeta.signals} />}

            {/* Client-side guarantee note */}
            <div className="alert alert-info" style={{ marginTop: 'var(--sp-6)' }}>
              <Lock size={16} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
              <span>Your file never leaves your device. Only its cryptographic fingerprint is saved. Save a copy of the evidence file yourself; you will need it to verify later.</span>
            </div>

            {/* Action Button */}
            <div style={{ marginTop: 'var(--sp-6)' }}>
              <button
                type="button"
                className="btn btn-accent btn-full"
                onClick={handleGenerateFingerprint}
                disabled={!hash || hashing || saving}
              >
                {saving ? (
                  <>
                    <span className="spinner" />
                    <span>Sealing evidence on testnet…</span>
                  </>
                ) : (
                  <>
                    <Lock size={18} strokeWidth={2.2} aria-hidden="true" />
                    <span>Generate fingerprint</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
