# SketchRush two-minute recording walkthrough

Use three separate browser profiles or Playwright contexts, labelled Host, Second, and Third. Arrange all three windows so room membership and drawing delivery are visible. Record at 1080p or higher with the browser address bar visible during invite-link joining. Set **1 round** and **30 seconds** per turn. Choose short words when offered. The host draws first; each of the three players gets one turn. Start recording before room creation.

| Time | Action | Evidence to show |
|---|---|---|
| 00:00–00:12 | Host creates a room; copy invitation URL. | Settings, code and shareable link. |
| 00:12–00:25 | Second and Third open the link and join. | Three distinct browser sessions and live player list. |
| 00:25–00:34 | Host starts. | Host-only start control and private word choices. |
| 00:34–00:51 | Host chooses a word and draws a clear shape. | Live strokes appear on both guessing screens. |
| 00:51–01:03 | Second guesses; Third guesses. | Correct feedback, authoritative score changes and turn transition. |
| 01:03–01:20 | Second chooses a word, draws; Host and Third guess. | Drawer rotation and continued synchronization. |
| 01:20–01:37 | Third chooses a word, draws; Host and Second guess. | Third player turn and final score updates. |
| 01:37–01:50 | Show final leaderboard; select first drawing replay and scrub. | Winner, scores and stroke replay. |
| 01:50–02:00 | Show all three windows and room code; end recording. | Complete multiplayer session. |

## Before recording

- [ ] Start from a clean server using `npm run dev` or `npm start` after `npm run build`.
- [ ] Confirm the three browsers have separate session storage and distinct nicknames.
- [ ] Set screen capture to include all windows and system audio only if desired.
- [ ] Keep private session tokens and devtools out of the recording.
- [ ] Practice the word choices; use the first available option in the recording.
- [ ] Check cursor visibility, readable zoom, and no notification overlays.

## After recording

- [ ] Confirm exactly one continuous video covers creation through replay and is roughly two minutes.
- [ ] Confirm synchronized strokes and all three score changes can be seen at normal playback speed.
- [ ] Play the exported video through and verify audio/video quality.
- [ ] Add the final video link to the submission README or repository before emailing.

An automated three-context recording was captured and composed as `artifacts/demo/sketchrush-three-player-demo.mp4`. It is exactly 2:00. Its frames were inspected at 15, 36, 45, 65, 90, 105, and 118 seconds. The first context is large on the left; the two guest contexts are stacked on the right. The recording is silent. The script remains useful for a narrated retake if preferred.
