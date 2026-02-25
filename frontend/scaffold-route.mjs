#!/usr/bin/env node
/**
 * Route Scaffolding Script
 *
 * Generates:
 * 1. Self-fetching template (with TODO reminder for query)
 * 2. Public page
 * 3. Auto-wires preview route (pattern + template conditional)
 *
 * Usage: pnpm scaffold:route "blog/{slug}" blogPost
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// =============================================================================
// Utilities
// =============================================================================

const toPascalCase = (str) =>
  str
    .split(/[-_/]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('')

const toCamelCase = (str) => {
  const pascal = toPascalCase(str)
  return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

const toKebabCase = (str) =>
  str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase()

const log = (msg, type = 'info') => {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warn: '\x1b[33m',
    dry: '\x1b[35m',
  }
  console.log(`${colors[type] || ''}${msg}\x1b[0m`)
}

function parseRoute(pattern, docType, singleton) {
  const segments = pattern.split('/').filter(Boolean)
  const hasSlug = !singleton && segments.some((s) => s.includes('{'))
  const dynamicIdx = segments.findIndex((s) => s.includes('{'))
  const staticPrefix = hasSlug ? segments.slice(0, dynamicIdx).join('/') : segments.join('/')
  const baseName = staticPrefix.split('/').filter(Boolean).pop() || docType

  return {
    pattern,
    hasSlug,
    staticPrefix,
    templateName: toPascalCase(baseName) + 'Template',
    templateId: toCamelCase(baseName),
    docType,
    singleton,
  }
}

// =============================================================================
// Generators
// =============================================================================

function generateTemplate(info) {
  const css = toKebabCase(info.templateId)
  const propsInterface = info.hasSlug
    ? `interface Props {\n  slug: string\n  isPreview?: boolean\n}`
    : `interface Props {\n  isPreview?: boolean\n}`

  const propsDestructure = info.hasSlug
    ? `const { slug, isPreview = false } = Astro.props`
    : `const { isPreview = false } = Astro.props`

  return `---
/**
 * ${info.templateName}
 *
 * TODO: Create your GROQ query and data fetcher:
 * 1. Add query to src/data/sanity/queries.ts
 * 2. Create fetcher in src/data/sanity/index.ts (use { preview: isPreview })
 * 3. Import and call the fetcher below
 */

${propsInterface}

${propsDestructure}

// TODO: Fetch data using isPreview flag
// const data = await get${toPascalCase(info.templateId)}(${info.hasSlug ? 'slug, ' : ''}{ preview: isPreview })
const data = { title: 'Placeholder' }
---

<main class="main-grid">
  <article class="${css}">
    <h1>{data?.title}</h1>
    <p>Edit this template: src/components/templates/${info.templateName}.astro</p>
  </article>
</main>

<style>
  .${css} {
    grid-column: 2 / -2;
    padding: var(--size-64) 0;
  }

  h1 {
    font-size: var(--text-36);
    font-weight: var(--font-weight-bold);
  }
</style>
`
}

function generatePublicPage(info) {
  if (info.hasSlug) {
    return `---
import BaseLayout from '../../layouts/BaseLayout.astro'
import ${info.templateName} from '../../components/templates/${info.templateName}.astro'

// TODO: Add getStaticPaths for prerendering
// export async function getStaticPaths() {
//   const items = await getAll${toPascalCase(info.templateId)}s()
//   return items.map((item) => ({ params: { slug: item.slug.current } }))
// }

const { slug } = Astro.params
---

<BaseLayout title="${toPascalCase(info.templateId)}" description="">
  <${info.templateName} slug={slug!} />
</BaseLayout>
`
  }

  return `---
import BaseLayout from '../../layouts/BaseLayout.astro'
import ${info.templateName} from '../../components/templates/${info.templateName}.astro'
---

<BaseLayout title="${toPascalCase(info.templateId)}" description="">
  <${info.templateName} />
