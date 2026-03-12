/**
 * Types for the image processing tool.
 */

/** Available processing modes */
export type ProcessingMode = 'auto_correct'

/** A Sanity image asset with metadata needed for processing */
export interface SanityImageAsset {
  _id: string
  url: string
  originalFilename?: string
  mimeType: string
  label?: string
  description?: string
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

/** Result of a processing operation */
export interface ProcessingResult {
  /** Base64-encoded image data */
  base64Data: string
  /** MIME type of the result image */
  mimeType: string
  /** Text feedback about what was changed */
  feedback?: string
  /** True when AI analysis failed and fixed fallback values were used */
  analysisFailed?: boolean
}

/** Workflow step */
export type WorkflowStep = 'select' | 'process' | 'review' | 'bulk'

// ---------------------------------------------------------------------------
// Bulk processing
// ---------------------------------------------------------------------------

/** Status of a single image in a bulk job */
export type BulkItemStatus =
  | 'pending'
  | 'analyzing'
  | 'correcting'
  | 'correction-done'
  | 'uploading'
  | 'replacing'
  | 'done'
  | 'error'

/** A single image tracked in a bulk job */
export interface BulkJobItem {
  asset: SanityImageAsset
  status: BulkItemStatus
  analysisResult?: ProcessingResult
  correctionResult?: ProcessingResult
  newAssetId?: string
  error?: string
}

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

/** Human-readable labels for processing modes (French) */
export const MODE_LABELS: Record<ProcessingMode, string> = {
  auto_correct: 'Correction photo automatique',
}

/** Short descriptions for processing modes (French) */
export const MODE_DESCRIPTIONS: Record<ProcessingMode, string> = {
  auto_correct:
    'Auto-niveaux, balance des blancs chaude, récupération ombres/hautes lumières, contraste et vibrance.',
}
