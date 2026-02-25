# Copilot Instructions (Compressed Runtime)

Token-optimized runtime version of the full Astro + Svelte + Sanity guide.
Human-readable full references: `AGENTS-backup.md` (canonical) and `.github/copilot-instructions-backup.md` (expanded backup/examples).

## 0) Core Operating Mode

- Prefer retrieval-led reasoning over pretraining assumptions for Svelte 5, Astro 5, Sanity.
- Before writing framework code: inspect existing patterns in `frontend/src/components/` + `frontend/src/data/sanity/`; use MCP tools when relevant.
- If a local skill applies, load it first:
  - Svelte edits (`.svelte/.svelte.ts/.svelte.js`) → `.github/skills/svelte-code-writer/SKILL.md`
  - UI/UX/a11y review → `.github/skills/web-design-guidelines/SKILL.md`
  - Refactor/cleanup/simplification → `.github/skills/refactor-pass/SKILL.md`

## 1) Architecture + File Role Rules

- `.astro`: pages/layouts/static/build-time fetch.
- `.svelte`: interactive UI/client state/animation.
- Public pages in `frontend/src/pages/` must render shared templates in `frontend/src/components/templates/` (no duplicated inline page markup) to keep public and preview parity.
- Prefer locality of behavior: keep markup + logic + styles together unless a semantic boundary justifies splitting.

## 2) Svelte 5 + Astro Constraints (Hard)

- Use Svelte 5 runes only: `$state`, `$derived`, `$effect`, `$props`, `$bindable`.
- Do not use Svelte 4 patterns: `export let`, `$:`, `createEventDispatcher`.
- Prefer callback props and modern event usage.
- Astro SPA-like transitions must use `<ClientRouter />` from `astro:transitions`; do not use `<ViewTransitions />`.

## 3) Styling + Design System

- Use only tokens from `frontend/src/styles/tokens.css`; no hardcoded colors/spacing/type sizes in product UI.
- Token families: `--color-*`, `--size-*`, `--text-*`, `--font-*`, `--z-*`, `--transition-*`.
- Canonical spacing tokens: `4,8,12,16,24,32,48,64,96,128`.
- Canonical text tokens: `12,14,16,18,20,24,30,36,48,60,72`.
- Use scoped styles in components; include `:focus-visible` whenever hover behavior is added.
- Prefer global main grid + subgrid alignment (`.main-grid`, `grid-template-columns: subgrid`) unless a custom layout is explicitly needed.

## 4) Sanity + GROQ + Types

- Put GROQ queries in `frontend/src/data/sanity/`.
- Use `defineQuery()` and reuse fragments for repeated fields.
- Never inline ad-hoc GROQ in pages/components.
- Use generated types from `frontend/sanity.types.ts`; do not handwrite duplicate interfaces for GROQ results.
- After schema/query/fragment changes, run `pnpm types` immediately.
- Do not manually edit generated files (`studio/schema.json`, `frontend/sanity.types.ts`).

## 5) Animations + Transitions + Scroll

- Import GSAP utilities only from `@/scripts/gsap` (not direct `gsap` package imports in app code).
- ScrollTrigger in Svelte must be scoped via `gsap.context()` and cleaned up on unmount.
- Lenis is initialized in `App.svelte`; access through `getLenis()` from `@/scripts/lenis`.
- Page transition choreography lives in `frontend/src/scripts/transitions/`; explicit transition routing uses Astro transitions APIs.

## 6) TypeScript + Imports + Naming

- Strict TS expected; prefer `unknown` over `any`.
- Use alias imports `@/*` for `frontend/src/*`.
- Naming:
  - Files/classes/vars: kebab/Pascal/camel as established (`kebab-case` files, `PascalCase` components, `camelCase` functions).
  - CSS classes/variables: `kebab-case`.

## 7) Error Handling + Data Safety

- Use robust `try/catch` for async data ops.
- Provide graceful fallback UI behavior.
- Do not expose stack traces/internal errors to users.

## 8) Command Matrix (run at repo root)

- Dev: `pnpm dev` (`dev:frontend`, `dev:studio` when needed)
- Build: `pnpm build` (`build:frontend`, `build:studio`)
- Frontend type-check: `pnpm check`
- Studio type-check: `pnpm --filter studio exec tsc --noEmit`
- Types regeneration (Sanity): `pnpm types`
- Lint/validate/format: `pnpm lint`, `pnpm validate`, `pnpm format`
- Preview/deploy utilities: `pnpm preview:frontend`, `pnpm deploy:frontend`, `pnpm deploy:studio`, `pnpm tunnel`, `pnpm scaffold:route`

Validation requirement by change scope:

- `frontend/` changes → run `pnpm check`
- `studio/` changes → run `pnpm --filter studio exec tsc --noEmit`
- both → run both
- schema/query changes → also run `pnpm types`

## 9) Practical Do/Don’t Summary

Do:

- Reuse project patterns before introducing new ones.
- Keep templates and preview/public route structure aligned.
- Use design tokens, generated Sanity types, query fragments.
- Use GSAP abstraction + Lenis integration patterns already in repo.

Don’t:

- Hardcode product UI design values.
- Reintroduce Svelte 4/Astro 4 patterns.
- Import GSAP directly in feature code.
- Write inline GROQ in page components.
- Define manual types that mirror generated Sanity query types.

## 10) Environment + Ops Notes (Condensed)

- Frontend env commonly needs: `PUBLIC_SANITY_PROJECT_ID`, `PUBLIC_SANITY_DATASET`, `SITE_URL`.
- Studio env commonly needs: `SANITY_STUDIO_PROJECT_ID`, `SANITY_STUDIO_DATASET`.
- Current project behavior prefers fresh Sanity content patterns used by this repo configuration.

## 11) Source-of-Truth Mapping

- Canonical human guide: `AGENTS-backup.md`
- Expanded backup/examples: `.github/copilot-instructions-backup.md`
- This file: compact runtime mirror of the same policy set for context efficiency.
