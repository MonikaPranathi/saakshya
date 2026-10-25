import { Check, AlertTriangle, FileText, AlertCircle, Info } from 'lucide-react'
import { formatSize } from '../bundle'

const CHECK_ICON = { good: Check, warn: AlertCircle, info: Info }

/** Small per-file list of integrity signals (age, editing software, photo date). */
export function MiniChecks({ signals = [] }) {
  if (!signals.length) return null
  return (
    <ul className="minichecks">
      {signals.map((sg, i) => {
        const Icon = CHECK_ICON[sg.level] || Info
        return (
          <li key={i} className={`minichecks-item filechecks-${sg.level}`}>
            <Icon size={13} strokeWidth={2.4} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{sg.text}</span>
          </li>
        )
      })}
    </ul>
  )
}

/** Sealed files inside a case bundle (certificate view). */
export function SealedBundleList({ items = [] }) {
  if (!items.length) return null
  return (
    <div className="bundle-box">
      <div className="bundle-title">Files in this case bundle ({items.length})</div>
      <ul className="bundle-list">
        {items.map((it, i) => (
          <li key={i} className="bundle-row">
            <FileText size={16} color="var(--color-primary)" aria-hidden="true" style={{ flexShrink: 0 }} />
            <div className="bundle-row-main">
              <div className="bundle-name">{it.name}</div>
              <div className="bundle-sub">
                {formatSize(it.size || 0)} · <span className="bundle-hash">{(it.sha256 || '').slice(0, 16)}…</span>
              </div>
              <MiniChecks signals={it.checks} />
            </div>
          </li>
        ))}
      </ul>
      <div className="bundle-note">
        Master fingerprint = SHA-256 of all file fingerprints (sorted). Change, add or remove any file and the master changes.
      </div>
    </div>
  )
}

const STATUS = {
  match: { icon: Check, cls: 'ok', label: 'Genuine' },
  changed: { icon: AlertTriangle, cls: 'bad', label: 'Changed or not in the bundle' },
  missing: { icon: AlertCircle, cls: 'bad', label: 'Missing (not uploaded)' },
}

/** Per-file result of a bundle verification. */
export function BundleResult({ rows = [] }) {
  return (
    <div className="bundle-box">
      <div className="bundle-title">File by file result</div>
      <ul className="bundle-list">
        {rows.map((r, i) => {
          const s = STATUS[r.status]
          const Icon = s.icon
          return (
            <li key={i} className={`bundle-row bundle-${s.cls}`}>
              <Icon size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
              <div className="bundle-row-main">
                <div className="bundle-name">{r.name}</div>
                <div className="bundle-sub">{s.label}</div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
