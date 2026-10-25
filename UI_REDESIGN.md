# Saakshya: UI/UX redesign (do not change functionality)

Redesign ONLY the look and feel. Keep every route, Firebase call, hashing logic and data shape exactly as they are. After the redesign, all flows (login, seal, certificate, locker, verify Genuine/Tampered) must still work.

## 1. Fix layout bugs first
- Delete Vite's default CSS leftovers: `App.css` styles like `#root { max-width; padding; text-align: center }` and `index.css` rules like `body { display: flex; place-items: center }`, `min-width`, default `button` and `a` styles. Replace with a clean reset.
- Add `*, *::before, *::after { box-sizing: border-box }`, `body { margin: 0 }`, no horizontal scroll at any width (320px to 1440px).
- Navbar and footer must be full width. Page content centered in a max-width container (`1080px`), with 16px side padding on phones.
- Use `min-height: 100vh` flex column on the root so the footer sticks to the bottom.

## 2. Design system (put in `src/styles/tokens.css` as CSS variables)
- Fonts (Google Fonts): headings `Lora` (serif, 600/700), body `Inter` (400/500/600). Mono for hashes: `JetBrains Mono`.
- Colors: primary teal `#0E7C7B`, dark teal `#0B3D3F`, accent orange `#F4A63A`, light bg `#F3F8F6`, card `#FFFFFF`, border `#D6E6E2`, text `#10302F`, muted `#5B6B7B`, success `#16A34A` (bg `#E8F7EE`), danger `#DC2626` (bg `#FDECEC`).
- Radius: cards 16px, buttons 12px. Shadows: soft `0 6px 24px rgba(11,61,63,.08)`.
- Spacing scale 4/8/12/16/24/32/48. Base font 16px, headings clamp() so they scale on phones.
- Buttons: primary = solid teal, white text, 48px tall, hover darken + slight lift, focus ring 3px teal at 30% opacity, disabled state. Secondary = outlined teal. Accent = orange for the main "Generate fingerprint" action.
- No emoji as icons. Use inline SVG icons (lucide-react is fine: `npm i lucide-react`).

## 3. Shared layout
- **Navbar:** dark teal bar, sticky top, logo "Saakshya" (serif, "Saak" white + "shya" orange) with a small shield icon on the left. Right: Add, My Locker, Sign out (outlined pill), user avatar/initial. On phones collapse to a compact row with icons only.
- **Footer:** slim, muted text: "Prototype: blockchain network is simulated. Real use needs partners." plus "Team Kaccha Badam · Yukthi".
- Page header pattern: small teal eyebrow label, big serif title, one-line muted subtitle.

## 4. Pages
**/login** (no navbar): two-column on desktop, single column on phones. Left: dark teal panel with big serif "Prove your evidence is untouched.", a short 3-step explainer (Capture, Seal, Verify) with icons, and a subtle fingerprint/blocks illustration made with SVG. Right: white card with "Sign in with Google" button (Google G logo) and a line "Verification never needs a login."

**/add**: stepper at top (1 Choose file, 2 Fingerprint, 3 Sealed). Large dashed drop zone with upload icon, "Drag and drop or click to choose", accepted types listed small. After a file is chosen show a file card (icon by type, name, size) and a fingerprint box in mono font with a "Calculating..." shimmer then the hash, with a copy button. Orange "Generate fingerprint" button, loading spinner while saving. Show a small note: "Your file never leaves your device. Only its fingerprint is saved."

**/certificate/:id**: looks like a real certificate. White card with a teal top border, "Evidence Certificate" serif title, a "Sealed" green badge, details grid (File name, Sealed on, Network "Simulated testnet", Transaction ID shortened with copy), fingerprint in mono box with copy button. QR code in a framed box (160px+) with caption "Scan to verify. No login needed." Buttons: Copy verify link, Print certificate (window.print with print-friendly CSS that hides navbar and footer), Back to locker. Show a toast "Link copied".

**/verify/:id** (public, mobile first): centered card. Top: shield icon, "Verify Evidence". Sealed file info chip (file name, sealed time). Big drop zone "Upload the file you received". While hashing show a spinner. Result card animates in (fade and scale):
- Genuine: green card, large check icon, "Genuine", "This file matches the sealed fingerprint exactly."
- Tampered: red card, large warning icon, "Tampered", "This file is different from the one that was sealed. Even one changed letter changes the fingerprint."
Below: two fingerprints side by side (stack on phones) in mono boxes, and on Tampered highlight the characters that differ in red. A "Verify another file" button resets the state.
If the id does not exist: friendly empty state "Record not found".

**/locker**: grid of evidence cards (1 column phone, 2 tablet, 3 desktop). Each card: file type icon, file name (truncate), sealed date, short fingerprint (first 10 characters...), "View certificate" link. Empty state with illustration and a button "Seal your first evidence". Skeleton loaders while loading. Catch the Firestore index error and show a friendly message instead of the raw error text (wrap long URLs with `word-break: break-all`).

## 5. Polish
- Smooth 150 to 200ms transitions, `prefers-reduced-motion` respected.
- Toast component for copy and errors.
- Good contrast (WCAG AA), visible focus states, alt text and aria-labels.
- Responsive check at 360px, 768px, 1280px. Test: no horizontal scrollbar anywhere.
- Page `<title>` per route and a teal favicon.

## 6. When done
Run the app, then list what changed and confirm the full test passes: seal a file, open the verify link, upload the original (Genuine), upload an edited copy (Tampered).
