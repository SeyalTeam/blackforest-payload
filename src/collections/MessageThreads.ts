import type { CollectionConfig } from 'payload'

import {
  canAccessMessaging,
  isAdminMessagingUser,
  normalizeRelationshipID,
} from '../utilities/messaging'

const populateThreadParticipantFields = async ({ data, originalDoc, req, operation }: any) => {
  const staffUserID = normalizeRelationshipID(data?.staffUser ?? originalDoc?.staffUser)

  if (!staffUserID) {
    throw new Error('A staff user is required to create a message thread.')
  }

  const staffUser = await req.payload.findByID({
    collection: 'users',
    id: staffUserID,
    depth: 0,
    overrideAccess: true,
  })

  const employeeID = normalizeRelationshipID(staffUser?.employee)

  if (!employeeID) {
    throw new Error('Selected user must be linked to an employee before messaging can be used.')
  }

  if (operation === 'create') {
    const existingThread = await req.payload.find({
      collection: 'message-threads',
      where: {
        staffUser: {
          equals: staffUserID,
        },
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (existingThread.docs.length > 0) {
      throw new Error('This employee already has a message thread.')
    }
  }

  data.staffUser = staffUserID
  data.employee = employeeID
  data.participantName =
    (typeof staffUser?.name === 'string' && staffUser.name.trim().length > 0
      ? staffUser.name.trim()
      : typeof staffUser?.email === 'string' && staffUser.email.trim().length > 0
        ? staffUser.email.trim()
        : staffUserID)

  return data
}

export const MessageThreads: CollectionConfig = {
  slug: 'message-threads',
  admin: {
    useAsTitle: 'participantName',
    defaultColumns: ['participantName', 'staffUser', 'status', 'lastMessageAt', 'updatedAt'],
  },
  access: {
    create: ({ req }) => isAdminMessagingUser(req.user as any),
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
    update: ({ req }) => isAdminMessagingUser(req.user as any),
    delete: () => false,
  },
  hooks: {
    beforeChange: [populateThreadParticipantFields],
  },
  fields: [
    {
      name: 'participantName',
      type: 'text',
      required: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'staffUser',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      unique: true,
      index: true,
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
      name: 'status',
      type: 'select',
      options: [
        { label: 'Open', value: 'open' },
        { label: 'Archived', value: 'archived' },
      ],
      defaultValue: 'open',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'lastMessageAt',
      type: 'date',
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'lastMessageText',
      type: 'textarea',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'lastMessageByUser',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'lastMessageByRole',
      type: 'text',
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'adminLastReadAt',
      type: 'date',
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'staffLastReadAt',
      type: 'date',
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
  ],
  timestamps: true,
}
