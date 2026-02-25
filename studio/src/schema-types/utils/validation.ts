import type { ValidationContext } from 'sanity'

// Email validation regex
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Get current timestamp for date fields
export const getCurrentTimestamp = () => new Date().toISOString()

/**
 * Get a sibling field value from the validation context
 */
export const getSibling = (key: string | number, context: ValidationContext) => {
  const path = context.path ? (context.path.slice(0, -1) as Array<string | number>) : []
  const sibling = [...path, key].reduce(
    (acc: unknown, step: string | number | Record<'_key', string>) => {
      if (
        typeof step === 'string' &&
        typeof acc === 'object' &&
        acc !== null &&
        Object.hasOwn(acc, step)
      ) {
        return (acc as Record<string, unknown>)[step]
      } else if (typeof step === 'object' && Object.hasOwn(step, '_key') && Array.isArray(acc)) {
        return acc.find((i) => i._key === step._key)
      } else {
        // should never arrive here
        console.error('sanity-advanced-validators: Unreachable point reached!')
        return acc
      }
    },
    context.document
  )
  return sibling
}

/**
 * Require field if sibling does not equal operand(s)
 *
 * @example
 * validation: (rule) => rule.custom(requiredIfSiblingNeq('linkType', 'external', 'URL required for external links'))
 */
export const requiredIfSiblingNeq =
  (
    key: string,
    operand: string | number | null | Array<string | number | null>,
    message: string = 'Required if {key} does not equal {operand}.'
  ) =>
  (value: unknown | undefined, context: ValidationContext) => {
    const siblingValue = getSibling(key, context) as string | number | null
    const operands = Array.isArray(operand) ? operand : [operand]
    if (!value && !operands.includes(siblingValue)) {
      return message
        .replace('{key}', key)
        .replace('{operand}', operands.join(', or ') ?? 'null')
        .replace('{value}', operands.join(', or ') ?? 'null') // backward compatibility
        .replace('{siblingValue}', String(siblingValue ?? 'null'))
    }
    return true
  }

/**
 * Require field if sibling is empty/falsy
 *
 * @example
 * validation: (rule) => rule.custom(requiredIfSiblingFalsy('videoUrl', 'Image required if no video URL'))
 */
export const requiredIfSiblingFalsy =
  (key: string, message: string = 'Required if {key} is empty.') =>
  (value: unknown | undefined, context: ValidationContext) => {
    const siblingValue = getSibling(key, context)
    if (!value && !siblingValue) {
      return message.replace('{key}', key)
    }
    return true
  }
