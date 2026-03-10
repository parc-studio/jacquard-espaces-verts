/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly SANITY_STUDIO_CLOUDINARY_CLOUD_NAME?: string
  readonly SANITY_STUDIO_CLOUDINARY_API_KEY?: string
  readonly SANITY_STUDIO_CLOUDINARY_API_SECRET?: string
  readonly SANITY_STUDIO_PROJECT_ID?: string
  readonly SANITY_STUDIO_DATASET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
