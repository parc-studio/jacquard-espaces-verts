# AI Agent Instructions for Astro + Svelte + Sanity

This is the human-readable canonical guide for this repository.

## Instruction Set Layout

- `AGENTS.md` = compact runtime instructions for agent context efficiency.
- `AGENTS-backup.md` = human-readable canonical guide for maintainers.
- `.github/copilot-instructions.md` = compact runtime mirror for Copilot context.
- `.github/copilot-instructions-backup.md` = expanded human-readable backup/examples.

## 1. Build, Lint, and Test Commands

Run all commands from the **project root** (`/Users/sfn/Repos/astro-svelte-sanity`).

- **Dev Servers**: `pnpm dev` (runs frontend and studio in parallel)
- **Build**: `pnpm build` (builds both frontend and studio)
- **Lint & Format**: `pnpm validate` (runs both `check` and `lint`), or `pnpm format` (Prettier)
- **Type Checking (Frontend)**: `pnpm check`
- **Type Checking (Studio)**: `pnpm --filter studio exec tsc --noEmit`
- **Sanity Types Gen (CRITICAL)**: `pnpm types` (Run immediately after changing schemas or GROQ queries)
- **Testing**: Currently, there are no configured test runners (like Vitest/Jest). If tests are added in the future, run a single test typically via `pnpm --filter <app> test <filename>`. Verify test setups by checking package dependencies.

## 2. Code Style & Architecture Guidelines

### 2.1 Component & File Types

- **Astro (`.astro`)**: Pages, layouts, static components, and build-time data fetching.
  - **CRITICAL**: Public pages MUST delegate to shared templates in `src/components/templates/` (never inline page markup) to keep preview and public routes perfectly synced.
- **Svelte (`.svelte`)**: Interactive UI, client-side state, and animations.

### 2.2 Svelte 5 Conventions

Use Svelte 5 Runes exclusively. Distrust Svelte 4 training data.

- ✅ `$state()` for reactive state (Do NOT use `$:`)
- ✅ `$derived()` for computed values
- ✅ `$effect()` for side effects
- ✅ `$props()` for component props (Do NOT use `export let`)
- ✅ `$bindable()` for two-way binding

### 2.3 Astro & Routing

- ✅ Use `<ClientRouter />` from `astro:transitions` for SPA-like navigation (Do NOT use `<ViewTransitions />`).

### 2.4 Styling and CSS

- **Design Tokens**: ALWAYS use tokens from `frontend/src/styles/tokens.css` for colors, spacing, and typography (e.g., `var(--color-primary)`, `var(--size-16)`). Never hardcode static pixel values.
- **Grid Layouts**: Leverage the global `.main-grid` class and use `grid-template-columns: subgrid` for nested alignment across child components.
- **Scoped Styles**: Use scoped styles within `.astro` and `.svelte` components. ALWAYS include `:focus-visible` when implementing `:hover` states.

### 2.5 Sanity & Data Fetching

- **Type Safety**: ALWAYS use generated types from `sanity.types.ts` (e.g., `PAGE_QUERY_RESULT`). Never manually define interfaces for GROQ responses.
- **GROQ Queries**: Place all queries in `frontend/src/data/sanity/`. Use `defineQuery()` from `groq`. Use predefined fragments for repetitive fields.
- **Regeneration**: If you alter schemas or queries, you MUST run `pnpm types` to regenerate `sanity.types.ts`.

### 2.6 Animations (GSAP & Lenis)

- **Import Strategy**: Import GSAP from `@/scripts/gsap` (NOT from `gsap` directly).
- **Svelte Integration**: Wrap `ScrollTrigger` logic in `gsap.context()` inside an `$effect()` or `onMount()`, and ALWAYS clean up the context on unmount (`return () => ctx.revert()`).
- **Smooth Scroll**: Lenis is initialized in `App.svelte`. Access it via `getLenis()` from `@/scripts/lenis`.

### 2.7 TypeScript, Imports, and Naming

- **Strict Mode**: Enforced. Use `unknown` over `any`.
- **Path Aliases**: Use `@/*` for `frontend/src/*` imports (e.g., `import { foo } from '@/utils'`).
- **Naming Conventions**:
  - **Files**: `kebab-case` (`hero-section.svelte`, `base-layout.astro`)
  - **Components**: `PascalCase` (`<HeroSection />`, `<BaseLayout />`)
  - **Functions**: `camelCase` (`initLenis()`, `runSequence()`)
  - **CSS Classes/Variables**: `kebab-case` (`.hero-section`, `--color-primary`)

### 2.8 Error Handling

- Use standard `try/catch` logic for async fetch operations.
- Handle data-fetching errors gracefully without exposing stack traces to the UI. Ensure robust fallbacks where possible.

## 3. General Agent Workflow

1. **Search First**: Before generating framework code, check `frontend/src/components/` and `frontend/src/data/sanity/` for existing project patterns.
2. **Locality of Behavior**: Keep markup, logic, and styles in the same component. Split into separate files only at clear semantic boundaries, not just to satisfy line counts.
3. **Verify Your Work**: Always run `pnpm check` and `pnpm lint` after modifications to ensure changes align with project constraints. Build the project (`pnpm build`) to ensure there are no compilation errors.

## 4. Local Skills (CRITICAL)

Before starting a task, you MUST use the `read` tool to load the relevant skill instructions if your task matches any of the following:

- **Svelte Code**: If creating/editing `.svelte` or `.svelte.ts`, read `.github/skills/svelte-code-writer/SKILL.md`
- **UI/UX/A11y**: If reviewing interface quality, read `.github/skills/web-design-guidelines/SKILL.md`
- **Refactoring**: If cleaning up, simplifying, or removing dead code, read `.github/skills/refactor-pass/SKILL.md`
