import type { CollectionConfig } from 'payload'

import {
  canAccessMessaging,
  isAdminMessagingUser,
  isReceiptStatusForward,
  normalizeRelationshipID,
} from '../utilities/messaging'

const prepareReceiptForWrite = async ({ data, originalDoc, operation, req }: any) => {
  const nextAudience = data?.recipientAudience ?? originalDoc?.recipientAudience

  if (operation === 'create') {
    data.message = normalizeRelationshipID(data?.message)
    data.thread = normalizeRelationshipID(data?.thread)
    data.staffUser = normalizeRelationshipID(data?.staffUser)
    data.employee = normalizeRelationshipID(data?.employee)
    data.recipientUser =
      nextAudience === 'staff' ? normalizeRelationshipID(data?.recipientUser ?? data?.staffUser) : null
    data.sentAt =
      typeof data?.sentAt === 'string' && data.sentAt.length > 0
        ? data.sentAt
        : new Date().toISOString()

    return data
  }

  const user = req.user as any

  if (!canAccessMessaging(user)) {
    throw new Error('Unauthorized')
  }

  const currentStatus = originalDoc?.status
  const requestedStatus = data?.status ?? currentStatus

  if (!requestedStatus || !currentStatus) {
    throw new Error('Receipt status is invalid.')
  }

  if (!isReceiptStatusForward(currentStatus, requestedStatus)) {
    throw new Error('Receipt status cannot move backwards.')
  }

  if (originalDoc?.recipientAudience === 'staff') {
    if (user.id !== normalizeRelationshipID(originalDoc?.staffUser)) {
      throw new Error('Only the employee can update this receipt.')
    }
  } else if (!isAdminMessagingUser(user)) {
    throw new Error('Only admins can update this receipt.')
  }

  const now = new Date().toISOString()

  if (requestedStatus === 'delivered' || requestedStatus === 'read') {
    if (!originalDoc?.deliveredAt) {
      data.deliveredAt = now
    }

    if (!originalDoc?.deliveredByUser) {
      data.deliveredByUser = user.id
    }
  }

  if (requestedStatus === 'read') {
    if (!originalDoc?.readAt) {
      data.readAt = now
    }

    if (!originalDoc?.readByUser) {
      data.readByUser = user.id
    }
  }

  return data
}

const syncThreadReadCursor = async ({ doc, operation, previousDoc, req }: any) => {
  if (operation !== 'update') return doc
  if (doc?.status !== 'read') return doc
  if (previousDoc?.status === 'read') return doc

  const threadID = normalizeRelationshipID(doc.thread)
  const readAt =
    typeof doc?.readAt === 'string' && doc.readAt.length > 0 ? doc.readAt : new Date().toISOString()

  if (!threadID) return doc

  const thread = await req.payload.findByID({
    collection: 'message-threads',
    id: threadID,
    depth: 0,
    overrideAccess: true,
  })

  const currentCursor =
    doc.recipientAudience === 'staff' ? thread?.staffLastReadAt : thread?.adminLastReadAt

  if (typeof currentCursor === 'string' && currentCursor >= readAt) {
    return doc
  }

  await req.payload.update({
    collection: 'message-threads',
    id: threadID,
    data:
      doc.recipientAudience === 'staff'
        ? { staffLastReadAt: readAt }
        : { adminLastReadAt: readAt },
    overrideAccess: true,
  })

  return doc
}

export const MessageReceipts: CollectionConfig = {
  slug: 'message-receipts',
  admin: {
    useAsTitle: 'status',
    defaultColumns: ['message', 'recipientAudience', 'status', 'sentAt', 'deliveredAt', 'readAt'],
  },
  access: {
    create: () => false,
    read: ({ req }) => {
      const user = req.user as any

      if (!canAccessMessaging(user)) return false
      if (isAdminMessagingUser(user)) return true

      return {
        staffUser: {
          equals: user.id,
        },
      }
    },
    update: ({ req }) => {
      const user = req.user as any

      if (!canAccessMessaging(user)) return false

      if (isAdminMessagingUser(user)) {
        return {
          recipientAudience: {
            equals: 'admins',
          },
        } as any
      }

      return {
        and: [
          {
            staffUser: {
              equals: user.id,
            },
          },
          {
            recipientAudience: {
              equals: 'staff',
            },
          },
        ],
      } as any
    },
    delete: () => false,
  },
  hooks: {
    beforeChange: [prepareReceiptForWrite],
    afterChange: [syncThreadReadCursor],
  },
  fields: [
    {
      name: 'message',
      type: 'relationship',
      relationTo: 'messages',
      required: true,
      index: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'thread',
      type: 'relationship',
      relationTo: 'message-threads',
      required: true,
      index: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'staffUser',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'employee',
      type: 'relationship',
      relationTo: 'employees',
      required: true,
      index: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'recipientAudience',
      type: 'select',
      options: [
        { label: 'Admins', value: 'admins' },
        { label: 'Staff', value: 'staff' },
      ],
      required: true,
      index: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'recipientUser',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Sent', value: 'sent' },
        { label: 'Delivered', value: 'delivered' },
        { label: 'Read', value: 'read' },
      ],
      defaultValue: 'sent',
      required: true,
      index: true,
    },
    {
      name: 'sentAt',
      type: 'date',
      required: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'deliveredAt',
      type: 'date',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'readAt',
      type: 'date',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'deliveredByUser',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'readByUser',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        readOnly: true,
      },
    },
  ],
  timestamps: true,
}
