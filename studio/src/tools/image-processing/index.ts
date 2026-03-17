/**
 * "Traitement d'image" — Sanity Studio custom tool.
 *
 * Registers a top-level tool for AI-powered image correction
 * (colour grading, exposure, contrast, straightening).
 */

import { ImageIcon } from '@sanity/icons'
import type { Tool } from 'sanity'
import { route } from 'sanity/router'

import { ImageProcessingTool } from './ImageProcessingTool'

export const imageProcessingTool: Tool = {
  title: "Traitement d'image",
  name: 'image-processing',
  icon: ImageIcon,
  component: ImageProcessingTool,
  router: route.create('/', [route.create('/project/:projectId'), route.create('/asset/:assetId')]),
}
