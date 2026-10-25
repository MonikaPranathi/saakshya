import { sha256Hex } from './hash'

/** SHA-256 of a plain text string (reuses the File-based hash helper). */
export async function sha256OfText(text) {
  return sha256Hex(new window.File([text], 'text.txt', { type: 'text/plain' }))
}

/** Master fingerprint = SHA-256 of all file fingerprints, sorted and joined by newlines. */
export async function masterFingerprint(fileHashes) {
  return sha256OfText([...fileHashes].sort().join('\n'))
}

/** Hash every file in the browser. Returns [{ name, size, sha256 }] */
export async function hashFiles(files) {
  const out = []
  for (const f of files) {
    out.push({ name: f.name, size: f.size, sha256: await sha256Hex(f) })
  }
  return out
}

/**
 * Compare uploaded files to a sealed bundle.
 * rows: one per uploaded file ('match' | 'changed') and one per sealed file nobody uploaded ('missing').
 */
export function compareBundle(sealedItems, uploadedItems) {
  const sealedByHash = new Map(sealedItems.map((s) => [s.sha256, s]))
  const matchedHashes = new Set()
  const rows = []
  for (const u of uploadedItems) {
    const hit = sealedByHash.get(u.sha256)
    if (hit && !matchedHashes.has(u.sha256)) {
      matchedHashes.add(u.sha256)
      rows.push({ status: 'match', name: u.name, sealedName: hit.name, sha256: u.sha256 })
    } else {
      rows.push({ status: 'changed', name: u.name, sha256: u.sha256 })
    }
  }
  for (const s of sealedItems) {
    if (!matchedHashes.has(s.sha256)) rows.push({ status: 'missing', name: s.name, sha256: s.sha256 })
  }
  const ok = rows.every((r) => r.status === 'match')
  return { ok, rows }
}

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
