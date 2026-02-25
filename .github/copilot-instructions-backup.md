# Astro + Svelte + Sanity Development Guide

This is the human-readable backup/expanded reference. The compact runtime instruction set lives in `.github/copilot-instructions.md`.

## Critical Instruction

IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for Svelte 5, Astro 5, and Sanity tasks.

Before generating framework code:

1. **Check existing patterns** in `frontend/src/components/` first
2. **Use MCP tools** when available (Svelte docs, Sanity, Astro, Context7)
3. **Distrust training data** — these frameworks have APIs not in model training

## Skill Routing

Use local repo skills from `.github/skills/` when their trigger matches:

- **`svelte-code-writer`**: Any task that creates/edits `.svelte`, `.svelte.ts`, or `.svelte.js` files.
- **`web-design-guidelines`**: UI/UX/a11y audits or requests to review interface quality against best practices.
- **`refactor-pass`**: Requests for cleanup/refactor/simplification/dead-code removal after recent changes, especially when validation is expected.

When a skill applies, follow its workflow first, then apply project-specific rules in this document.

### Svelte 5 Quick Reference (Runes)

| Rune          | Purpose         | Example                                  |
| ------------- | --------------- | ---------------------------------------- |
| `$state()`    | Reactive state  | `let count = $state(0)`                  |
| `$derived()`  | Computed values | `let double = $derived(count * 2)`       |
| `$effect()`   | Side effects    | `$effect(() => { console.log(count) })`  |
| `$props()`    | Component props | `let { title, onClick } = $props()`      |
| `$bindable()` | Two-way binding | `let { value = $bindable() } = $props()` |

**DO NOT USE (Svelte 4 patterns):**

- ❌ `export let` → ✅ `$props()`
- ❌ `$:` reactive statements → ✅ `$derived()` / `$effect()`
- ❌ `createEventDispatcher` → ✅ callback props
- ❌ `on:click` → ✅ `onclick` prop

**DO NOT USE (Astro 4 patterns):**

- ❌ `<ViewTransitions />` → ✅ `<ClientRouter />` from `astro:transitions`

### Plan Mode

- Make the plan extremely concise. Sacrifice grammar for the sake of concision.
- At the end of each plan, give me a list of unresolved questions to answer, if any.

## Tech Stack & Architecture

| Layer                  | Technology                   | Purpose                                            |
| ---------------------- | ---------------------------- | -------------------------------------------------- |
| **Frontend Framework** | Astro 5+                     | Static site generation, page routing, SEO          |
| **Component Library**  | Svelte 5+                    | Interactive UI components                          |
| **Content Management** | Sanity                       | Headless CMS for content                           |
| **Styling**            | CSS + Design Tokens          | Custom properties, no CSS-in-JS                    |
| **Animations**         | GSAP + ScrollTrigger + Lenis | Page transitions, scroll reveals, smooth scrolling |
| **Deployment**         | Cloudflare Pages             | Edge hosting with wrangler                         |

## Project Structure

```
/
├── frontend/          # Astro frontend application
│   ├── src/
│   │   ├── components/     # Svelte components (.svelte)
│   │   ├── layouts/        # Astro layouts (.astro)
│   │   ├── pages/          # Astro pages (.astro)
│   │   ├── data/sanity/    # GROQ queries & fragments
│   │   ├── scripts/        # TypeScript utilities
│   │   ├── sanity/         # Sanity helpers
│   │   └── styles/         # Global CSS
│   └── public/             # Static assets
└── studio/           # Sanity Studio CMS
    └── src/
        ├── schema-types/   # Content schemas
        └── structure/      # Studio configuration
```

## Code Conventions

### File Types

| File Type | Usage                             | Example                           |
| --------- | --------------------------------- | --------------------------------- |
| `.astro`  | Pages, layouts, static components | `BaseLayout.astro`, `index.astro` |
| `.svelte` | Interactive components            | `App.svelte`, `Header.svelte`     |
| `.ts`     | Utilities, scripts, types         | `lenis.ts`, `transitions.ts`      |
| `.css`    | Styles (tokens, reset, globals)   | `tokens.css`, `globals.css`       |

### Component Guidelines

**Page ↔ Template Rule (CRITICAL):**

Public pages (`src/pages/`) must ALWAYS render a template from `src/components/templates/` — never inline their own markup. This keeps public and preview routes in sync.

