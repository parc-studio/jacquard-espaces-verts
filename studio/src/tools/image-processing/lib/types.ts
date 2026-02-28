/**
 * Types for the AI image processing tool.
 */

/** Available processing modes */
export type ProcessingMode = 'equalize' | 'cadrage'

/** A Sanity image asset with metadata needed for processing */
export interface SanityImageAsset {
  _id: string
  url: string
  originalFilename?: string
  mimeType: string
  metadata?: {
    dimensions?: {
      width: number
      height: number
    }
    lqip?: string
  }
}

/** A project document with its images */
export interface ProjectWithImages {
  _id: string
  titre: string
  localisation?: string
  images: SanityImageAsset[]
}

/** Result of a Gemini processing operation */
export interface ProcessingResult {
  /** Base64-encoded image data */
  base64Data: string
  /** MIME type of the result image */
  mimeType: string
  /** Text feedback from Gemini about what was changed */
  feedback?: string
}

/** Workflow step */
export type WorkflowStep = 'select' | 'process' | 'review'

/** State for the overall tool */
export interface ToolState {
  step: WorkflowStep
  selectedAsset: SanityImageAsset | null
  selectedProjectId: string | null
  processingMode: ProcessingMode | null
  isProcessing: boolean
  result: ProcessingResult | null
  error: string | null
}

/** Initial tool state */
export const INITIAL_TOOL_STATE: ToolState = {
  step: 'select',
  selectedAsset: null,
  selectedProjectId: null,
  processingMode: null,
  isProcessing: false,
  result: null,
  error: null,
}
