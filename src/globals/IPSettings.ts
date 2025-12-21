import { GlobalConfig } from 'payload'

export const IPSettings: GlobalConfig = {
  slug: 'ip-settings',
  admin: {
    group: 'Settings',
  },
  access: {
    read: ({ req }) => ['superadmin', 'admin'].includes(req.user?.role || ''),
    update: ({ req }) => req.user?.role === 'superadmin',
  },
  fields: [
    {
      name: 'roleRestrictions',
      type: 'array',
      labels: {
        singular: 'Role Restriction',
        plural: 'Role Restrictions',
      },
      fields: [
        {
          name: 'role',
          type: 'select',
          options: [
            { label: 'Chef', value: 'chef' },
            { label: 'Driver', value: 'driver' },
            { label: 'Supervisor', value: 'supervisor' },
            { label: 'Waiter', value: 'waiter' },
            { label: 'Cashier', value: 'cashier' },
            { label: 'Delivery', value: 'delivery' },
            { label: 'Branch', value: 'branch' },
            { label: 'Kitchen', value: 'kitchen' },
          ],
          required: true,
        },
        {
          name: 'ipRanges',
          type: 'array',
          label: 'Allowed IP Addresses / Ranges',
          required: true,
          fields: [
            {
              name: 'ipOrRange',
              type: 'text',
              label: 'IP or Range',
              admin: {
                description: 'e.g., 192.168.2.1 or 192.168.2.1-192.168.2.250. Use * for any IP.',
              },
              required: true,
            },
          ],
        },
      ],
    },
  ],
}
