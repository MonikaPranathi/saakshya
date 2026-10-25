/**
 * Compute SHA-256 of a File object using the Web Crypto API.
 * Returns the digest as a lowercase hex string.
 */
export async function sha256Hex(file) {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
