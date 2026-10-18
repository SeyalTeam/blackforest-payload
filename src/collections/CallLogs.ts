import { CollectionConfig } from 'payload'

const CallLogs: CollectionConfig = {
  slug: 'call-logs',
  admin: {
    useAsTitle: 'callId',
    defaultColumns: ['callId', 'callerName', 'receiverName', 'status', 'durationSeconds', 'createdAt'],
  },
  access: {
    create: () => true,
    read: () => true,
    update: () => true,
    delete: ({ req: { user } }) => user?.role === 'superadmin' || user?.role === 'admin',
  },
  fields: [
    {
      name: 'callId',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Unique call session identifier.',
      },
    },
    {
      name: 'callerUser',
      type: 'relationship',
      relationTo: 'users',
      required: false,
      admin: {
        description: 'User who initiated the call.',
      },
    },
    {
      name: 'callerUserId',
      type: 'text',
      index: true,
      admin: {
        description: 'Raw string ID of the caller.',
      },
    },
    {
      name: 'callerName',
      type: 'text',
      admin: {
        description: 'Display name of caller.',
      },
    },
    {
      name: 'callerRole',
      type: 'text',
      admin: {
        description: 'Role of caller (e.g. superadmin, admin, waiter).',
      },
    },
    {
      name: 'callerPhone',
      type: 'text',
    },
    {
      name: 'receiverUser',
      type: 'relationship',
      relationTo: 'users',
      required: false,
      admin: {
        description: 'User who received the call.',
      },
    },
    {
      name: 'receiverUserId',
      type: 'text',
      index: true,
      admin: {
        description: 'Raw string ID of the receiver.',
      },
    },
    {
      name: 'receiverName',
      type: 'text',
      admin: {
        description: 'Display name of receiver.',
      },
    },
    {
      name: 'receiverRole',
      type: 'text',
      admin: {
        description: 'Role of receiver.',
      },
    },
    {
      name: 'receiverPhone',
      type: 'text',
    },
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
      required: false,
      admin: {
        description: 'Branch associated with this call if applicable.',
      },
    },
    {
      name: 'callType',
      type: 'select',
      options: [
        { label: 'Voice Call', value: 'voice' },
        { label: 'Video Call', value: 'video' },
      ],
      defaultValue: 'voice',
    },
    {
      name: 'direction',
      type: 'select',
      options: [
        { label: 'Outgoing', value: 'outgoing' },
        { label: 'Incoming', value: 'incoming' },
      ],
      defaultValue: 'outgoing',
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Connected', value: 'connected' },
        { label: 'Missed', value: 'missed' },
        { label: 'Declined', value: 'declined' },
        { label: 'Busy', value: 'busy' },
        { label: 'Offline', value: 'offline' },
        { label: 'Ended', value: 'ended' },
      ],
      defaultValue: 'missed',
      required: true,
    },
    {
      name: 'durationSeconds',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Duration of call in seconds.',
      },
    },
    {
      name: 'startedAt',
      type: 'text',
      admin: {
        description: 'ISO timestamp when call was started.',
      },
    },
    {
      name: 'endedAt',
      type: 'text',
      admin: {
        description: 'ISO timestamp when call ended.',
      },
    },
  ],
  timestamps: true,
}

export default CallLogs
