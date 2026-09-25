import type { GlobalConfig } from 'payload'

const ALL_ROLES = [
  { label: 'Superadmin', value: 'superadmin' },
  { label: 'Admin', value: 'admin' },
  { label: 'Manager', value: 'manager' },
  { label: 'Account', value: 'account' },
  { label: 'Delivery', value: 'delivery' },
  { label: 'Branch', value: 'branch' },
  { label: 'Company', value: 'company' },
  { label: 'Factory', value: 'factory' },
  { label: 'Kitchen', value: 'kitchen' },
  { label: 'Chef', value: 'chef' },
  { label: 'Cashier', value: 'cashier' },
  { label: 'Waiter', value: 'waiter' },
  { label: 'Supervisor', value: 'supervisor' },
  { label: 'Driver', value: 'driver' },
  { label: 'Store Keeper', value: 'store_keeper' },
]

export const AppWorkingHours: GlobalConfig = {
  slug: 'app-working-hours',
  admin: {
    group: 'Settings',
  },
  access: {
    read: () => true,
    update: ({ req: { user } }) =>
      user?.role === 'superadmin' || user?.role === 'admin',
  },
  fields: [
    {
      name: 'trackerApp',
      type: 'group',
      label: 'Tracker App Working Hours',
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          type: 'row',
          fields: [
            {
              name: 'loginTime',
              type: 'text',
              label: 'Login Time (HH:mm)',
              admin: { width: '50%' },
            },
            {
              name: 'logoutTime',
              type: 'text',
              label: 'Logout Time (HH:mm)',
              admin: { width: '50%' },
            },
          ],
        },
        {
          name: 'roles',
          type: 'select',
          hasMany: true,
          options: ALL_ROLES,
          label: 'Apply to Roles (Leave empty for all)',
        }
      ]
    },
    {
      name: 'billingApp',
      type: 'group',
      label: 'Billing App Working Hours',
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          type: 'row',
          fields: [
            {
              name: 'loginTime',
              type: 'text',
              label: 'Login Time (HH:mm)',
              admin: { width: '50%' },
            },
            {
              name: 'logoutTime',
              type: 'text',
              label: 'Logout Time (HH:mm)',
              admin: { width: '50%' },
            },
          ],
        },
        {
          name: 'roles',
          type: 'select',
          hasMany: true,
          options: ALL_ROLES,
          label: 'Apply to Roles (Leave empty for all)',
        }
      ]
    },
    {
      name: 'branchApp',
      type: 'group',
      label: 'Branch App Working Hours',
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          type: 'row',
          fields: [
            {
              name: 'loginTime',
              type: 'text',
              label: 'Login Time (HH:mm)',
              admin: { width: '50%' },
            },
            {
              name: 'logoutTime',
              type: 'text',
              label: 'Logout Time (HH:mm)',
              admin: { width: '50%' },
            },
          ],
        },
        {
          name: 'roles',
          type: 'select',
          hasMany: true,
          options: ALL_ROLES,
          label: 'Apply to Roles (Leave empty for all)',
        }
      ]
    }
  ],
}
