# JURY — intro

30-second cinematic intro for the Boosty rubric with site reviews from the Awwwards jury panel.
2560×1600, 30 fps, black background, huge type, glossy 3D. Everything is procedural: three.js scenes,
Canvas 2D typography, and a synthesized soundtrack locked to the same timeline.

## Storyboard

| Time | Shot | Idea |
| --- | --- | --- |
| 0.0–3.0 | Open | Macro of an unknown glossy edge catching a hairline light (it is the juror's cursor) |
| 3.0–6.5 | THOUSANDS OF SITES. | Flight through hundreds of floating website screens |
| 6.5–9.3 | ONE JURY. | A wall of sites; the cursor clicks one and everything else goes dark |
| 9.3–12.1 | DESIGN 40% | The chosen site with luminous construction grid and golden-ratio arc |
| 12.1–14.9 | USABILITY 30% | A monumental cursor double-clicks a mirror floor, light rings ripple |
| 14.9–17.7 | CREATIVITY 20% | A perfect sphere of black liquid metal that refuses to stay a sphere |
| 17.7–20.5 | CONTENT 10% | A landscape of extruded text lines rising out of the dark |
| 20.5–24.7 | ONE SCORE. | Mechanical drums of 3D numerals lock onto the weighted score (8.46) |
| 24.7–30.0 | JURY | Monumental extruded title, light sweep, subtitle, fade to black |

Cuts sit on a 0.7 s beat grid (≈86 BPM) shared with the soundtrack.

## Editing

All copy, timings, criteria scores and colours are in `src/config.js`
(title, subtitle, episode, HUD lines, per-shot words). The final score is computed from the criteria
with the real Awwwards weights. Fragment Mono has no Cyrillic, so Russian captions fall back to IBM Plex Mono;
Inter Tight (big type and 3D type) supports Cyrillic.

## Commands

```bash
npm install
npm run dev        # live preview with scrubber at http://localhost:5173 (Space = play, ←/→ = frame)
npm run preview    # fast half-res frames → out/preview
npm run render     # final frames with motion blur → out/frames (resumable)
npm run sound      # soundtrack → out/sound.wav
npm run encode     # out/frames + out/sound.wav → out/jury-intro-2560x1600.mp4
```

Rendering uses headless Chrome (`CHROME` env var overrides the path). Split a render across processes with
`--worker 0/2` and `--worker 1/2`. `PRORES=1 npm run encode` also writes a ProRes 422 HQ master for editing.