</BaseLayout>
`
}

// =============================================================================
// File Updaters
// =============================================================================

function addRoutePattern(content, info) {
  // Build regex pattern
  let regexStr
  if (!info.hasSlug && !info.staticPrefix) {
    regexStr = '/^$/'
  } else if (info.hasSlug) {
    const prefix = info.staticPrefix ? info.staticPrefix.replace(/\//g, '\\/') + '\\/' : ''
    regexStr = `/^${prefix}(.+)$/`
  } else {
    regexStr = `/^${info.staticPrefix.replace(/\//g, '\\/')}$/`
  }

  const newRoute = `  { pattern: ${regexStr}, templateId: '${info.templateId}' }, // /preview/${info.pattern}`

  // Find catch-all pattern (last route before ])
  const routesMatch = content.match(/const PREVIEW_ROUTES[^=]*=\s*\[([\s\S]*?)\]/)
  if (!routesMatch) return content

  const routesArray = routesMatch[1]
  const lines = routesArray.split('\n').filter((l) => l.trim())

  // Insert before the last route (catch-all)
  if (lines.length > 1) {
    const lastLine = lines[lines.length - 1]
    const insertPos = content.indexOf(lastLine)
    return content.slice(0, insertPos) + newRoute + '\n' + content.slice(insertPos)
  }

  // Or append
  const closingBracket = content.lastIndexOf(']')
  return content.slice(0, closingBracket) + newRoute + '\n' + content.slice(closingBracket)
}

