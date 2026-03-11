/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly SANITY_STUDIO_PROJECT_ID?: string
  readonly SANITY_STUDIO_DATASET?: string
  readonly SANITY_STUDIO_GCP_PROJECT_ID?: string
  readonly SANITY_STUDIO_GCP_CLIENT_EMAIL?: string
  readonly SANITY_STUDIO_GCP_PRIVATE_KEY?: string
  readonly SANITY_STUDIO_GCP_REGION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
