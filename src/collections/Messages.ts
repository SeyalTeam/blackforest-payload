import type { CollectionConfig } from 'payload'

import {
  canAccessMessaging,
  getMessagingAudienceForUser,
  isAdminMessagingUser,
  normalizeRelationshipID,
} from '../utilities/messaging'

type MessageType = 'text' | 'image' | 'video'

const resolveAttachmentMessageType = (attachment: any): MessageType | null => {
  if (attachment?.attachmentType === 'image' || attachment?.attachmentType === 'video') {
    return attachment.attachmentType
  }

  const mimeType = typeof attachment?.mimeType === 'string' ? attachment.mimeType.toLowerCase() : ''

  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'

  return null
}

const getThreadPreviewText = (doc: any): string => {
  const trimmedText = typeof doc?.text === 'string' ? doc.text.trim() : ''

  if (trimmedText) {
    return trimmedText
  }

  if (doc?.messageType === 'image') {
    return 'Image'
  }

  if (doc?.messageType === 'video') {
    return 'Video'
  }

  return 'Message'
}

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
  const attachmentID = normalizeRelationshipID(data?.attachment)
  let messageType: MessageType = 'text'

  if (attachmentID) {
    const attachment = await req.payload.findByID({
      collection: 'message-attachments',
      id: attachmentID,
      depth: 0,
      overrideAccess: true,
    })

    if (!attachment) {
      throw new Error('Attachment not found.')
    }

    if (normalizeRelationshipID(attachment.thread) !== threadID) {
      throw new Error('Attachment does not belong to this conversation.')
    }

    if (
      normalizeRelationshipID(attachment.staffUser) !== staffUserID ||
      normalizeRelationshipID(attachment.employee) !== employeeID
    ) {
      throw new Error('Attachment participant mismatch.')
    }

    const attachmentType = resolveAttachmentMessageType(attachment)

    if (!attachmentType) {
      throw new Error('Only image and video attachments are supported.')
    }

    messageType = attachmentType
  }

  if (!trimmedText && !attachmentID) {
    throw new Error('Message must include text, an image, or a video.')
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
  data.messageType = messageType
  data.attachment = attachmentID || null
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
      lastMessageText: getThreadPreviewText(doc),
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
    useAsTitle: 'messageType',
    defaultColumns: ['thread', 'seq', 'senderUser', 'senderRole', 'messageType', 'createdAt'],
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
      name: 'messageType',
      type: 'select',
      options: [
        { label: 'Text', value: 'text' },
        { label: 'Image', value: 'image' },
        { label: 'Video', value: 'video' },
      ],
      required: true,
      index: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'attachment',
      type: 'relationship',
      relationTo: 'message-attachments',
      index: true,
      admin: {
        description: 'Attach an uploaded image or video for this message.',
      },
    },
    {
      name: 'text',
      type: 'textarea',
      required: false,
      admin: {
        description: 'Optional text or caption. Required when no attachment is provided.',
      },
    },
  ],
  timestamps: true,
}
