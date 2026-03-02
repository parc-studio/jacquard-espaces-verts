/**
 * Shared media types
 *
 * Centralized type definitions for Sanity media objects.
 * Derived from generated query result types — do not edit manually.
 */
import type { PROJECT_QUERY_RESULT } from '../../../sanity.types'

/** An expanded Sanity image with asset metadata, hotspot, and crop data. */
type GalleryImage = NonNullable<PROJECT_QUERY_RESULT>['mediaGallery'][number]
export type ExpandedImage = Omit<GalleryImage, '_key'> & { _key?: string }
