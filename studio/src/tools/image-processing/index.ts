/**
 * "Traitement IA" — Sanity Studio custom tool.
 *
 * Registers a top-level tool for AI-powered image processing
 * using the Gemini API (lighting equalization + framing adjustment).
 */

import { ImageIcon } from '@sanity/icons'
import type { Tool } from 'sanity'

import { ImageProcessingTool } from './ImageProcessingTool'

export const imageProcessingTool: Tool = {
  title: 'Traitement IA',
  name: 'image-processing',
  icon: ImageIcon,
  component: ImageProcessingTool,
}
