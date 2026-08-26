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

const WORK_DAYS = [
  { label: 'Monday', value: 'monday' },
  { label: 'Tuesday', value: 'tuesday' },
  { label: 'Wednesday', value: 'wednesday' },
  { label: 'Thursday', value: 'thursday' },
  { label: 'Friday', value: 'friday' },
  { label: 'Saturday', value: 'saturday' },
  { label: 'Sunday', value: 'sunday' },
]

export const WorkSettingsGlobal: GlobalConfig = {
  slug: 'work-settings',
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
      name: 'roleSettings',
      type: 'array',
      label: 'Role Based Work Settings',
      admin: {
        description: 'Add a row for each role you want to track. Roles on the left, check Days or Hours to track them.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'role',
              type: 'select',
              options: ALL_ROLES,
              required: true,
              admin: { width: '20%' },
            },
            {
              name: 'trackDays',
              type: 'checkbox',
              label: 'Days',
              defaultValue: false,
              admin: { width: '15%' },
            },
            {
              name: 'workDays',
              type: 'select',
              hasMany: true,
              options: WORK_DAYS,
              admin: {
                condition: (_, siblingData) => !!siblingData?.trackDays,
                width: '25%',
              },
            },
            {
              name: 'trackHours',
              type: 'checkbox',
              label: 'Hours',
              defaultValue: false,
              admin: { width: '15%' },
            },
            {
              name: 'requiredHours',
              type: 'number',
              label: 'Hours Count',
              min: 0.5,
              max: 24,
              admin: {
                condition: (_, siblingData) => !!siblingData?.trackHours,
                width: '25%',
              },
            },
          ],
        },
      ],
    },
  ],
}
