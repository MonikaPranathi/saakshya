# Saakshya (సాక్ష్య): Prove your evidence is untouched

A tamper-evident evidence locker for cybercrime victims. Seal a screenshot, photo, audio or document in seconds; later, anyone (police, a bank, a lawyer) can check whether the file is still exactly the same, without a login.

**Live demo:** https://saakshya-c14e6.web.app
**Team:** Kaccha Badam, Mohan Babu University (Yukthi Hackathon: Blockchain + Cybersecurity)

## The problem
Victims of online fraud and harassment hold screenshots and chats as proof. Those files are easy to edit, easy to doubt, and easy to lose. When the case reaches police or a bank, the question is always "has this been altered?" and today there is no quick way to answer.

## How it works
1. **Capture or select** evidence (camera, screen capture, audio, file, or a multi-file case bundle).
2. **Fingerprint:** the browser computes a SHA-256 hash. **The file never leaves the device**; only the fingerprint, time and metadata are stored.
3. **Seal:** the fingerprint is recorded with a timestamp and a transaction reference, and a certificate with a QR code is issued.
4. **Verify:** anyone opens the link or scans the QR, uploads their copy, and the app recomputes the hash. Same hash = **Genuine**. Any difference = **Tampered**.
5. **Chain of custody:** every verification is logged (who, when, optional location, result) in an append-only log.

## Features
- Browser-side SHA-256 fingerprinting (Web Crypto API)
- Evidence sealing with shareable certificate and QR code
- Public verification with no login, Genuine / Tampered result with the differences highlighted
- **Case bundle:** seal up to 10 files under one master fingerprint; verification shows which file matched, changed or is missing
- **File checks** (signals, not proof): time between file creation and sealing, editing-software hints from image metadata
- **Chain of custody:** verifier name or location is required before verifying, and log entries cannot be edited or deleted
- Share with police / bank, and save a copy of the sealed file
- Google sign-in for the evidence owner; Firestore security rules

## Tech stack
React 18, Vite, React Router, Firebase (Auth, Firestore, Hosting), Web Crypto API, qrcode.react, html2canvas, lucide-react.

## Run locally
```bash
git clone https://github.com/MonikaPranathi/saakshya.git
cd saakshya
npm install
cp .env.example .env     # then fill in your Firebase web config
npm run dev
```
Firebase setup: enable Google sign-in in Authentication, create a Firestore database, and publish rules that allow public read of `evidence`, owner-only create, and append-only writes to `evidence/{id}/custody`. A composite index on `evidence` (`ownerUid` ascending, `sealedAt` descending) is needed for the locker page.

Deploy:
```bash
npm run build
npx firebase-tools deploy --only hosting
```

## Honest limits (prototype)
- **The blockchain record is simulated.** The transaction hash is generated for the demo; the production plan is to anchor fingerprints on a public chain (for example a Polygon testnet, then mainnet).
- **Capture inside the browser is limited.** Mobile browsers cannot record other apps' screens, so the phone demo uses a sample capture; real screen capture is a native-app roadmap item.
- **A hash proves a file has not changed since sealing. It cannot prove the file was genuine before sealing.** File checks are hints only.
- Verifier identity in the chain of custody is self-declared.

## Roadmap
Real on-chain anchoring, native Android capture, PDF certificate, multilingual UI (Telugu / Hindi), integration with cybercrime reporting portals.
