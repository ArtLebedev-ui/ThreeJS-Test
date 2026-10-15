# JURY — intro

30-second cinematic intro for the Boosty rubric with site reviews from the Awwwards jury panel.
2560×1600, 30 fps, black background. Everything is procedural: three.js scenes, Canvas 2D typography
in Neue Montreal, and a synthesized soundtrack locked to the same timeline.

## Idea

One protagonist for the whole film: a black 16:10 glass slab — a website. Every shot looks at the same
object from a new angle, and every cut carries meaning from the previous shot into the next one.

| Time | Shot | Idea |
| --- | --- | --- |
| 0.0–2.8 | Prologue | A point stretches into a line — the edge of the slab seen side-on. The camera orbits to its face. "Every year," |
| 2.8–5.6 | Thousands | A field of sites visible only through the letters; we dive through the T into the field. |
| 5.6–7.0 | Noise | The sites lose resolution and switch off in a wave. "Most of it is noise." One survives. |
| 7.0–9.8 | One jury. | The last slab rises out of the field and turns to face us. |
| 9.8–12.6 | (01) Design 40% | The golden grid hidden inside the site's layout is drawn over it, with the spiral. |
| 12.6–15.4 | (02) Usability 30% | The slab lies flat like a desk; a cursor finds the nav and the CTA. |
| 15.4–18.2 | (03) Creativity 20% | The slab refuses to stay a slab and turns into liquid metal. |
| 18.2–21.0 | (04) Content 10% | The slab returns typeset; one sentence lights up as it is read: "Feeling over noise." |
| 21.0–24.85 | Verdict | The site is cut into slices as wide as the weights, they rise by contribution, fuse, sink — 8.46. |
| 24.85–30.0 | Jury. | We fly into the screen until its glass is the frame; the title is set inside. The red period closes the film. |

Cuts sit on a 0.7 s beat grid (≈86 BPM) shared with the soundtrack.

## Fonts

Neue Montreal is a commercial typeface and is not committed to this public repository. Put the eight
`NeueMontreal-{Light,Regular,Medium,Bold,Italic,LightItalic,MediumItalic,BoldItalic}.otf` files into
`public/fonts/` before running anything. The font has no Cyrillic, so the copy is in English.

## Editing

All copy, timings, criteria scores and colours are in `src/config.js`. The final score is computed from the
criteria with the real Awwwards weights.

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