```astro
<!-- ✅ DO: delegate to the shared template -->
<BaseLayout {title} {description} isPreview={false}>
  <PageTemplate slug={slug} isPreview={false} />
</BaseLayout>

<!-- ❌ DON'T: inline markup that duplicates template content -->
<BaseLayout {title} {description}>
  <main><h1>{page.title}</h1>...</main>
</BaseLayout>
```

**Use `.astro` files for:**

- Pages and page templates
- Layouts
- Static components with no interactivity
- Components that fetch data at build time

**Use `.svelte` files for:**

- Interactive UI components
- Components with client-side state
- Components using animations/transitions
- Reusable component library items

### Component Size & Locality

Prefer **locality of behavior** over strict file-length limits.

- Keep related **markup + logic + styles** in the same component file when they represent one cohesive behavior.
- Treat component length targets (e.g. 200 lines) as **soft guidance**, not a hard rule.
- It is acceptable for a component to be longer when splitting would harm readability, increase indirection, or separate tightly coupled behavior.
- Split only at clear semantic boundaries (distinct sections/child components), not just to satisfy a numeric line target.
- Avoid extracting tiny one-off utility/style files when that reduces discoverability; prefer co-location unless reuse is clear.

### Naming Conventions

| Type          | Convention | Example                                    |
| ------------- | ---------- | ------------------------------------------ |
| Files         | kebab-case | `base-layout.astro`, `hero-section.svelte` |
| Components    | PascalCase | `<BaseLayout>`, `<HeroSection>`            |
| Functions     | camelCase  | `initLenis()`, `runSequence()`             |
| CSS Classes   | kebab-case | `.hero-section`, `.button-primary`         |
| CSS Variables | kebab-case | `--color-primary`, `--size-16`             |

## Design System

### Design Tokens (`frontend/src/styles/tokens.css`)

**ALWAYS use design tokens from `tokens.css` - never hardcode values.**

**Explicit Pixel-Based Naming:** Tokens use their pixel value in the name (e.g., `--text-16` = 16px, `--size-24` = 24px) but store values in `rem` for accessibility.

| Category    | Token Pattern    | Example                                    |
| ----------- | ---------------- | ------------------------------------------ |
| Colors      | `--color-*`      | `--color-primary`, `--color-text`          |
| Spacing     | `--size-{px}`    | `--size-4`, `--size-16`, `--size-64`       |
| Typography  | `--text-{px}`    | `--text-14`, `--text-18`, `--text-36`      |
| Font        | `--font-*`       | `--font-sans`, `--font-weight-500`         |
| Z-Index     | `--z-*`          | `--z-header`, `--z-modal`                  |
| Transitions | `--transition-*` | `--transition-fast`, `--transition-smooth` |

### Available Token Values

**Spacing (`--size-{px}`):** 4, 8, 12, 16, 24, 32, 48, 64, 96, 128
**Text sizes (`--text-{px}`):** 12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72

### Strict Token Enforcement

- **DO:** `color: var(--color-primary);`
- **DON'T:** `color: #000000;` or `color: black;`

- **DO:** `padding: var(--size-16);`
- **DON'T:** `padding: 16px;` or `padding: 1rem;`

- **DO:** `font-size: var(--text-18);`
- **DON'T:** `font-size: 18px;` or `font-size: 1.125rem;`

## Data Fetching with Sanity

### GROQ Query Patterns

**Location:** All GROQ queries go in `frontend/src/data/sanity/`

**Structure:**

```typescript
// fragments.ts - Reusable GROQ fragments
export const seoFragment = `
  seo {
    title,
    description,
    image
  }
`

// queries.ts - Full queries using fragments
import { defineQuery } from 'groq'
import { seoFragment } from './fragments'

export const PAGE_QUERY = defineQuery(`
  *[_type == "page" && slug.current == $slug][0] {
    _id,
    title,
    ${seoFragment}
  }
`)

// index.ts - Data fetchers with preview support
export async function getPage(slug: string, options: FetchOptions = {}) {
  return fetchData(PAGE_QUERY, { slug }, options)
}
```

### Query Guidelines

- **Always** use `defineQuery()` from `groq` for type safety
- **Always** use fragments for reusable fields (SEO, media, links)
- **Never** write inline GROQ queries in pages/components

### Sanity TypeGen Workflow

