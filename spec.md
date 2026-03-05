# VR Video Player

## Current State
Fresh project with default scaffolding — React + TypeScript frontend, Motoko backend. No App component or custom pages exist yet. The index.html has no title and no PWA metadata.

## Requested Changes (Diff)

### Add
- Full-screen split-screen VR layout: two side-by-side panels each 50vw × 100dvh, zero gap
- A single hidden `<video>` element as the source, mirrored onto two `<canvas>` elements via `requestAnimationFrame` for perfect frame sync
- Mirrored controls on both panels: play/pause, seek bar, volume + mute, fullscreen toggle, and video file upload
- PWA manifest + service worker: installable from Android Chrome ("Add to Home Screen"), with `beforeinstallprompt` banner
- Gyroscope stabilization: `DeviceOrientationEvent` applies subtle rotation correction to both canvas panels
- Landscape orientation lock button (requires fullscreen on Android)
- Auto-hiding controls: fade out after 3 s of inactivity, reappear on tap/click
- Portrait guard: overlay prompting user to rotate device when in portrait mode
- `<meta>` viewport tags and theme color for PWA feel

### Modify
- `index.html`: add title "VR Video Player", PWA meta tags, manifest link, theme-color

### Remove
- Nothing existing to remove

## Implementation Plan
1. Update `index.html` with PWA meta tags, manifest link, theme-color, and title
2. Create `public/manifest.json` for PWA install
3. Create `public/sw.js` as a minimal service worker (cache-first for offline shell)
4. Build `App.tsx` as the full VR player:
   - Hidden `<video>` element + two `<canvas>` elements side by side
   - `requestAnimationFrame` loop copying video frames to both canvases
   - Overlay control UI on each panel (mirrored), auto-hiding
   - File input for loading local video
   - `DeviceOrientationEvent` handler for gyro correction
   - `beforeinstallprompt` capture + install banner
   - Portrait guard overlay
   - Orientation lock button wired to Screen Orientation API
