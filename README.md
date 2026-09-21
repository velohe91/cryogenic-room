# 🧊 Cryogenic Room

A local-only, PNG-only NFT specimen generator built with Next.js, React and TypeScript.

## Lab workflow

1. **01 — BUILD THE DNA** — Assemble the visual layers of the specimen.
2. **02 — GENERATE** — Initiate cryogenic synthesis.
3. **03 — PREVIEW** — Inspect recovered Cyborg units.

## Features

- Create and delete compositing layers.
- Upload multiple PNG traits to each layer.
- Delete individual PNG assets without deleting the layer.
- Calculate possible combinations.
- Generate unique layered PNG specimens.
- Inspect canvas dimensions and every PNG filename used.
- Delete specimens and automatically renumber them.
- Download each final PNG.

## Run locally

```bash
npm install
npm run dev
```

Open the local Next.js URL shown in the terminal.

### PNG rules

For predictable compositions, use assets with the same canvas dimensions and matching alignment. Transparent PNGs are recommended for traits; an opaque PNG can be used as the background layer.

## Visual direction

The interface is designed as a cyberpunk pixel-arcade cryogenic laboratory using the project palette:

- `#DB3FFD`
- `#7A09FA`
- `#94FDFF`
- `#F389F5`
- `#0098DC`

CRT scanlines, terminals, status indicators, cables, cryogenic capsules and synthesis-console motifs are part of the visual language.