**CRITICAL:** After modifying GROQ queries or Sanity schemas, you MUST regenerate types.

**Run from project root:**

```bash
pnpm run types
```

This command performs two steps:

1. **Extract** - Runs `sanity schema extract` → generates `studio/schema.json`
2. **Generate** - Runs `sanity typegen generate` → scans `frontend/src/data/sanity/**/*.ts` → generates `frontend/sanity.types.ts`

**When to regenerate types:**

- After adding/modifying fields in `studio/src/schema-types/`
- After adding/modifying GROQ queries in `frontend/src/data/sanity/queries.ts`
- After adding/modifying GROQ fragments in `frontend/src/data/sanity/fragments.ts`

**DO NOT:**

- ❌ Manually edit `sanity.types.ts` (auto-generated)
- ❌ Forget to regenerate after schema/query changes
- ❌ Define custom types for Sanity data (use generated types)

## Animations & Transitions

### Architecture

Three script modules handle all animation concerns:

| Module                 | Purpose                                                                |
| ---------------------- | ---------------------------------------------------------------------- |
| `scripts/gsap.ts`      | GSAP + ScrollTrigger registration, Lenis sync, cleanup/refresh helpers |
| `scripts/transitions/` | GSAP timeline factories for each page transition type                  |
| `scripts/lenis.ts`     | Lenis smooth-scroll singleton (`initLenis()`, `getLenis()`)            |

### Initialization Order

`App.svelte` runs on mount (`client:load`):

```svelte
<script lang="ts">
  import { onMount } from 'svelte'
  import { syncLenisWithScrollTrigger } from '@/scripts/gsap'
  import { initLenis } from '@/scripts/lenis'

  onMount(() => {
    initLenis()
    syncLenisWithScrollTrigger()
  })
</script>
```

GSAP's ticker drives Lenis's RAF loop (no standalone `requestAnimationFrame`).

### Page Transitions (GSAP)

`PageTransitions.astro` intercepts Astro's View Transition lifecycle:

1. `astro:before-preparation` — determines transition type from routes, overrides `event.loader` to run GSAP exit animation before DOM swap
2. `astro:after-swap` — runs GSAP enter animation on new content, resets scroll
3. `astro:page-load` — calls `ScrollTrigger.refresh()` for new DOM

Transition types: `'none'`, `'fade'`. Add new types by extending the `exitTimelines` and `enterTimelines` records in `scripts/transitions/index.ts`.

To trigger an explicit transition type programmatically:

```typescript
import { navigate } from 'astro:transitions/client'
navigate('/projects/slug', { info: 'fade' })
```

### View Transitions

**Always use:**

- `<ClientRouter />` in layouts for SPA-like navigation

### Smooth Scrolling

**Access Lenis instance:**

```typescript
import { getLenis } from '@/scripts/lenis'

const lenis = getLenis()
lenis?.scrollTo('#section', { duration: 1.5 })
```

### ScrollTrigger in Svelte Components

Import `gsap` and `ScrollTrigger` from `@/scripts/gsap` (not from `gsap` directly). Always use `gsap.context()` scoped to the component element, and clean up in the return function.

**Using `$effect()` (preferred):**

```svelte
<script lang="ts">
  import { gsap, ScrollTrigger } from '@/scripts/gsap'

  let sectionEl: HTMLElement | undefined = $state()

  $effect(() => {
    if (!sectionEl) return
    const ctx = gsap.context(() => {
      gsap.from('.reveal-item', {
        y: 60,
        opacity: 0,
        stagger: 0.1,
        scrollTrigger: {
          trigger: sectionEl,
          start: 'top 80%',
        },
      })
    }, sectionEl)
    return () => ctx.revert()
  })
</script>

<section bind:this={sectionEl}>
  <div class="reveal-item">Content</div>
</section>
```

**Using `onMount()`:**

```svelte
<script lang="ts">
  import { onMount } from 'svelte'
  import { gsap, ScrollTrigger } from '@/scripts/gsap'

  let sectionEl: HTMLElement

  onMount(() => {
    const ctx = gsap.context(() => {
      gsap.from(sectionEl, {
        opacity: 0,
        y: 40,
        scrollTrigger: { trigger: sectionEl, start: 'top 85%' },
      })
    }, sectionEl)
    return () => ctx.revert()
  })
</script>
```

### Path Aliases

**Always use the `@/` alias** for imports within the frontend `src/` directory:

