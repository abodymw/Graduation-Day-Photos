# Graduation Day Photos

A simple shared page: anyone with the link can upload photos (from gallery or camera) and download any photo at full original quality. No accounts needed for guests.

## How it works

- Static site (`index.html`, `style.css`, `app.js`) hosted on GitHub Pages.
- Photos are stored as raw files in Firebase Storage (a plain file bucket, not an image CDN), so no resizing or recompression ever happens and downloads are byte-for-byte identical to what was uploaded.
- `firebase-config.js` holds the public Firebase project identifiers (safe to expose; access is controlled by Storage Security Rules, not secrecy).

## One-time setup (only needed once)

1. Go to https://console.firebase.google.com and create a project (Analytics can be skipped).
2. In the left sidebar: **Build → Storage → Get started** → pick a location → start in production mode.
3. Go to the **Rules** tab of Storage and paste in `storage.rules` (in this folder), then **Publish**.
4. Go to **Project settings** (gear icon) → **General** → scroll to "Your apps" → click the web icon `</>` → register an app (nickname e.g. "photo-site") → copy the `firebaseConfig` object shown.
5. Paste those values into `firebase-config.js` in this folder, replacing the `REPLACE_ME` placeholders.
6. Commit and push, GitHub Pages will serve the updated site automatically.

## Limits

- Max 30 MB per photo (matches `storage.rules`), plenty for full-resolution phone photos.
- Firebase's free tier gives 5 GB storage and 1 GB/day of downloads, which resets daily, comfortably enough for a graduation-day link shared among friends.

## Abuse protection (already set up)

- Firebase Storage now requires the Blaze (pay-as-you-go) plan; a $1/month budget alert with email notifications at 50/90/100% was auto-created when upgrading.
- App Check (reCAPTCHA Enterprise) is wired into `firebase-config.js` with a site key restricted to the `abodymw.github.io` domain, so only this site can use the Storage bucket.
- **Still needed after deploying to GitHub Pages**: once the live site is confirmed working, go to Firebase Console → App Check → APIs, and switch Storage from "Unenforced" to "Enforced". Leaving it unenforced until then means App Check is monitoring but not yet blocking anything.
