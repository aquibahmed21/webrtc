# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

KiteCite — a peer-to-peer WebRTC video conferencing PWA. Vanilla TypeScript (no framework), built with Vite. Real-time video/audio/chat between browser peers, signaled via Scaledrone (a hosted pub/sub relay), with no media or message storage on any server.

## Commands

```bash
npm run dev          # Vite dev server (opens browser automatically)
npm run build         # tsc typecheck + vite build (multi-page: index, callui, signin)
npm run preview       # Preview the production build
npm run type-check    # tsc --noEmit only
npm run deploy         # Build and publish dist/ to GitHub Pages (gh-pages -d dist)
npm test               # vitest (watch mode)
npm run test:run       # vitest run (single pass, CI-style)
npm run test:ui        # vitest with UI
```

There are no test files in the repo yet (`vitest`/`jsdom` are configured and ready, but nothing under `src` matches `*.test.ts`/`*.spec.ts`). When adding tests, note `tsconfig.json` explicitly excludes `**/*.test.ts` and `**/*.spec.ts` from the production build.

Run a single test file once tests exist: `npx vitest run path/to/file.test.ts`.

## Architecture

### Entry points and build
Vite builds three separate HTML pages (configured in `vite.config.js` `rollupOptions.input`):
- `index.html` — main call page, loads `src/typescript/main.ts` (service worker registration) and `src/typescript/app.ts` (UI wiring/orchestration) as ES modules.
- `callui.html`, `signin.html` — secondary pages.

`@/*` resolves to `src/*` (both in `vite.config.js` and `tsconfig.json`).

### Signaling and connection flow
There is no application backend for call signaling — **Scaledrone** (a third-party hosted pub/sub service, channel ID hardcoded in `signalling.ts`) relays offer/answer/ICE-candidate messages between peers. The flow across modules:

1. `signalling.ts` (`createScaledrone`) opens the Scaledrone connection/room and exposes raw `open`/`message` events, with its own exponential-backoff reconnect loop independent of the app-level reconnect logic.
2. `room.ts` (`setupRoom`) is the core WebRTC orchestrator: creates/tears down `RTCPeerConnection`s per peer, handles the offer/answer/ICE-candidate message dance (`handleMessage`'s big switch on `data.type`: `offer`/`answer`/`candidate`/`join`/`leave`/`screenShare`/`chat`/`dm`/`invite`), queues ICE candidates until `remoteDescription` is set, and drives ICE-restart/full-reconnect recovery on connection failure. It exposes `getPeerConnections`, `subscribeMembers`, `destroyConnections`, `manualReconnect`.
3. `media.ts` handles `getUserMedia`/`getDisplayMedia`, device switching, screen share, codec preference (`createOfferWithPreferredCodec` — H264 on iOS, VP8 on Android, either on desktop).
4. `app.ts` is the top-level UI controller: wires DOM buttons (mute, hangup, PiP, device selectors, stats panel) to the above modules, manages the user-info modal, drives call-duration/bitrate stats polling via `RTCPeerConnection.getStats()`, and handles push-notification subscription against an external push server (`serverURL`, hardcoded per-hostname: `localhost:3000` in dev vs a Render-hosted URL in production).

Two peers are connected in a full mesh (a new `RTCPeerConnection` per remote peer, all sharing the local track set) — there's no SFU/MCU, so this only scales to a handful of participants per room.

### Other modules
- `chat.ts` / `users.ts` — text chat and per-user panel, both piggybacking on the same Scaledrone room messages (`type: 'chat'`, `type: 'dm'`).
- `theme.ts` — theme switching (Default/Dark/Light/Purple), persisted to `localStorage`, driven by CSS custom properties in `src/styles/style.css`.
- `recording.ts` — local screen/call recording.
- `toast.ts` — shared toast notification helper used across modules for user-facing status messages.
- `src/types/index.ts` — shared TypeScript interfaces for all cross-module data shapes (`UserInfo`, `Member`, `MessageData`, `PeerConnectionInfo`, etc.) plus the global `Window.ScaleDrone` declaration (Scaledrone is loaded via a `<script>` tag in `index.html`, not an npm package).

### State and persistence
No backend database. Per-device state lives in `localStorage`: `userInfo` (nickname/gender/status/age), `roomName`, selected media devices, theme, and push subscription. Room membership/signaling state is in-memory only (`room.ts` module-level `peerConnections`/`membersList`), rebuilt on reconnect from Scaledrone's `members`/`member_join`/`member_leave` events.

### PWA
`public/service-worker.js` + `manifest.json` provide offline support, install prompts, and push notifications. Push notifications go through a separate external server (`serverURL` in `app.ts`) that is not part of this repo.

## Conventions to note

- Modules import each other with explicit `.js` extensions (e.g. `import { createScaledrone } from './signalling.js'`) even though the source files are `.ts` — required by the `bundler` moduleResolution/`isolatedModules` TS config paired with Vite's ESM output.
- `tsconfig.json` has `strict: true`, `noUnusedLocals`, and `noUnusedParameters` enabled — `npm run build` will fail on unused variables/params.
- DOM elements are looked up at module load time with `document.querySelector(...) as HTMLElement` and guarded with optional chaining/`if` checks before use, since not every page (`index.html` vs `callui.html`/`signin.html`) has every element.
