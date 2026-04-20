import cloudflare from '@astrojs/cloudflare'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import svelte from '@astrojs/svelte'
import sanity from '@sanity/astro'
import seoGraph from '@jdevalk/astro-seo-graph/integration'

import { defineConfig, envField, fontProviders } from 'astro/config'

import { apiVersion, dataset, projectId, siteUrl, studioUrl } from './src/utils/sanity/client'

export default defineConfig({
  site: siteUrl || 'http://localhost:4321',
  adapter: cloudflare({
    imageService: 'cloudflare',
  }),
  trailingSlash: 'never',
  devToolbar: { enabled: false },
  integrations: [
    sanity({
      projectId,
      dataset,
      useCdn: false,
      apiVersion,
      stega: {
        studioUrl,
      },
    }),
    svelte(),
    sitemap({
      serialize(item) {
        if (/\/signature-de-mail\/?$/.test(item.url)) {
          return undefined
        }

        return item
      },
    }),
    react(),
    seoGraph({
      validateOnBuild: true,
      llmsTxt: {
        siteUrl: siteUrl || 'http://localhost:4321',
        title: 'Jacquard Espaces Verts',
        description:
          "Jacquard Espaces Verts est une entreprise de paysagisme spécialisée dans la conception et l'entretien d'espaces verts.",
      },
    }),
  ],
  output: 'static',
  image: { domains: ['cdn.sanity.io'] },
  build: {
    inlineStylesheets: 'always',
  },
  vite: {
    server: {
      /*
        Cloudflare tunnel support
       * npx cloudflared tunnel --url http://localhost:4321
       */
      allowedHosts: ['.trycloudflare.com'],
      host: true,
    },
    build: {
      cssCodeSplit: false,
      assetsInlineLimit: 100000,
    },
  },
  env: {
    schema: {
      PUBLIC_SANITY_STUDIO_PROJECT_ID: envField.string({ context: 'client', access: 'public' }),
      PUBLIC_SANITY_STUDIO_DATASET: envField.string({
        context: 'client',
        access: 'public',
        default: 'production',
      }),
      SITE_URL: envField.string({ context: 'client', access: 'public', optional: true }),
      SANITY_READ_TOKEN: envField.string({ context: 'server', access: 'secret' }),
      SANITY_WRITE_TOKEN: envField.string({ context: 'server', access: 'secret' }),
      KLING_ACCESS_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      KLING_SECRET_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      FEEDBACK_PASSWORD: envField.string({ context: 'server', access: 'secret', optional: true }),
      PUBLIC_ENABLE_FEEDBACK: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
      }),
    },
  },
  experimental: {
    chromeDevtoolsWorkspace: true,
    fonts: [
      {
        // TODO: Replace with your project fonts
        provider: fontProviders.local(),
        name: 'Pinokio Sans',
        cssVariable: '--font-sans',
        fallbacks: ['sans-serif'],
        options: {
          variants: [
            {
              style: 'normal',
              display: 'swap',
              src: ['./src/assets/fonts/PinokioSans-Medium.woff2'],
            },
          ],
        },
      },
    ],
  },
})
