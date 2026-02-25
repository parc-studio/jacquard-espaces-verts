import { colorInput } from '@sanity/color-input'
// Uncomment for French locale:
// import { frFRLocale } from '@sanity/locale-fr-fr'
import { visionTool } from '@sanity/vision'
import { defineConfig, isDev, type TemplateResolver } from 'sanity'
import { linkField } from 'sanity-plugin-link-field'
import { media } from 'sanity-plugin-media'
import { references, referencesView } from 'sanity-plugin-references'
import { presentationTool } from 'sanity/presentation'
import { structureTool } from 'sanity/structure'

import { LOCAL_URL, PROJECT_ID, SITE_URL } from './constants'
import { resolve } from './src/presentation/resolve'
import { schemaTypes } from './src/schema-types'
import { structure } from './src/structure'

// Preview URL configuration
const PREVIEW_URL = isDev ? `${LOCAL_URL}/preview` : `${SITE_URL}/preview`

export default defineConfig({
  // TODO: Update studio name and title
  name: 'my-studio',
  title: 'My Studio',
  projectId: PROJECT_ID,
  dataset: 'production',
  plugins: [
    structureTool({
      structure,
      title: 'Content',

      defaultDocumentNode: (S) => S.document().views([S.view.form(), referencesView(S)]),
    }),
    presentationTool({
      resolve,
      previewUrl: PREVIEW_URL,
      allowOrigins: [SITE_URL, LOCAL_URL],
    }),
    media(),
    references(),
    colorInput(),
    ...(isDev ? [visionTool({ title: 'Query' })] : []),
    linkField({
      // Update with your linkable types
      linkableSchemaTypes: ['aboutPage', 'homePage', 'page', 'project', 'projectsIndex'],
    }),
    // TODO: Uncomment for French locale:
    // frFRLocale(),
  ],
  schema: { types: schemaTypes },

  // Initial value templates for pre-filled document creation
  // TODO: Add custom templates as needed
  initialValueTemplates: ((prev: ReturnType<TemplateResolver>) => [
    ...prev,
    // Example: Create a project with a pre-selected tag
    // {
    //   id: 'project-with-tag',
    //   title: 'Project with Tag',
    //   schemaType: 'project',
    //   parameters: [{ name: 'tagId', type: 'string' }],
    //   value: ({ tagId }: { tagId: string }) => ({
    //     tags: [{ _type: 'reference', _ref: tagId }],
    //   }),
    // },
  ]) as TemplateResolver,
})
