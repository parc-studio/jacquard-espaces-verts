import { atom } from 'nanostores'

/** Tracks whether the console credits have already been logged this session. */
export const $credited = atom(false)
