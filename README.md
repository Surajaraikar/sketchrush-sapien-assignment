# SketchRush

A real-time drawing and guessing game for the Sapien Robotics assignment. Next.js serves the UI; a custom Node server hosts Socket.IO and owns rooms, turns, words, timers, scores, and drawing operations.

## Run

Requires Node 20.9+.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. For a production run: `npm run build && npm start`. Set `PORT` to change the port. There are no required environment variables. Open three private browser windows to test separate players. Create a room, copy the invite URL, join from the other windows, then start the game.

## Checks

```bash
npm run typecheck
npm run lint
node test/smoke.cjs
npx playwright test --workers=1
npm run build
```

The Playwright suite expects the app to be running at `http://localhost:3000`. A clean `npm ci` followed by the documented `npm run dev` returned HTTP 200 and passed the three-player socket smoke test on 11 October 2026. The final production build, type check, lint and browser rerun are recorded in [docs/verification.md](docs/verification.md).

## Architecture and state ownership

- `server.cjs`: authoritative in-memory room model, event handlers, timers, guesses, scoring, chat and stroke limits, host migration, session recovery, replay history.
- `src/components/Game.tsx`: landing, forms, lobby, game layout, socket session, and UI state. This is the largest component and should be split for a longer-lived project.
- `src/lib/canvas.ts`: normalized pointer coordinates and deterministic operation rendering.
- `src/lib/types.ts`: client types for server payloads.
- `src/app/globals.css`: visual tokens, responsive layout, and focus styling.

Server state is sent as versioned snapshots. The client rejects an older snapshot. Canvas operations use server-assigned sequence numbers; on a sequence gap, the client requests a full room snapshot. The drawer draws locally while sending small stroke segments about every 45 ms. Other players render sequenced segments. Undo removes the last stroke segment; clear and fill reset the operation stack. This makes all operations deterministic, though a single gesture can take multiple undos. Canvas coordinates are normalized to `[0,1]`, with high DPI scaling on the receiving canvas.

The Socket.IO connection belongs to the mounted game page. On reconnect, it rejoins with a random server-issued token stored in `sessionStorage`, then replaces local state with the authoritative snapshot. The server keeps disconnected players for 30 seconds. A refresh within that window retains score. The drawer disconnecting ends the turn. If the server restarts, all in-memory rooms and sessions expire; the user must create a new room. Tokens are not included in public room snapshots.

## Known limitations

- This is a single-process, in-memory demo. It has no persistence, horizontal scaling, or durable session recovery across server restarts.
- Fill colors the full canvas; it is not a bounded flood fill.
- Undo operates on transmitted stroke segments. Replay is scrubbed stroke by stroke rather than auto-playing.
- Rendering and client socket code need decomposition and broader automated coverage before production use. Incoming server payloads are typed but are not runtime validated on the client.
- Rate limits are per connected player and simple; production abuse protection needs IP/account quotas and monitoring.
- A two-minute silent three-context recording is available at [artifacts/demo/sketchrush-three-player-demo.mp4](artifacts/demo/sketchrush-three-player-demo.mp4), with a [walkthrough and checklist](docs/recording-walkthrough.md). Narration is not included.
- Local 15.8-second load tests handled 20 rooms / 60 players and 100 rooms / 300 players with zero stroke errors. This demonstrates at least 100 rooms for that short workload, not a maximum capacity or internet latency guarantee. See [measured results and limits](docs/verification.md). The 6,000-operation cap limits per-turn operations, but replay history can still grow.
- The latest `npm audit --omit=dev` found zero production dependency advisories. `npm audit` reported five high-severity advisories in the ESLint development dependency tree; these are unresolved and should be reviewed before a longer-lived release.

## Frontend audit

The repository was empty at the start, so there was no frontend, backend contract, or tests to audit. The highest-risk requirement was server authority over secrets, scores, and turn time. The implementation keeps these exclusively on the server and sends secret choices only to the drawer socket. Room snapshots contain masked words during turns. The largest remaining architecture risk is the combined `Game.tsx` controller and view. The largest reliability risk is volatile single-process state. The largest accessibility gap is that freehand drawing needs a pointer; all surrounding controls have labels and focus styles.

The separate music system design is in [docs/music-architecture.md](docs/music-architecture.md) and its inspected, four-page [PDF export](docs/music-architecture.pdf). A [requirement checklist](docs/requirements-checklist.md) distinguishes verified work from remaining gaps. This workspace is a local Git repository without a GitHub remote; no submission email has been sent.
