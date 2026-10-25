import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithPopup } from 'firebase/auth'
import { auth, provider } from '../firebase'
import { Camera, Lock, CheckCircle } from 'lucide-react'

// ── Google "G" logo ──
function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      <path fill="none" d="M0 0h48v48H0z"/>
    </svg>
  )
}

// ── Fingerprint SVG illustration ──
function FingerprintIllustration() {
  return (
    <svg width="260" height="260" viewBox="0 0 260 260" fill="none" aria-hidden="true"
      style={{ opacity: 0.13, position: 'absolute', right: -20, bottom: -20, pointerEvents: 'none' }}>
      <circle cx="130" cy="130" r="100" stroke="white" strokeWidth="2"/>
      <circle cx="130" cy="130" r="80"  stroke="white" strokeWidth="2"/>
      <circle cx="130" cy="130" r="60"  stroke="white" strokeWidth="2"/>
      <circle cx="130" cy="130" r="40"  stroke="white" strokeWidth="2"/>
      <circle cx="130" cy="130" r="20"  stroke="white" strokeWidth="2"/>
      <path d="M130 30 C 130 30 160 60 160 130 C 160 200 130 230 130 230" stroke="white" strokeWidth="2"/>
      <path d="M130 50 C 130 50 150 75 150 130 C 150 185 130 210 130 210" stroke="white" strokeWidth="2"/>
      <path d="M130 70 C 130 70 142 90 142 130 C 142 170 130 190 130 190" stroke="white" strokeWidth="2"/>
    </svg>
  )
}

const STEPS = [
  { icon: Camera, label: 'Capture', desc: 'Choose a file — image, PDF, audio or video.' },
  { icon: Lock,   label: 'Seal',    desc: 'We fingerprint it with SHA-256. The file stays on your device.' },
  { icon: CheckCircle, label: 'Verify', desc: 'Anyone with the link can verify the file is untouched.' },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  // Update page title
  useEffect(() => { document.title = 'Saakshya — Sign in' }, [])

  async function handleGoogleSignIn() {
    setError('')
    setLoading(true)
    try {
      await signInWithPopup(auth, provider)
      navigate('/add')
    } catch (err) {
      setError(err.message || 'Sign-in failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-layout">
      {/* ── Left panel ── */}
      <div className="login-left" style={{ position: 'relative', overflow: 'hidden' }}>
        <FingerprintIllustration />

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#F4A63A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span style={{ fontFamily: 'Lora, serif', fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>
              Saak<span style={{ color: '#F4A63A' }}>shya</span>
            </span>
          </div>

          <p className="login-tagline">
            Prove your evidence is <span>untouched.</span>
          </p>

          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginTop: 12, marginBottom: 32 }}>
            A tamper-evident locker for cybercrime victims.
          </p>
        </div>

        <div className="step-explainer">
          {STEPS.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="step-item">
              <div className="step-item-icon">
                <Icon size={18} strokeWidth={2} aria-hidden="true" />
              </div>
              <div className="step-item-text">
                <strong>{label}</strong>
                <span>{desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="login-right">
        <div className="login-card">
          <div>
            <div className="eyebrow">Welcome</div>
            <div className="login-card-title">Sign in to Saakshya</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              className="btn-google btn-full"
              onClick={handleGoogleSignIn}
              disabled={loading}
              aria-label="Sign in with Google"
            >
              <GoogleLogo />
              {loading
                ? <><span className="spinner spinner-teal" style={{ border: '2.5px solid rgba(14,124,123,0.2)', borderTopColor: 'var(--color-primary)' }} /> Signing in…</>
                : 'Sign in with Google'}
            </button>

            {error && (
              <div className="alert alert-error" role="alert">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span>{error}</span>
              </div>
            )}
          </div>

          <p className="login-note">
            Verification never needs a login — share the link freely.
          </p>
        </div>
      </div>
    </div>
  )
}
