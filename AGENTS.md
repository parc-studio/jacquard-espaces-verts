# AGENTS Instructions

## Core mode

- Prefer retrieval-led reasoning for Svelte 5 / Astro 5 / Sanity.
- Check existing repo patterns before generating framework code (`frontend/src/components/`, `frontend/src/data/sanity/`).
- Load matching local skill first:
  - Svelte edits → `.github/skills/svelte-code-writer/SKILL.md`
  - UI/UX/a11y review → `.github/skills/web-design-guidelines/SKILL.md`
  - Refactor/cleanup → `.github/skills/refactor-pass/SKILL.md`

## Architecture + framework rules

- `.astro`: pages/layouts/static/build-time fetching.
- `.svelte`: interactive UI/state/animations.
- Public pages in `frontend/src/pages/` must delegate to templates in `frontend/src/components/templates/`.
- Svelte 5 runes only (`$state/$derived/$effect/$props/$bindable`); no `export let`, `$:`, `createEventDispatcher`.
- Astro transitions: use `<ClientRouter />` from `astro:transitions`; never `<ViewTransitions />`.
- Keep behavior local unless clear semantic boundaries justify splitting.

## Styling + data + animation constraints

- Use design tokens from `frontend/src/styles/tokens.css`; no hardcoded product UI colors/spacing/type sizes.
- Avoid duplicate/useless declarations in CSS. Keep the CSS lean and structured.
- Desktop-first responsive: write base styles for desktop, then use `@media (max-width: 768px)` for mobile. One breakpoint only (768px) unless explicitly told otherwise.
- Never use `display: inline-flex`; prefer `flex` or `grid`.
- Prefer `.main-grid` + `subgrid` layout pattern over flex; include `:focus-visible` with hover interactions.
- Keep GROQ in `frontend/src/data/sanity/`, use `defineQuery()` + fragments; no inline GROQ in pages/components.
- Use generated types from `frontend/sanity.types.ts`; do not handwrite duplicate GROQ response interfaces.
- After schema/query/fragment edits run `pnpm types`; never manually edit generated files (`studio/schema.json`, `frontend/sanity.types.ts`).
- Lenis is accessed via `getLenis()` from `@/scripts/lenis` (initialized in `App.svelte`).

## TS + imports + safety

- Strict TS; prefer `unknown` over `any`.
- Use `@/*` alias for `frontend/src/*` imports.
- Naming: files/classes/vars = kebab/Pascal/camel; CSS class/var names = kebab-case.
- Use `try/catch` for async data ops, graceful fallbacks, and never expose stack traces/internal errors.

## Commands (repo root)

- Dev: `pnpm dev` (`dev:frontend`, `dev:studio` as needed)
- Build: `pnpm build` (`build:frontend`, `build:studio`)
- Frontend check: `pnpm check`
- Studio check: `pnpm --filter studio exec tsc --noEmit`
- Sanity types: `pnpm types`
- Lint/validate/format: `pnpm lint`, `pnpm validate`, `pnpm format`

Validation matrix:

- `frontend/` changes → `pnpm check`
- `studio/` changes → `pnpm --filter studio exec tsc --noEmit`
- both → run both
- schema/query changes → also `pnpm types`