function addTemplateId(content, newId) {
  const typeMatch = content.match(/export type TemplateId\s*=\s*([^\n]+)/)
  if (!typeMatch || typeMatch[1].includes(`'${newId}'`)) return content

  const types = typeMatch[1]
    .replace(/'/g, '')
    .split('|')
    .map((t) => t.trim())
  // Insert before last (catch-all like 'page')
  types.splice(types.length - 1, 0, newId)
  const newType = types.map((t) => `'${t}'`).join(' | ')

  return content.replace(
    /export type TemplateId\s*=\s*[^\n]+/,
    `export type TemplateId = ${newType}`
  )
}

function addPatternDescription(content, info) {
  const desc = info.hasSlug
    ? `'/preview/${info.pattern} → ${info.templateName}'`
    : `'/preview/${info.pattern || ''} → ${info.templateName}'`

  const funcMatch = content.match(
    /function getSupportedRoutePatterns[\s\S]*?return\s*\[([\s\S]*?)\]/
  )
  if (!funcMatch || funcMatch[1].includes(info.templateName)) return content

  const entries = funcMatch[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  entries.splice(entries.length - 1, 0, desc) // Before catch-all

  const newArray = '\n    ' + entries.join(',\n    ') + ',\n  '
  return content.replace(
    /function getSupportedRoutePatterns[\s\S]*?return\s*\[[\s\S]*?\]/,
    funcMatch[0].replace(/\[[\s\S]*?\]/, `[${newArray}]`)
  )
}

function addTemplateImport(content, templateName) {
  const importLine = `import ${templateName} from '../../components/templates/${templateName}.astro'`
  if (content.includes(importLine)) return content

  // Find last template import
  const lastImport = content.match(/import \w+Template from ['"].*templates.*['"]\n/g)?.pop()
  if (!lastImport) return content

  const pos = content.indexOf(lastImport) + lastImport.length
  return content.slice(0, pos) + importLine + '\n' + content.slice(pos)
}

function addTemplateConditional(content, info) {
  const marker = '{/* SCAFFOLDING: add new templates here */}'
  if (!content.includes(marker)) return content

  const conditional = info.hasSlug
    ? `  {templateId === '${info.templateId}' && slug && <${info.templateName} slug={slug} isPreview={true} />}`
    : `  {templateId === '${info.templateId}' && <${info.templateName} isPreview={true} />}`

  const pos = content.indexOf(marker) + marker.length
  const nextLine = content.indexOf('\n', pos)
  return content.slice(0, nextLine + 1) + conditional + '\n' + content.slice(nextLine + 1)
}

// =============================================================================
// Main
// =============================================================================

function printUsage() {
  console.log(`
Usage: pnpm scaffold:route <route-pattern> <document-type> [--singleton] [--dry-run]

Examples:
  pnpm scaffold:route "blog/{slug}" blogPost
  pnpm scaffold:route "about" aboutPage --singleton
  pnpm scaffold:route "news/{slug}" news --dry-run
`)
}

async function main() {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h') || args.length < 2) {
    printUsage()
    process.exit(args.length < 2 ? 1 : 0)
  }

  const pattern = args[0]
  const docType = args[1]
  const singleton = args.includes('--singleton')
  const dryRun = args.includes('--dry-run')

  const info = parseRoute(pattern, docType, singleton)

  if (dryRun) log('\n🔍 DRY-RUN MODE\n', 'dry')

  log(`🚀 Scaffolding: ${info.templateName}`)
  log(`   Pattern: /${pattern}`)
  log(`   Type: ${singleton ? 'Singleton' : 'Collection'}\n`)

  // Paths
  const templatePath = path.join(
    __dirname,
    'src/components/templates',
    `${info.templateName}.astro`
  )
  const routesPath = path.join(__dirname, 'src/data/preview-routes.ts')
  const previewPath = path.join(__dirname, 'src/pages/preview/[...route].astro')

  let publicPath = null
  if (info.hasSlug && info.staticPrefix) {
    publicPath = path.join(__dirname, 'src/pages', info.staticPrefix, '[slug].astro')
  } else if (!info.hasSlug && info.staticPrefix) {
    publicPath = path.join(__dirname, 'src/pages', `${info.staticPrefix}.astro`)
  }

  try {
    // 1. Template
    if (fs.existsSync(templatePath)) {
      log(`⚠️  Template exists: ${info.templateName}.astro`, 'warn')
    } else {
      if (!dryRun) {
        fs.mkdirSync(path.dirname(templatePath), { recursive: true })
        fs.writeFileSync(templatePath, generateTemplate(info))
      }
      log(`✓ Created template: ${info.templateName}.astro`, dryRun ? 'dry' : 'success')
    }

    // 2. Public page
    if (!publicPath) {
      log(`⚠️  Skipped public page (root-level route)`, 'warn')
    } else if (fs.existsSync(publicPath)) {
      log(`⚠️  Public page exists: ${path.relative(__dirname, publicPath)}`, 'warn')
    } else {
      if (!dryRun) {
        fs.mkdirSync(path.dirname(publicPath), { recursive: true })
        fs.writeFileSync(publicPath, generatePublicPage(info))
      }
      log(
        `✓ Created public page: ${path.relative(__dirname, publicPath)}`,
        dryRun ? 'dry' : 'success'
      )
    }

    // 3. Update preview-routes.ts
    let routesContent = fs.readFileSync(routesPath, 'utf-8')
    if (routesContent.includes(`'${info.templateId}'`)) {
      log(`⚠️  Route already exists: ${info.templateId}`, 'warn')
    } else {
      routesContent = addTemplateId(routesContent, info.templateId)
      routesContent = addRoutePattern(routesContent, info)
      routesContent = addPatternDescription(routesContent, info)
      if (!dryRun) fs.writeFileSync(routesPath, routesContent)
      log(`✓ Updated preview-routes.ts`, dryRun ? 'dry' : 'success')
    }

    // 4. Update [...route].astro
    let previewContent = fs.readFileSync(previewPath, 'utf-8')
    if (previewContent.includes(`import ${info.templateName}`)) {
      log(`⚠️  Template already in preview page`, 'warn')
    } else {
      previewContent = addTemplateImport(previewContent, info.templateName)
      previewContent = addTemplateConditional(previewContent, info)
      if (!dryRun) fs.writeFileSync(previewPath, previewContent)
      log(`✓ Updated [...route].astro`, dryRun ? 'dry' : 'success')
    }

    // Summary
    log(`\n✅ Done!${dryRun ? ' (dry-run)' : ''}`, 'success')
    log(`\nNext steps:`)
    log(`  1. Add GROQ query to src/data/sanity/queries.ts`)
    log(`  2. Create fetcher in src/data/sanity/index.ts`)
    log(`  3. Update template to fetch data with { preview: isPreview }`)
    log(`  4. Test: /preview/${pattern.replace('{slug}', 'test-slug')}\n`)
  } catch (err) {
    log(`\n❌ Error: ${err.message}`, 'error')
    process.exit(1)
  }
}

main()
