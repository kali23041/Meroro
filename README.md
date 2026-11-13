# Meroro

Phone streaming studio for macOS and Windows: mirror an Android phone (or a single app) and go live on YouTube.

Electron + React + Tailwind v4 + Radix. Phone capture talks directly to `scrcpy-server` over adb; output goes through ffmpeg to RTMP.

```bash
npm install        # also downloads adb, scrcpy-server and ffmpeg into bin/
npm run dev        # run in development
npm run dist:mac   # dist/Meroro-<version>-arm64.dmg  (run on a Mac)
npm run dist:win   # dist/Meroro Setup <version>.exe   (run on Windows)
```

If `npm install` skips the post-install step, run `node scripts/fetch-bins.mjs` once.

On the phone: Settings → Developer options → USB debugging, then plug it in and tap **Allow**.