| Alias | Path      | Example                         |
| ----- | --------- | ------------------------------- |
| `@/*` | `./src/*` | `import { foo } from '@/utils'` |

- **DO:** `import { initLenis } from '@/scripts/lenis'`
- **DON'T:** `import { initLenis } from '../scripts/lenis'`

## Styling Best Practices

### CSS Import Order (in BaseLayout.astro)

```astro
import '@/styles/reset.css' // 1. Reset import '@/styles/tokens.css' // 2. Design tokens import
'@/styles/globals.css' // 3. Global styles import '@/styles/utils.css' // 4. Utility classes
```

### Utility Classes

Use utility classes from `utils.css` for common patterns:

- `.visually-hidden` - Screen reader only content

### Component Styles

- Use scoped styles in `.astro` and `.svelte` files
- Prefer design tokens over hardcoded values
- Keep specificity low
- **When implementing `:hover` states, always include `:focus-visible`** for keyboard accessibility

### CSS Grid & Subgrid Layout

Alway use the main grid defined in `globals.css` and leverage `grid-template-columns: subgrid` for child components to ensure consistent alignment across the site.
Only when explicitly asked, or when a unique layout is required, should you create a new display context.

**Main Grid (defined in `globals.css`):**

```css
.main-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  column-gap: var(--main-grid-gap);
  margin-inline: var(--main-grid-margin);
}
```

**Subgrid Pattern — CRITICAL:**

When a child needs to align with the parent grid, use `subgrid`. The child MUST:

1. Span columns on the parent grid (`grid-column: 1 / -1` or specific range)
2. Use `grid-template-columns: subgrid` to inherit parent's column tracks

```css
/* Parent spans full width and uses subgrid */
.parent {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: subgrid;
}

/* Child spans columns within the subgrid context */
.child {
  grid-column: span 2; /* or specific range like 1 / 4 */
}
```

## TypeScript

### Strict Mode

All TypeScript files must use strict mode (configured in `tsconfig.json`).

### Type Safety

- Use Sanity's `groq-codegen` for CMS type generation
- **Always use generated types from `sanity.types.ts`** for Sanity data (e.g., `ALL_TALENTS_QUERY_RESULT`, `NEWS_QUERY_RESULT`)
- **Never manually define interfaces** for data that comes from GROQ queries
- Define proper types for component props using the generated types
- Avoid `any` - use `unknown` if needed

### Using Sanity Types in Components

```typescript
// ✅ DO: Import generated types
import type { ALL_TALENTS_QUERY_RESULT, NEWS_QUERY_RESULT } from '../../../sanity.types'

interface Props {
  talents: ALL_TALENTS_QUERY_RESULT
  news: NEWS_QUERY_RESULT
}

// For single items from arrays, use indexed access
type NewsItem = NEWS_QUERY_RESULT[number]
```

```typescript
// ❌ DON'T: Manually define types that mirror GROQ query results
interface Talent {
  _id: string
  name: string
  // ... duplicating what's already in sanity.types.ts
}
```

## Environment Variables

### Frontend (`.env` in `frontend/`)

```bash
PUBLIC_SANITY_PROJECT_ID=your-project-id
PUBLIC_SANITY_DATASET=production
SITE_URL=http://localhost:4321
```

### Studio (`.env` in `studio/`)

```bash
SANITY_STUDIO_PROJECT_ID=your-project-id
SANITY_STUDIO_DATASET=production
```

## Development Workflow

**All commands run from project root.** — no need to `cd` into `frontend/` or `studio/`.

### Available Scripts

| Command                                  | Description                                |
| ---------------------------------------- | ------------------------------------------ |
| `pnpm dev`                               | Start both frontend and studio in parallel |
| `pnpm dev:frontend`                      | Start only the Astro frontend              |
| `pnpm dev:studio`                        | Start only the Sanity Studio               |
| `pnpm build`                             | Build both packages                        |
| `pnpm build:frontend`                    | Build only the frontend                    |
| `pnpm build:studio`                      | Build only the studio                      |
| `pnpm types`                             | Regenerate Sanity types (schema + GROQ)    |
| `pnpm check`                             | Run `astro check` (includes Svelte)        |
| `pnpm --filter studio exec tsc --noEmit` | Type-check Sanity Studio                   |
| `pnpm lint`                              | Lint & autofix all packages                |
| `pnpm format`                            | Format all files with Prettier             |
| `pnpm validate`                          | Run check + lint (full validation)         |
| `pnpm preview:frontend`                  | Preview the built frontend                 |
| `pnpm tunnel`                            | Start Cloudflare tunnel for frontend       |
| `pnpm deploy:frontend`                   | Deploy frontend to Cloudflare Pages        |
| `pnpm deploy:studio`                     | Deploy Sanity Studio                       |
| `pnpm scaffold:route`                    | Scaffold a new route in frontend           |

