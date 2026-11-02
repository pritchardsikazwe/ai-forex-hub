# AI Forex Hub

AI Forex Hub is an independent forex education and Exness account workspace built with React, TypeScript and Vite.

## GitHub Pages preview

The Exness integration development branch deploys the frontend to GitHub Pages using GitHub Actions.

- Branch: `feature/exness-trading-integration`
- Build: `bun run build`
- Output: `dist`
- Pages workflow: `.github/workflows/pages.yml`
- Expected project URL after Pages is enabled: `https://pritchardsikazwe.github.io/ai-forex-hub/`

In GitHub, open **Settings → Pages**, select **GitHub Actions** as the build and deployment source. The workflow then builds and deploys on pushes to the integration branch.

## Local development

```bash
bun install
bun run dev
```

## Production build

```bash
bun run build
bun run preview
```

## Current Exness integration status

The frontend includes an Exness broker terminal workspace with manual, semi-automatic and fully automatic preference modes, demo/live environment selection, and risk preference controls. These controls are currently a frontend preview only.

The repository also includes a Cloudflare Worker backend foundation for encrypted per-user credential storage and account connection metadata. The Worker is not deployed by GitHub Pages and is not yet connected to the frontend.

**No live Exness account connection, market feed, order execution or automated trading is active at this stage.** The backend must be deployed to a secure server environment before API keys can be accepted. GitHub Pages is static hosting and must never receive Exness private signing keys.

## Security requirements

- Never collect Exness trading passwords.
- Never store private signing keys in browser storage, source code, GitHub Pages assets or Vite `VITE_*` variables.
- Use the secure backend to encrypt per-user API signing credentials.
- Complete the official Exness signing, gateway discovery, response verification and demo certification before enabling order placement.
- Require explicit user authorization for live trading and automated execution.
