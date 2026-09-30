# Armaan K.

I like to build cool stuff. This is the site: open a 3D loot chest, pull a project card, and collect all eight in the binder.

Built with Vite, Three.js and GSAP.

## Run it

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The build lands in `dist/` with relative paths, so it works at a domain root or under a subpath.

## Deploy

- **GitHub Pages:** every push to `main` builds and publishes through `.github/workflows/pages.yml`.
- **Cloudflare:** `npm run deploy` builds and uploads `dist/` to the `armaan-k` Worker.

## Editing the cards

The eight cards are templates for now. Edit `TEMPLATE_PROJECTS` in `src/projects.js`, or set `USE_TEMPLATES = false` to show the real projects listed above it. Each card has a rarity: `common`, `uncommon`, `rare`, `epic` or `legendary`.

Add `?slowmo=0.2` to the URL to play every animation at a fifth of the speed.
