import type { CollectionAfterReadHook, CollectionConfig } from 'payload'

import {
  canAccessMessaging,
  isAdminMessagingUser,
  normalizeRelationshipID,
} from '../utilities/messaging'

const MESSAGE_ATTACHMENT_STORAGE_PREFIX = 'blackforest/uploads/messages'

const resolveAttachmentTypeFromMimeType = (mimeType: unknown): 'image' | 'video' | null => {
  const normalized = typeof mimeType === 'string' ? mimeType.toLowerCase() : ''

  if (normalized.startsWith('image/')) return 'image'
  if (normalized.startsWith('video/')) return 'video'

  return null
}

const prepareAttachmentForCreate = async ({ data, operation, req }: any) => {
  if (operation !== 'create') {
    return data
  }

  const user = req.user as any

  if (!canAccessMessaging(user)) {
    throw new Error('Unauthorized')
  }

  const threadID = normalizeRelationshipID(data?.thread)

  if (!threadID) {
    throw new Error('A message thread is required for attachments.')
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
    throw new Error('You can only upload attachments in your own conversation.')
  }

  const attachmentType = resolveAttachmentTypeFromMimeType(req?.file?.mimetype)

  if (!attachmentType) {
    throw new Error('Only image and video attachments are allowed.')
  }

  data.thread = threadID
  data.staffUser = staffUserID
  data.employee = employeeID
  data.uploadedBy = user.id
  data.attachmentType = attachmentType

  return data
}

const addPublicURL: CollectionAfterReadHook = ({ doc }) => {
  const publicURL = process.env.NEXT_PUBLIC_S3_PUBLIC_URL || process.env.S3_PUBLIC_URL

  if (!publicURL || !doc?.filename) {
    return doc
  }

  const cleanURL = publicURL.endsWith('/') ? publicURL.slice(0, -1) : publicURL
  const cleanPrefix = MESSAGE_ATTACHMENT_STORAGE_PREFIX.replace(/^\/+|\/+$/g, '')
  const cleanFilename = doc.filename.replace(/^\/+/, '')
  const key = cleanFilename.startsWith(`${cleanPrefix}/`)
    ? cleanFilename
    : `${cleanPrefix}/${cleanFilename}`

  doc.url = `${cleanURL}/${key}`.replace(/([^:]\/)\/+/g, '$1')

  return doc
}

export const MessageAttachments: CollectionConfig = {
  slug: 'message-attachments',
  admin: {
    useAsTitle: 'filename',
    defaultColumns: ['thread', 'attachmentType', 'uploadedBy', 'createdAt'],
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
    beforeChange: [prepareAttachmentForCreate],
    afterRead: [addPublicURL],
  },
  fields: [
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
      name: 'uploadedBy',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'attachmentType',
      type: 'select',
      options: [
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
      name: 'alt',
      type: 'text',
      required: false,
      admin: {
        description: 'Optional accessibility text for images.',
      },
    },
  ],
  upload: {
    staticDir: 'uploads',
    mimeTypes: ['image/*', 'video/*'],
  },
  timestamps: true,
}
