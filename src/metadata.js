// Reads simple integrity signals from a file BEFORE it is sealed.
// These are signals, not proof: metadata can be missing or faked.

const EDITORS = [
  'photoshop', 'lightroom', 'gimp', 'snapseed', 'canva', 'picsart', 'pixelmator',
  'affinity', 'paint', 'photopea', 'fotor', 'pixlr', 'facetune', 'vsco', 'remini',
]

function readAscii(view, start, count) {
  let out = ''
  for (let i = 0; i < count; i++) {
    const c = view.getUint8(start + i)
    if (c === 0) break
    out += String.fromCharCode(c)
  }
  return out.trim()
}

function readIfd(view, tiffStart, ifdOffset, little, wanted) {
  const found = {}
  let pos = tiffStart + ifdOffset
  if (pos + 2 > view.byteLength) return found
  const n = view.getUint16(pos, little)
  pos += 2
  for (let i = 0; i < n; i++) {
    const e = pos + i * 12
    if (e + 12 > view.byteLength) break
    const tag = view.getUint16(e, little)
    if (!(tag in wanted)) continue
    const type = view.getUint16(e + 2, little)
    const count = view.getUint32(e + 4, little)
    if (type === 2) {
      const valPos = count <= 4 ? e + 8 : tiffStart + view.getUint32(e + 8, little)
      if (valPos + count <= view.byteLength) found[wanted[tag]] = readAscii(view, valPos, count)
    } else if (type === 4) {
      found[wanted[tag]] = view.getUint32(e + 8, little)
    }
  }
  return found
}

/** Minimal JPEG EXIF reader: Make, Model, Software, DateTime, DateTimeOriginal */
export function parseExifFromBuffer(buf) {
  try {
    const view = new DataView(buf)
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null
    let pos = 2
    while (pos + 4 < view.byteLength) {
      if (view.getUint8(pos) !== 0xff) break
      const marker = view.getUint8(pos + 1)
      const len = view.getUint16(pos + 2)
      if (marker === 0xe1 && readAscii(view, pos + 4, 4) === 'Exif') {
        const tiff = pos + 10
        const little = view.getUint16(tiff) === 0x4949
        const ifd0 = view.getUint32(tiff + 4, little)
        const base = readIfd(view, tiff, ifd0, little, {
          0x010f: 'make', 0x0110: 'model', 0x0131: 'software', 0x0132: 'dateTime', 0x8769: 'exifIfd',
        })
        let original = ''
        if (base.exifIfd) {
          const sub = readIfd(view, tiff, base.exifIfd, little, { 0x9003: 'dateTimeOriginal' })
          original = sub.dateTimeOriginal || ''
        }
        return {
          make: base.make || '',
          model: base.model || '',
          software: base.software || '',
          dateTime: base.dateTime || '',
          dateTimeOriginal: original,
        }
      }
      if (marker === 0xda) break
      pos += 2 + len
    }
    return null
  } catch {
    return null
  }
}

function parseExifDate(str) {
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(str || '')
  if (!m) return null
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])
  return Number.isNaN(d.getTime()) ? null : d
}

export function humanAge(seconds) {
  const s = Math.max(0, Math.round(seconds))
  if (s < 90) return `${s} second${s === 1 ? '' : 's'}`
  const m = Math.round(s / 60)
  if (m < 90) return `${m} minute${m === 1 ? '' : 's'}`
  const h = Math.round(s / 3600)
  if (h < 48) return `${h} hour${h === 1 ? '' : 's'}`
  const d = Math.round(s / 86400)
  return `${d} day${d === 1 ? '' : 's'}`
}

/**
 * @returns {{ fileAgeSeconds:number|null, exifSoftware:string, exifDate:string, signals:{level:'good'|'warn'|'info', text:string}[] }}
 */
export async function analyzeFile(file, captureMethod, nowMs = Date.now()) {
  const signals = []
  const inApp = captureMethod && captureMethod !== 'upload'
  let fileAgeSeconds = null
  if (file.lastModified) fileAgeSeconds = Math.max(0, (nowMs - file.lastModified) / 1000)

  // 1) How old is the file at the moment of sealing?
  if (inApp) {
    signals.push({ level: 'good', text: 'Captured inside Saakshya, so the file was created seconds before sealing.' })
  } else if (fileAgeSeconds !== null) {
    const age = humanAge(fileAgeSeconds)
    if (fileAgeSeconds < 120) {
      signals.push({ level: 'good', text: `File was created ${age} before sealing, a very short gap.` })
    } else if (fileAgeSeconds < 3600) {
      signals.push({
        level: 'info',
        text: `File was created or saved ${age} before sealing. Short gap, but Saakshya cannot see what happened to it before sealing.`,
      })
    } else {
      signals.push({
        level: 'warn',
        text: `File was created or saved ${age} before sealing. Saakshya cannot see whether it was edited in that time.`,
      })
    }
  } else {
    signals.push({ level: 'info', text: 'This file has no modified time, so its age could not be checked.' })
  }

  // 2) Photo metadata (JPEG only)
  let exifSoftware = ''
  let exifDate = ''
  const isJpeg = /jpe?g$/i.test(file.name) || file.type === 'image/jpeg'
  if (isJpeg && !inApp) {
    let exif = null
    try {
      exif = parseExifFromBuffer(await file.slice(0, 262144).arrayBuffer())
    } catch {
      exif = null
    }
    if (!exif) {
      signals.push({ level: 'info', text: 'No camera metadata found. Edited or re-saved images often lose it.' })
    } else {
      exifSoftware = exif.software || ''
      exifDate = exif.dateTimeOriginal || exif.dateTime || ''
      const editor = EDITORS.find((e) => exifSoftware.toLowerCase().includes(e))
      if (editor) {
        signals.push({ level: 'warn', text: `Editing software found in the metadata: ${exifSoftware}.` })
      } else if (exif.make || exif.model) {
        signals.push({ level: 'good', text: `Camera metadata present: ${[exif.make, exif.model].filter(Boolean).join(' ')}.` })
      }
      const taken = parseExifDate(exif.dateTimeOriginal)
      if (taken && file.lastModified && file.lastModified - taken.getTime() > 3600 * 1000) {
        signals.push({
          level: 'warn',
          text: `Photo was taken ${humanAge((file.lastModified - taken.getTime()) / 1000)} before the file was last saved. It may have been re-saved or edited.`,
        })
      }
    }
  }

  return { fileAgeSeconds: fileAgeSeconds === null ? null : Math.round(fileAgeSeconds), exifSoftware, exifDate, signals }
}
