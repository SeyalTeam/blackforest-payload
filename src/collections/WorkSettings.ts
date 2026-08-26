import type { CollectionConfig } from 'payload'

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

const WorkSettings: CollectionConfig = {
  slug: 'work-settings',
  admin: {
    useAsTitle: 'role',
    group: 'Settings',
    description: 'Configure role-based working hours and days. Used to determine Full Day vs Half Day attendance.',
    defaultColumns: ['role', 'trackHours', 'requiredHours', 'workDays'],
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) =>
      user?.role === 'superadmin' || user?.role === 'admin',
    update: ({ req: { user } }) =>
      user?.role === 'superadmin' || user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'superadmin',
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      options: ALL_ROLES,
      required: true,
      unique: true,
      admin: {
        description: 'The role this setting applies to. Each role can have only one work setting.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'trackHours',
          type: 'checkbox',
          label: 'Track Working Hours',
          defaultValue: false,
          admin: {
            description: 'Enable to set a minimum required hours per day for this role.',
            width: '30%',
          },
        },
        {
          name: 'requiredHours',
          type: 'number',
          label: 'Required Hours Per Day',
          min: 0.5,
          max: 24,
          admin: {
            description: 'Minimum hours needed to count as Full Day. Below this = Half Day.',
            condition: (data) => !!data?.trackHours,
            width: '70%',
          },
        },
      ],
    },
    {
      name: 'workDays',
      type: 'select',
      hasMany: true,
      options: WORK_DAYS,
      admin: {
        description: 'Select which days this role is expected to work.',
      },
    },
  ],
}

export default WorkSettings
