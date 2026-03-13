type MessagingUser = {
  id?: string | null
  role?: string | null
  employee?: unknown | null
}

export type MessagingAudience = 'admins' | 'staff'
export type MessagingReceiptStatus = 'sent' | 'delivered' | 'read'

const ADMIN_MESSAGE_ROLES = new Set(['admin', 'superadmin'])

export const normalizeRelationshipID = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value
  }

  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' && id.trim().length > 0 ? id : null
  }

  return null
}

export const isAdminMessagingUser = (user: MessagingUser | null | undefined): boolean => {
  return Boolean(user?.role && ADMIN_MESSAGE_ROLES.has(user.role))
}

export const isStaffMessagingUser = (user: MessagingUser | null | undefined): boolean => {
  return Boolean(user?.id && !isAdminMessagingUser(user) && normalizeRelationshipID(user.employee))
}

export const canAccessMessaging = (user: MessagingUser | null | undefined): boolean => {
  return isAdminMessagingUser(user) || isStaffMessagingUser(user)
}

export const getMessagingAudienceForUser = (
  user: MessagingUser | null | undefined,
): MessagingAudience | null => {
  if (isAdminMessagingUser(user)) return 'admins'
  if (isStaffMessagingUser(user)) return 'staff'
  return null
}

export const getReceiptStatusRank = (status: MessagingReceiptStatus): number => {
  switch (status) {
    case 'sent':
      return 0
    case 'delivered':
      return 1
    case 'read':
      return 2
    default:
      return -1
  }
}

export const isReceiptStatusForward = (
  currentStatus: MessagingReceiptStatus,
  nextStatus: MessagingReceiptStatus,
): boolean => {
  return getReceiptStatusRank(nextStatus) >= getReceiptStatusRank(currentStatus)
}
