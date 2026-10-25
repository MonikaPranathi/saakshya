import { Check, AlertCircle, Info } from 'lucide-react'

const ICON = { good: Check, warn: AlertCircle, info: Info }

/** Shows integrity signals found in a file's metadata. */
export default function FileChecks({ signals = [], title = 'File checks' }) {
  if (!signals.length) return null
  return (
    <div className="filechecks">
      <div className="filechecks-title">{title}</div>
      <ul className="filechecks-list">
        {signals.map((s, i) => {
          const Icon = ICON[s.level] || Info
          return (
            <li key={i} className={`filechecks-item filechecks-${s.level}`}>
              <Icon size={15} strokeWidth={2.4} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{s.text}</span>
            </li>
          )
        })}
      </ul>
      <div className="filechecks-note">These are signals, not proof. Metadata can be missing or changed.</div>
    </div>
  )
}
