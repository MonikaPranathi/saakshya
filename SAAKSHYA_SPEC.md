# Saakshya: build spec

Prototype web app: a tamper-evident evidence locker for cybercrime victims.
Tagline: "Prove your evidence is untouched."

## Stack
React + Vite, react-router-dom, Firebase (Auth with Google sign-in, Firestore), qrcode.react.
Firebase config comes from `.env` as `VITE_FIREBASE_*` variables. Never hardcode keys.

## Setup (do first)
1. Scaffold in this folder: `npm create vite@latest . -- --template react`
2. `npm i firebase qrcode.react react-router-dom`
3. Create `.env.example` with: VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID
4. Tell me when to fill the real `.env`.

## Routes
- `/login`: "Sign in with Google" button. After login go to `/add`.
- `/add` (login required): Add Evidence.
  - File picker (images, PDF, audio, video).
  - On select, compute SHA-256 in the browser and show it as hex.
  - Button "Generate fingerprint" saves a Firestore doc in collection `evidence`:
    `{ fileName, sha256, ownerUid, sealedAt: serverTimestamp(), txHash: "0x" + 64 random hex, network: "Simulated testnet" }`
  - Then redirect to `/certificate/:id`.
  - The file itself is never uploaded.
- `/certificate/:id` (login required): file name, fingerprint, sealed date and time, a QR code linking to `${window.location.origin}/verify/:id`, and a "Copy verify link" button.
- `/verify/:id` (PUBLIC, no login, mobile friendly):
  - Load the record, show file name and sealed time.
  - User uploads a file, hash it in the browser, compare with the stored `sha256`.
  - Match: big green "Genuine" with a check mark.
  - No match: big red "Tampered".
  - Show both hashes.
- `/locker` (login required): list of the signed-in user's evidence (query by `ownerUid`), each links to its certificate.

## Hashing
Put it in `src/hash.js`: `export async function sha256Hex(file)` using `crypto.subtle.digest("SHA-256", await file.arrayBuffer())`, returned as lowercase hex.

## Design
- Colors: teal `#0E7C7B` primary, orange `#F4A63A` accent, dark teal `#0B3D3F` text, light `#E8F2EF` backgrounds.
- Rounded cards, large readable fonts, works well on phones.
- Navbar: Add, My Locker, Sign out.
- Loading and error states everywhere.
- Footer on every page: "Prototype: blockchain network is simulated. Real use needs partners."

## Rules
- Do not add features beyond this spec.
- When done, run the app and tell me exactly how to test: seal a file, edit one letter in a copy, verify it shows Tampered.
