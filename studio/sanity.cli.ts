/**
 * Sanity CLI Configuration
 *
 * This file configures the Sanity CLI tool with project-specific settings
 * and customizes the Vite bundler configuration.
 * Learn more: https://www.sanity.io/docs/cli
 */

import { defineCliConfig } from 'sanity/cli'

import { PROJECT_ID, STUDIO_HOST } from './constants'

const dataset = 'production'

export default defineCliConfig({
  api: {
    projectId: PROJECT_ID,
    dataset,
  },
  studioHost: STUDIO_HOST,
  autoUpdates: true,
  vite: {
    server: {
      port: 3333,
      strictPort: false, // Allow fallback to next available port
    },
  },
  typegen: {
    path: [
      '../frontend/src/sanity/**/*.{ts,tsx,js,jsx}',
      '../frontend/src/data/sanity/**/*.{ts,tsx,js,jsx}',
    ],
    schema: './schema.json',
    generates: '../frontend/sanity.types.ts',
    overloadClientMethods: true,
  },
})
