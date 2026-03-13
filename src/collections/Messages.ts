import type { CollectionConfig } from 'payload'

import {
  canAccessMessaging,
  getMessagingAudienceForUser,
  isAdminMessagingUser,
  normalizeRelationshipID,
} from '../utilities/messaging'

const prepareMessageForCreate = async ({ data, req }: any) => {
  const user = req.user as any

  if (!canAccessMessaging(user)) {
    throw new Error('Unauthorized')
  }

  const threadID = normalizeRelationshipID(data?.thread)

  if (!threadID) {
    throw new Error('A message thread is required.')
  }

  const thread = await req.payload.findByID({
    collection: 'message-threads',
    id: threadID,
    depth: 0,
    overrideAccess: true,
  })

  if (!thread) {
    throw new Error('Message thread not found.')
  }

  if (thread.status !== 'open') {
    throw new Error('This conversation is archived.')
  }

  const staffUserID = normalizeRelationshipID(thread.staffUser)
  const employeeID = normalizeRelationshipID(thread.employee)

  if (!staffUserID || !employeeID) {
    throw new Error('Message thread is missing participant links.')
  }

  if (!isAdminMessagingUser(user) && user.id !== staffUserID) {
    throw new Error('You can only send messages in your own conversation.')
  }

  const trimmedText = typeof data?.text === 'string' ? data.text.trim() : ''

  if (!trimmedText) {
    throw new Error('Message text cannot be empty.')
  }

  const latestMessage = await req.payload.find({
    collection: 'messages',
    where: {
      thread: {
        equals: threadID,
      },
    },
    sort: '-seq',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  data.thread = threadID
  data.staffUser = staffUserID
  data.employee = employeeID
  data.seq = latestMessage.docs.length > 0 ? Number(latestMessage.docs[0]?.seq || 0) + 1 : 1
  data.senderUser = user.id
  data.senderRole = user.role
  data.recipientAudience = getMessagingAudienceForUser(user) === 'admins' ? 'staff' : 'admins'
  data.text = trimmedText

  return data
}

const createInitialReceiptAndUpdateThread = async ({ doc, operation, req }: any) => {
  if (operation !== 'create') return doc

  const createdAt =
    typeof doc?.createdAt === 'string' && doc.createdAt.length > 0
      ? doc.createdAt
      : new Date().toISOString()

  const threadUpdate =
    doc.recipientAudience === 'staff'
      ? { adminLastReadAt: createdAt }
      : { staffLastReadAt: createdAt }

  await req.payload.update({
    collection: 'message-threads',
    id: normalizeRelationshipID(doc.thread) as string,
    data: {
      lastMessageAt: createdAt,
      lastMessageText: doc.text,
      lastMessageByUser: normalizeRelationshipID(doc.senderUser),
      lastMessageByRole: doc.senderRole,
      ...threadUpdate,
    },
    overrideAccess: true,
  })

  await req.payload.create({
    collection: 'message-receipts',
    data: {
      message: normalizeRelationshipID(doc.id),
      thread: normalizeRelationshipID(doc.thread),
      staffUser: normalizeRelationshipID(doc.staffUser),
      employee: normalizeRelationshipID(doc.employee),
      recipientAudience: doc.recipientAudience,
      recipientUser:
        doc.recipientAudience === 'staff' ? normalizeRelationshipID(doc.staffUser) : undefined,
      status: 'sent',
      sentAt: createdAt,
    },
    overrideAccess: true,
  })

  return doc
}

export const Messages: CollectionConfig = {
  slug: 'messages',
  admin: {
    useAsTitle: 'text',
    defaultColumns: ['thread', 'seq', 'senderUser', 'senderRole', 'createdAt'],
  },
  access: {
    create: ({ req }) => canAccessMessaging(req.user as any),
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
    update: () => false,
    delete: () => false,
  },
  hooks: {
    beforeChange: [prepareMessageForCreate],
    afterChange: [createInitialReceiptAndUpdateThread],
  },
  fields: [
    {
      name: 'thread',
      type: 'relationship',
      relationTo: 'message-threads',
      required: true,
      index: true,
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
      name: 'seq',
      type: 'number',
      required: true,
      index: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'senderUser',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'senderRole',
      type: 'text',
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
      name: 'text',
      type: 'textarea',
      required: true,
    },
  ],
  timestamps: true,
}
