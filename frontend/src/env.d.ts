/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare module 'sanity:client' {
  import type { SanityClient } from '@sanity/client'
  export const sanityClient: SanityClient
}
