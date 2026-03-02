export const isDevMode = import.meta.env.DEV

/** Convert a string to a URL-friendly slug (ASCII, lowercase, hyphenated). */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/** Format a year range like "2020" or "2020–2024". */
export function formatYearRange(start?: number, end?: number | null): string {
  if (!start) return ''
  if (end && end !== start) return `${start}–${end}`
  return `${start}`
}

/** Format a project subtitle like "Lyon, 2020–2024". */
export function formatProjectSubtitle(
  location?: string,
  start?: number,
  end?: number | null
): string {
  const parts: string[] = []
  if (location) parts.push(location)
  const years = formatYearRange(start, end)
  if (years) parts.push(years)
  return parts.join(', ')
}
