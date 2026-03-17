/**
 * Shared media types
 *
 * Centralized type definitions for Sanity media objects.
 * Derived from generated query result types — do not edit manually.
 */
import type { PROJECT_QUERY_RESULT } from '../../../sanity.types'

/** A single normalized gallery item with image (required) and optional videoUrl. */
type GalleryItem = NonNullable<PROJECT_QUERY_RESULT>['mediaGallery'][number]

/** An expanded Sanity image with asset metadata, hotspot, and crop data. */
export type ExpandedImage = NonNullable<GalleryItem['image']>
