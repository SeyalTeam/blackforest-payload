import type { CollectionConfig } from 'payload'

const IdempotencyKeys: CollectionConfig = {
  slug: 'idempotency-keys',
  admin: {
    useAsTitle: 'key',
    defaultColumns: ['key', 'scope', 'status', 'requestMethod', 'requestPath', 'updatedAt'],
  },
  access: {
    read: ({ req: { user } }) => Boolean(user?.role && ['superadmin', 'admin'].includes(user.role)),
    create: ({ req: { user } }) => Boolean(user?.role && ['superadmin', 'admin'].includes(user.role)),
    update: ({ req: { user } }) => Boolean(user?.role && ['superadmin', 'admin'].includes(user.role)),
    delete: ({ req: { user } }) => Boolean(user?.role === 'superadmin'),
  },
  indexes: [
    {
      fields: ['key', 'scope'],
      unique: true,
    },
    {
      fields: ['status', 'updatedAt'],
    },
    {
      fields: ['expiresAt'],
    },
  ],
  fields: [
    {
      name: 'key',
      type: 'text',
      required: true,
      index: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'scope',
      type: 'text',
      required: true,
      index: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'requestHash',
      type: 'text',
      required: true,
      index: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'processing',
      options: [
        { label: 'Processing', value: 'processing' },
        { label: 'Completed', value: 'completed' },
        { label: 'Failed', value: 'failed' },
      ],
      index: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'requestMethod',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'requestPath',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'requestId',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'userId',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'responseStatus',
      type: 'number',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'responsePayload',
      type: 'json',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'completedAt',
      type: 'date',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'expiresAt',
      type: 'date',
      index: true,
      admin: {
        readOnly: true,
      },
    },
  ],
}

export default IdempotencyKeys
