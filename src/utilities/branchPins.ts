export const BRANCH_PIN_HEADER = 'x-branch-pin'

const BRANCH_PIN_REGEX = /^\d{4}$/

export const BRANCH_PIN_REQUIRED_ROLES = new Set(['branch', 'waiter', 'cashier'])

export const normalizeBranchPin = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

export const isValidBranchPin = (value: unknown): value is string => {
  if (typeof value !== 'string') return false
  return BRANCH_PIN_REGEX.test(value)
}
