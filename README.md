# Astro + Svelte + Sanity Template

A production-ready template for building modern websites with Astro, Svelte, and Sanity CMS by Parc Studio.

## Features

- 🚀 **Astro 5+** - Fast static site generation with optimal performance
- ⚡ **Svelte 5+** - Reactive components with minimal JavaScript
- 📝 **Sanity CMS** - Flexible headless content management
- 🎨 **Design Tokens** - Consistent styling with CSS custom properties
- 🎭 **GSAP + Lenis** - Smooth animations and scrolling
- 🔄 **View Transitions** - Seamless page navigation
- 📦 **pnpm Workspace** - Monorepo with frontend and studio packages
- 🔧 **TypeScript** - Full type safety across the stack
- 🎯 **ESLint + Prettier** - Code quality and formatting
- 🪝 **Husky** - Pre-commit hooks for quality checks

## Prerequisites

- Node.js 18+ (LTS recommended)
- pnpm 8+
- A Sanity account and project

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/parc-studio/astro-svelte-sanity.git
cd astro-svelte-sanity
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment Variables

#### Frontend Configuration

Create `frontend/.env` based on `frontend/.env.example`:

```bash
cd frontend
cp .env.example .env
```

Edit `frontend/.env` with your Sanity project details:

```env
PUBLIC_SANITY_PROJECT_ID=your-project-id
PUBLIC_SANITY_DATASET=production
SITE_URL=http://localhost:4321
```

#### Studio Configuration

Create `studio/.env` based on `studio/.env.example`:

```bash
cd studio
cp .env.example .env
```

Edit `studio/.env`:

```env
SANITY_STUDIO_PROJECT_ID=your-project-id
SANITY_STUDIO_DATASET=production
```

### 4. Add Custom Font (Optional)

Place your Helvetica Now variable font file in:

```
frontend/src/assets/fonts/Helvetica-Now-Var.ttf
```

Or update `frontend/astro.config.ts` to use your preferred font.

### 5. Start Development

```bash
# From the root directory
pnpm dev
```

This will start:

- Frontend at `http://localhost:4321`
- Sanity Studio at `http://localhost:3333`

## Project Structure

```
/
├── .github/
│   └── copilot-instructions.md    # Development guidelines
├── .husky/
│   └── pre-commit                 # Pre-commit hooks
├── frontend/                      # Astro frontend application
│   ├── src/
│   │   ├── components/           # Svelte components
│   │   ├── layouts/              # Astro layouts
│   │   ├── pages/                # Astro pages & routes
│   │   ├── data/sanity/          # GROQ queries & data layer
│   │   ├── scripts/              # TypeScript utilities
│   │   ├── sanity/               # Sanity helpers
│   │   └── styles/               # Global CSS & design tokens
│   ├── public/                   # Static assets
│   ├── astro.config.ts           # Astro configuration
│   └── package.json
├── studio/                        # Sanity Studio CMS
│   ├── src/
│   │   ├── schema-types/         # Content schemas
│   │   └── structure/            # Studio desk structure
│   ├── sanity.config.ts          # Sanity configuration
│   └── package.json
├── eslint.config.mjs              # ESLint configuration
├── package.json                   # Root workspace config
├── pnpm-workspace.yaml            # pnpm workspace definition
└── README.md
```

## Available Scripts

Run these commands from the root directory:

```bash
# Development
pnpm dev              # Start both frontend and studio in development mode

# Building
pnpm build            # Build both packages for production

# Type Checking
pnpm types            # Run TypeScript type checking

# Linting & Formatting
pnpm lint             # Lint all packages with ESLint
pnpm format           # Format all files with Prettier

# Package-specific
pnpm --filter frontend dev      # Run only frontend dev server
pnpm --filter studio dev        # Run only Sanity Studio
```

## Tech Stack

### Frontend

- **Astro 5+** - Static site generator and framework
- **Svelte 5+** - Component framework
- **TypeScript** - Type safety
- **GSAP** - Animation library
- **Lenis** - Smooth scrolling
- **astro-vtbot** - View transitions
- **Sanity Client** - Content fetching

### Studio

- **Sanity** - Headless CMS
- **React** - Studio UI framework
- **TypeScript** - Type safety

### Tooling

- **pnpm** - Fast, efficient package manager
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Husky** - Git hooks
- **lint-staged** - Pre-commit checks

## Development Guidelines

### File Types

- **`.astro`** - Use for pages, layouts, and static components
- **`.svelte`** - Use for interactive components with client-side logic
- **`.ts`** - Use for utilities, scripts, and type definitions
- **`.css`** - Use for styles (prefer design tokens)

### Design Tokens

All styling should use design tokens from `frontend/src/styles/tokens.css`:

```css
/* ✅ Good */
color: var(--color-primary);
padding: var(--spacing-md);

/* ❌ Bad */
color: #000000;
padding: 16px;
```

### Data Fetching

All Sanity queries should be organized in `frontend/src/data/sanity/`:

1. **fragments.ts** - Reusable GROQ fragments
2. **queries.ts** - Full queries using fragments
3. **index.ts** - Data fetchers with caching

### Animations

- Import GSAP in components as needed (not initialized globally)
- Use `runSequence()` helper for sequenced animations
- Initialize Lenis in `App.svelte` for smooth scrolling

## Deployment

### Frontend (Astro)

The frontend can be deployed to various platforms:

- **Vercel** - Zero-config deployment
- **Netlify** - Simple drag-and-drop
- **Cloudflare Pages** - Edge deployment
- **Your own server** - Standard Node.js hosting

Build command: `pnpm --filter frontend build`
Output directory: `frontend/dist`

### Studio (Sanity)

Deploy Sanity Studio:

```bash
cd studio
pnpm sanity deploy
```

## Customization

### Adding New Pages

1. Create a new `.astro` file in `frontend/src/pages/`
2. Use the `BaseLayout` component
3. Fetch data from Sanity if needed

### Creating Components

1. Add `.svelte` files to `frontend/src/components/`
2. Use design tokens for styling
3. Import and use in Astro pages/layouts

### Extending Sanity Schema

1. Add new schema types to `studio/src/schema-types/`
2. Export from `studio/src/schema-types/index.ts`
3. Update structure in `studio/src/structure/`
4. Regenerate types: `pnpm --filter studio types`

## Troubleshooting

### Port Already in Use

If you see an error about ports being in use:

```bash
# Kill processes on specific ports
npx kill-port 4321 3333
```

### Sanity Connection Issues

Verify your environment variables are set correctly in both `.env` files.

### Type Errors

Regenerate Sanity types:

```bash
cd frontend
pnpm sanity-typegen
```

### Build Errors

Clear caches and reinstall:

```bash
rm -rf node_modules frontend/node_modules studio/node_modules
rm pnpm-lock.yaml
pnpm install
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `pnpm lint` and `pnpm format`
5. Commit with meaningful messages
6. Submit a pull request

## License

MIT License - feel free to use this template for your projects.

## Support

For issues and questions:

- Check the [GitHub Issues](https://github.com/parc-studio/astro-svelte-sanity/issues)
- Review the [Copilot Instructions](.github/copilot-instructions.md)
- Visit [Astro Docs](https://docs.astro.build)
- Visit [Sanity Docs](https://www.sanity.io/docs)

---

Made with ❤️ by [Parc Studio](https://parc.studio)
