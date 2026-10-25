import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithPopup } from 'firebase/auth'
import { auth, provider } from '../firebase'
import { Camera, Lock, CheckCircle, Shield } from 'lucide-react'

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

const CHIPS = [
  { icon: Camera, label: 'Capture', desc: 'Choose a file: image, PDF, audio or video.' },
  { icon: Lock, label: 'Seal', desc: 'We fingerprint it with SHA-256. The file stays on your device.' },
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
    <div className="login-page">
      <header className="login-nav">
        <div className="login-logo">
          <Shield size={24} strokeWidth={2.2} aria-hidden="true" />
          <span>Saak<span>shya</span></span>
        </div>
      </header>

      <main className="login-hero">
        <section className="login-copy">
          <span className="login-pill">Tamper-evident evidence locker</span>
          <h1 className="login-title">
            Prove your evidence is <span>untouched.</span>
          </h1>
          <p className="login-lede">
            Seal a file's fingerprint in seconds. Anyone can verify it later, no login needed.
          </p>
          <div className="login-chips">
            {CHIPS.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="login-chip" title={desc}>
                <Icon size={18} strokeWidth={2} aria-hidden="true" />
                {label}
              </div>
            ))}
          </div>
        </section>

        <aside className="login-side">
          <div className="login-card">
            <div>
              <div className="login-card-title">Welcome back</div>
              <p className="login-card-sub">Sign in to seal and manage your evidence.</p>
            </div>

            <button
              className="btn-google btn-full"
              onClick={handleGoogleSignIn}
              disabled={loading}
              aria-label="Sign in with Google"
            >
              <GoogleLogo />
              {loading
                ? <><span className="spinner spinner-teal" style={{ border: '2.5px solid rgba(109,40,217,0.2)', borderTopColor: 'var(--color-primary)' }} /> Signing in…</>
                : 'Continue with Google'}
            </button>

            {error && (
              <div className="alert alert-error" role="alert">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span>{error}</span>
              </div>
            )}

            <p className="login-note">Verification never needs a login. Share the link freely.</p>
          </div>

          <div className="login-sealed" aria-hidden="true">
            <div className="login-sealed-icon"><Shield size={20} strokeWidth={2.2} /></div>
            <div>
              <div className="login-sealed-name">complaint_screenshot.png</div>
              <div className="login-sealed-meta">Example · Sealed 3f8a1c7d…4b60</div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}
