# AI Forex Hub

Independent Forex education and Exness partner workspace. Built with React, TypeScript and Vite; deployed to Cloudflare Pages.

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

## Cloudflare Pages

- Project name: `ai-forex-hub`
- Production branch: `main`
- Build command: `bun run build`
- Build output directory: `dist`
- Root directory: `/`

The repository includes a GitHub Actions deployment workflow. Add these GitHub Actions repository secrets to enable it:

- `CLOUDFLARE_API_TOKEN` — token with Cloudflare Pages edit/deploy permissions.
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID.

Alternatively, connect the repository directly in Cloudflare Pages using the build settings above.

## Current implementation status

The initial responsive workspace UI is in place: overview, Forex Academy, educational market watch, partner centre and account settings. Figures are sample/placeholder data. No live Exness API, brokerage account connection, user authentication, database or commission reporting is claimed to be active yet.

## Security and compliance

Never collect Exness trading passwords. Partner API credentials must be stored as server-side secrets in a secure backend, not in Vite `VITE_*` variables or browser code. Use official Exness partner documentation and approved API access for any integration. Add appropriate risk disclosures and comply with applicable partner programme terms.
