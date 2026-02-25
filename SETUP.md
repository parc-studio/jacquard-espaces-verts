# Setup Guide

This is a template for building websites with Astro, Svelte 5, and Sanity CMS.

## Quick Start

### 1. Clone and Install

```bash
git clone <this-repo> my-project
cd my-project
pnpm install
```

### 2. Configure Sanity

Create a new Sanity project at [sanity.io/manage](https://sanity.io/manage) or use an existing one.

#### Update Configuration Placeholders

Replace the placeholder values in these files:

| File                                  | Placeholder             | Replace With                           |
| ------------------------------------- | ----------------------- | -------------------------------------- |
| `studio/constants.ts`                 | `YOUR_PROJECT_ID`       | Your Sanity project ID                 |
| `studio/constants.ts`                 | `YOUR_STUDIO_HOSTNAME`  | Your Studio hostname (e.g., `my-site`) |
| `studio/constants.ts`                 | `http://localhost:4321` | Your local dev URL (usually correct)   |
| `studio/constants.ts`                 | `https://example.com`   | Your production URL                    |
| `studio/constants.ts`                 | `PAGE_REFERENCES` array | Document types for page linking        |
| `frontend/src/utils/sanity/client.ts` | `YOUR_PROJECT_ID`       | Your Sanity project ID                 |
| `frontend/src/utils/sanity/client.ts` | `https://example.com`   | Your production URL                    |
| `frontend/wrangler.jsonc`             | `your-project-name`     | Your Cloudflare Pages project name     |

#### Environment Variables

Create `.env` files:

**`studio/.env`:**

```bash
SANITY_STUDIO_PROJECT_ID=your-project-id
SANITY_STUDIO_DATASET=production
```

**`frontend/.env`:**

```bash
PUBLIC_SANITY_PROJECT_ID=your-project-id
PUBLIC_SANITY_DATASET=production
SITE_URL=http://localhost:4321
```

### 3. Enable French Locale (Optional)

If your project needs French language support:

1. Open `studio/sanity.config.ts`
2. Uncomment the `frFRLocale` import
3. Uncomment the `i18n` configuration in the plugins array

### 4. Start Development

```bash
pnpm dev
```

This starts both:

- **Frontend:** http://localhost:4321
- **Studio:** http://localhost:3333

## Project Structure

```
├── frontend/           # Astro + Svelte frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── helpers/     # Debug grid, transitions, analytics
│   │   │   ├── media/       # SanityImage, Video, Media components
│   │   │   └── templates/   # Page templates (self-fetching)
│   │   ├── data/sanity/     # GROQ queries and data fetching
│   │   ├── layouts/         # BaseLayout.astro
│   │   ├── pages/           # Astro pages
│   │   ├── styles/          # CSS (tokens, reset, globals)
│   │   └── utils/           # Utilities
│   └── wrangler.jsonc       # Cloudflare Pages config
└── studio/             # Sanity Studio
    ├── constants.ts         # Project configuration
    └── src/
        └── schema-types/    # Content schemas
```

## Workflow

### Adding a New Route

Use the scaffold script:

```bash
pnpm scaffold:route "blog/{slug}" blogPost
```

This creates:

1. Template in `src/components/templates/`
2. Page in `src/pages/`
3. Updates preview routes automatically

Then:

1. Add GROQ query in `src/data/sanity/queries.ts`
2. Add data fetcher in `src/data/sanity/index.ts`
3. Run `pnpm types` to regenerate types

### After Changing Schemas or Queries

Always regenerate types:

```bash
pnpm types
```

### Validation

Before committing:

```bash
pnpm validate
```

## Deployment

### Frontend (Cloudflare Pages)

```bash
pnpm deploy
```

Or set up automatic deploys via GitHub integration.

### Studio

```bash
pnpm deploy:studio
```

Deploys to `https://<your-hostname>.sanity.studio`

## Key Concepts

### Self-Fetching Templates

Templates in `src/components/templates/` fetch their own data:

```astro
---
import { getPage } from '../../data/sanity'

interface Props {
  slug: string
  isPreview?: boolean
}

const { slug, isPreview = false } = Astro.props
const page = await getPage(slug, { preview: isPreview })
---

<main>{page?.title}</main>
```

This pattern enables:

- Same template for static and preview
- Data fetching close to rendering
- Clean page components

### Media Components

Use the Media component for Sanity images/video:

```svelte
<script>
  import Media from '$lib/components/media/Media.svelte'
</script>

<Media media={{ image: project.coverImage }} sizes="100vw" layout="fill" />
```

### Design Tokens

Always use tokens from `tokens.css`:

```css
/* ✅ Correct */
padding: var(--size-16);
font-size: var(--text-18);
color: var(--color-primary);

/* ❌ Wrong */
padding: 16px;
font-size: 1.125rem;
color: #000;
```

### 8-Column Grid

Use the main grid with subgrid:

```css
.section {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: subgrid;
}

.content {
  grid-column: 2 / -2; /* Columns 2-7 */
}
```

## Troubleshooting

### Types not updating

```bash
pnpm types
```

### Preview not working

1. Check Studio is running: http://localhost:3333
2. Ensure `isPreview={true}` is passed to templates
3. Check browser console for errors

### Build fails

1. Run `pnpm validate` to check for errors
2. Ensure all environment variables are set
3. Check for TypeScript errors: `pnpm check`

## Resources

- [Astro Docs](https://docs.astro.build)
- [Svelte 5 Docs](https://svelte.dev/docs)
- [Sanity Docs](https://www.sanity.io/docs)
- [Cloudflare Pages](https://developers.cloudflare.com/pages)
