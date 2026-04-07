/**
 * GCP credentials management via @sanity/studio-secrets.
 *
 * Only the private key is stored as a secret (fetched at runtime behind
 * Sanity auth — never baked into the JS bundle). The other GCP config
 * values are non-sensitive and defined inline.
 */

import { type SettingsKey, SettingsView, useSecrets } from '@sanity/studio-secrets'

// ---------------------------------------------------------------------------
// Inline GCP config (non-sensitive)
// ---------------------------------------------------------------------------

const GCP_PROJECT_ID = 'image-transformation-489910'
const GCP_CLIENT_EMAIL = 'vertex-express@image-transformation-489910.iam.gserviceaccount.com'
const GCP_REGION = 'us-central1'

// ---------------------------------------------------------------------------
// Secret: private key only
// ---------------------------------------------------------------------------

export const GCP_SECRETS_NAMESPACE = 'imageProcessing'

export const GCP_SECRET_KEYS: SettingsKey[] = [
  {
    key: 'gcpPrivateKey',
    title: 'GCP Private Key (PEM)',
    description: 'Paste the full RSA private key including BEGIN/END lines.',
  },
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GcpSecrets {
  gcpPrivateKey?: string
}

export interface GcpConfig {
  projectId: string
  clientEmail: string
  privateKey: string
  region: string
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGcpSecrets(): {
  loading: boolean
  config: GcpConfig | null
} {
  const { loading, secrets } = useSecrets<GcpSecrets>(GCP_SECRETS_NAMESPACE)

  const config: GcpConfig | null = secrets?.gcpPrivateKey
    ? {
        projectId: GCP_PROJECT_ID,
        clientEmail: GCP_CLIENT_EMAIL,
        privateKey: secrets.gcpPrivateKey.replace(/\\n/g, '\n'),
        region: GCP_REGION,
      }
    : null

  return { loading, config }
}

export const SECRETS_NAMESPACE = GCP_SECRETS_NAMESPACE
export const SECRET_KEYS = GCP_SECRET_KEYS

export { SettingsView }