### Common Workflows

```bash
# Start development (runs types first via predev hook)
pnpm dev

# After changing Sanity schemas or GROQ queries
pnpm types

# Check for TypeScript errors (Astro + Svelte)
pnpm check

# Check for TypeScript errors in Sanity Studio
pnpm --filter studio exec tsc --noEmit

# Full validation before committing
pnpm validate

# Format code
pnpm format
```

## Important Rules

0. **Run validations based on changed area before final handoff:** run `pnpm check` if changes were made in `frontend/`, run `pnpm --filter studio exec tsc --noEmit` if changes were made in `studio/`, and run both if both areas changed
1. **Never hardcode values** - always use design tokens
2. **Use fragments** for all reusable GROQ patterns
3. **File type matters** - `.astro` for static, `.svelte` for interactive
4. **Import GSAP from `@/scripts/gsap`** - not from `gsap` directly
5. **Use `gsap.context()`** - always scope and clean up ScrollTrigger in components
6. **Lenis initializes on mount** - access via `getLenis()`
7. **GSAP handles page transitions** - exit/enter timelines in `transitions/index.ts`
8. **TypeScript strict mode** - no exceptions
9. **Use generated Sanity types** - never manually define GROQ result types
10. **Templates are self-fetching** - they call data functions internally
11. **Preview routes match public routes** - mirror structure in `/preview/`
12. **Pages must use templates** - public pages import and render a template component, never inline their own markup, so public and preview stay in sync

## Sanity Schema Patterns

### Singleton Documents

```typescript
export const homePageType = defineType({
  name: 'homePage',
  title: 'Home Page',
  type: 'document',
  fields: [
    { name: 'title', type: 'string' },
    { name: 'seo', type: 'seo' },
  ],
})
```

### Collection Documents

```typescript
export const pageType = defineType({
  name: 'page',
  title: 'Page',
  type: 'document',
  fields: [
    { name: 'title', type: 'string' },
    { name: 'slug', type: 'slug' },
    { name: 'content', type: 'blockContent' },
    { name: 'seo', type: 'seo' },
  ],
})
```

### Object Types

Define reusable objects (SEO, media, links) in `objects/` directory.

## Performance

- **Static first** - Use Astro's static generation
- **Partial hydration** - Only hydrate interactive components
- **Image optimization** - Use Sanity's image CDN
- **Lazy loading** - Load animations on interaction
- **CDN disabled** - Sanity configured with `useCdn: false` for fresh content

## Testing

- Test animations in sequence
- Verify view transitions between pages
- Check smooth scrolling behavior
- Validate design token usage
- Ensure TypeScript types are correct

## Common Pitfalls

- **DON'T** hardcode colors, spacing, or font sizes
- **DON'T** write inline GROQ queries
- **DON'T** use CSS-in-JS
- **DON'T** import `gsap` or `gsap/ScrollTrigger` directly — use `@/scripts/gsap`
- **DON'T** forget `gsap.context()` cleanup in components
- **DON'T** mix `.astro` and `.svelte` without purpose
- **DON'T** skip Lenis initialization
- **DON'T** use Svelte 4 patterns (`export let`, `$:`, `on:click`)
- **DON'T** use `<ViewTransitions />` instead of `<ClientRouter />`
- **DON'T** manually define types for GROQ results

- **DO** use design tokens consistently
- **DO** organize queries in `data/sanity/`
- **DO** use CSS custom properties
- **DO** import GSAP from `@/scripts/gsap` for ScrollTrigger and Lenis sync
- **DO** choose file type deliberately
- **DO** initialize Lenis in `App.svelte`
- **DO** use Svelte 5 runes (`$props()`, `$state()`, `$derived()`)
- **DO** use `<ClientRouter />` from `astro:transitions`
- **DO** import generated types from `sanity.types.ts`
