# Sapien Robotics assignment checklist

Statuses: **Verified** = observed in executed tests or inspected export; **Implemented but unverified** = code exists without a direct behavioral check; **Incomplete** = missing or narrower than requested.

## Question 1 — multiplayer drawing game

| Requirement | Status | Evidence or gap |
|---|---|---|
| One documented startup command | Verified | `npm run dev`; clean-install recheck recorded in README. |
| Create/join shareable rooms | Verified | Three-context browser test. |
| Host sets rounds, draw time, word list | Implemented but unverified | Form and server validation present; custom list not exercised in browser suite. |
| Pen | Verified | Browser test draws and asserts pixels on a peer canvas. |
| Colors, brush size, eraser | Implemented but unverified | Toolbar and canvas operations exist; individual brush effects were not pixel-tested. |
| Fill and clear | Verified | Late-join browser test asserts peer canvas pixels after both operations. Fill is full-canvas, not region flood fill. |
| Undo | Implemented but unverified | Server operation and canvas reducer exist; no dedicated browser assertion. |
| Live strokes with no visible lag | Verified | Peer canvas pixel assertion; local load latency measured. Internet latency remains unverified. |
| Drawer chooses from three private words | Verified | Browser and socket tests. |
| Server timer and letter hints | Verified | Timer expiry browser test; hint reveal is implemented but not directly asserted. |
| Server checks guesses and awards points | Verified | Browser and socket tests. |
| Correct guess hidden from public chat | Verified | Browser test checks peer chat before the turn ends; the word is revealed only in turn-end announcement. |
| Near-miss private feedback | Verified | Fifth browser test checks private notice and absence from peer chat. |
| Late joiner sees current canvas | Verified | Fifth browser test checks canvas pixels after mid-turn join. |
| Refresh/drop within 30 seconds retains score | Verified | Mid-game refresh browser test; true offline reconnection not exercised. |
| Drawer disconnect recovers | Verified | Browser test. |
| Rate limits and size limits for chat/strokes | Implemented but unverified | Server rules present; boundary tests needed. |
| Stroke-by-stroke end-game replay | Verified | Browser replay control and screenshot. Playback is manual scrubbing. |
| Three-player two-minute recording | Verified | `artifacts/demo/sketchrush-three-player-demo.mp4`, exactly 2:00; sampled frames visually inspected. |
| Sync, ordering, restart, capacity note | Verified | README and verification note; local measured load at 20 and 100 rooms. |

## Question 2 — music architecture

| Requirement | Status | Evidence |
|---|---|---|
| Audio delivery, adaptive bitrate, CDN, fast start | Verified | Four-page architecture PDF, page 1. |
| Catalogue, search, new releases | Verified | PDF page 2 and markdown. |
| Room sync near 200 ms, late join and failover | Verified | PDF pages 2–3. |
| Data placement, history, playlists, royalties, analytics | Verified | PDF page 2. |
| Regional outage, deploys, degradation | Verified | PDF page 3. |
| User-visible sync observability | Verified | PDF page 4. |
| High-level and 5,000-listener pause diagrams | Verified | PDF pages 1–2, visually inspected. |
| Five or more failure scenarios | Verified | Eight scenarios on page 3. |
| Tradeoffs and three-engineer plan | Verified | PDF page 4. |
| 3–6 page design document | Verified | PDF has four pages. |

## Submission packaging

| Requirement | Status | Gap |
|---|---|---|
| GitHub repository link | Verified | Public repository: https://github.com/Surajaraikar/sketchrush-sapien-assignment |
| Email to Sapien Robotics | Incomplete | No submission email was sent. |
