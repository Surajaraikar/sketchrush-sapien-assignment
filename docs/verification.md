# SketchRush submission verification

Date: 11 October 2026 (Asia/Calcutta). The assignment source is `Full stack assignment_14 Oct..pdf` supplied by the user. This note reports observed behavior, not production certification.

## Browser test environment and results

Windows x64, Node v24.17.0, Next.js 16.4.0, Playwright Chromium 156.0.8078.4. The browser suite ran against `npm start` after a production build, with three independent Chromium contexts per scenario (four for late joining). Desktop was 1365 × 850; mobile was 390 × 844 with touch and 2× device pixels. All five tests passed after the race fixes. The mobile test also passed with a real CDP touch gesture and peer-canvas pixel assertion. Screenshots are in `artifacts/desktop-game.png`, `artifacts/final-replay.png`, `artifacts/mobile-lobby.png`, and `artifacts/mobile-game.png`. Playwright is configured to retain screenshots and traces on failure under `artifacts/test-results`.

| Scenario | Evidence | Status |
|---|---|---|
| Create room, join through URL, three distinct players | Browser test 1 | Verified |
| Host-only start control | Browser test 1 plus server rejection in socket smoke | Verified |
| Private word choices and masked public word | Browser test 1 and socket smoke | Verified |
| Live strokes on a second canvas | Browser pixel assertion in test 1 | Verified |
| Guesses, correct feedback, server scores | Browser test 1 and socket smoke | Verified |
| Timer expiry and automatic transition | Browser test 2, waited through 30-second deadline | Verified |
| Drawer disconnection recovery | Browser test 2 | Verified |
| Final leaderboard and replay scrub | Browser test 1 | Verified |
| Mid-game refresh, same score, no duplicate player | Browser test 4 | Verified |
| Mobile touch drawing delivery and no horizontal overflow | Browser test 3 with CDP touch gesture | Verified |
| Late join canvas snapshot, private near miss, fill and clear on peers | Browser test 5 | Verified |

## Load test

Run `node test/load.cjs` after `npm run build` for the default 20-room run. Set `LOAD_ROOMS=100` and `LOAD_SECONDS=15` for the larger step; the script starts its own production server on port 3100. Each room has three players; the drawer sends a two-point stroke roughly every 20 ms. One receiver per room records event delivery latency using a local monotonic clock. CPU and working set come from Windows `Get-Process`. Raw results are in `artifacts/load-20-rooms.json` and `artifacts/load-100-rooms.json`.

| Rooms / players | Duration | Acknowledged strokes | Throughput | Received by sampled peers | Errors | p50 / p95 / p99 broadcast latency | Server RSS start → end | Server CPU time / one-core share |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 20 / 60 | 15.8 s | 9,241 | 586/s | 9,241 | 0 | 1.15 / 2.10 / 2.67 ms | 90 → 85 MB | 0.95 s / 6% |
| 100 / 300 | 15.8 s | 45,225 | 2,869/s | 45,225 | 0 | 3.16 / 5.79 / 6.88 ms | 102 → 152 MB | 2.83 s / 18% |

This shows one instance handled **at least 100 three-player rooms** for 15 seconds under this local stroke workload. It does not establish a maximum capacity. All clients ran on the same machine and network stack, chat and room churn were minimal, and there was no long-duration memory test. Latency excludes internet RTT, browser rendering and visual frame time. CPU share is process CPU seconds divided by elapsed time, expressed as a percentage of one logical core; the host reported 14 logical CPUs. The 6,000-operation per-turn cap and retained replay history need longer tests before capacity sizing.

The load runs preceded the later host-migration and client acknowledgment-race fixes. Those fixes did not change the stroke broadcast path; the load measurements are still evidence for that path, but were not repeated on the final commit.

## Architecture document

`docs/music-architecture.md` covers the assignment's high-level design. `docs/music-architecture.pdf` is a four-page export with rendered architecture and 5,000-listener pause diagrams. All four pages were rendered to PNG and visually inspected for clipping and readability.

## Remaining submission risks

- Room and session state is in memory; server restart destroys active rooms. This is documented behavior, not failover.
- Replay is manual scrubbing and fill colors the whole canvas; these are narrower than users may expect from replay and paint-bucket tools.
- The client is strongly typed but does not runtime-validate incoming Socket.IO messages. The server validates key inputs and permissions but uses minimal abuse protection.
- The large client controller needs separation before long-term maintenance. The browser suite covers major paths but does not simulate network packet reordering or multi-node operation.
- Load results are local, short duration, and limited to three-player rooms. No defensible production room limit or deployment SLO is claimed.
- `artifacts/demo/sketchrush-three-player-demo.mp4` is an exactly two-minute silent recording composed from three independent browser contexts. Sampled frames were visually checked; narration and human presentation polish can be added if desired.

## Final engineering review

| Area | Implemented and verified | Remaining risk / next improvement |
|---|---|---|
| Architecture | Server owns game authority; client has separate canvas renderer. Tested full three-player flow. | `Game.tsx` combines session control and UI. Split by feature before sustained development. |
| Type safety | Strict `tsc` checks app and browser tests. | Validate incoming Socket.IO payloads at runtime and share schemas with server. |
| Real-time correctness | Sequenced operations, versioned snapshots, late join, refresh, and drawer disconnect passed browser tests. | Test packet reordering, extended network loss, and concurrent multi-node behavior. |
| Security | Word choices are drawer-only; scores and permissions are server-owned; key limits exist. Browser tests check public word masking and private near miss. | Add stronger abuse controls and fuzz payload validation; do not deploy the in-memory demo publicly without operational controls. |
| Error handling | Forms show server errors; reconnect has visible state. | Add network-fault and server-restart browser tests. |
| Performance | Local load at 100 rooms/300 players delivered 45,225 strokes with no errors in 15.8 s. | Measure browser frame times, WAN latency, and long-duration heap growth. |
| Accessibility | Labels, focus rings, live notices, and mobile touch work in browser tests. | Audit WCAG 2.2 AA with assistive technology; freehand drawing has no keyboard equivalent. |
| Testing | Five real browser scenarios, socket smoke, strict types, lint, production build. | Add unit coverage for reducer edge cases and permission/rate boundaries. |
| UI/UX | Desktop and mobile screenshots inspected; no horizontal overflow at 390 px. | Test additional phone sizes and browser engines. |
| Operations | Clean `npm ci` plus one-command startup was exercised; README documents restart behavior. | Add persistent room state, multi-instance support, deployment configuration, and monitoring before production. |

The game is suitable as a tested assignment demo. It is not production ready. The public GitHub repository was published and verified; the submission email remains a separate final action.
