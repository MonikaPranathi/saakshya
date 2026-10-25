import { useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { ArrowLeft, Camera, CheckCheck, Phone, Video as VideoIcon } from 'lucide-react'

const MESSAGES = [
  { from: 'them', text: 'Dear customer, your SBI account will be BLOCKED today due to incomplete KYC.', time: '10:41' },
  { from: 'them', text: 'To avoid this, update KYC now: http://sbi-kyc-update.in/verify', time: '10:41' },
  { from: 'me', text: 'Who is this? I did not get any notice from the bank.', time: '10:43' },
  { from: 'them', text: 'Share the OTP you receive in the next 5 minutes to confirm your identity. Account will be blocked otherwise.', time: '10:44' },
  { from: 'them', text: 'This is the last warning. Share the OTP now.', time: '10:46' },
]

/**
 * Demo in-app capture. Shows a sample scam chat inside a phone frame and turns it
 * into a PNG exactly like a real in-app screen capture would. Simulated: the real
 * product needs a native app to capture other apps.
 */
export default function DemoCapture({ onCaptured, onBack }) {
  const frameRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState(false)
  const [err, setErr] = useState('')

  async function handleCapture() {
    if (!frameRef.current || busy) return
    setErr('')
    setBusy(true)
    try {
      setFlash(true)
      const canvas = await html2canvas(frameRef.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: false,
        logging: false,
      })
      setTimeout(() => setFlash(false), 220)
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'))
      if (!blob) throw new Error('Could not create the screenshot image.')
      const file = new window.File([blob], `screenshot_${Date.now()}.png`, { type: 'image/png' })
      onCaptured(file)
    } catch (e) {
      setFlash(false)
      setErr(e?.message || 'Capture failed. Please try again.')
    } finally {
      setBusy(false)
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

      <div className="demo-note">Sample scam chat (demo data). Tap capture to seal this screen as evidence.</div>

      <div className="demo-phone-wrap">
        <div className="demo-phone" ref={frameRef}>
          <div className="demo-chat-header">
            <div className="demo-avatar">S</div>
            <div className="demo-chat-title">
              <div className="demo-chat-name">SBI Customer Care</div>
              <div className="demo-chat-sub">unverified number, +91 98xxx xx210</div>
            </div>
            <VideoIcon size={18} aria-hidden="true" />
            <Phone size={17} aria-hidden="true" />
          </div>

          <div className="demo-chat-body">
            <div className="demo-day">Today</div>
            {MESSAGES.map((m, i) => (
              <div key={i} className={`demo-msg demo-msg-${m.from}`}>
                <div>{m.text}</div>
                <div className="demo-msg-time">
                  {m.time}
                  {m.from === 'me' && <CheckCheck size={13} aria-hidden="true" />}
                </div>
              </div>
            ))}
          </div>
        </div>
        {flash && <div className="demo-flash" aria-hidden="true" />}
      </div>

      {err && (
        <div className="alert alert-error" role="alert">
          <span>{err}</span>
        </div>
      )}

      <button type="button" className="btn btn-accent btn-full" onClick={handleCapture} disabled={busy}>
        {busy ? (
          <>
            <span className="spinner" />
            <span>Capturing…</span>
          </>
        ) : (
          <>
            <Camera size={18} />
            <span>Capture this screen</span>
          </>
        )}
      </button>
    </div>
  )
}
