import type { CollectionConfig } from 'payload'

export const ReportCardRules: CollectionConfig = {
  slug: 'report-card-rules',
  labels: {
    singular: 'Report Card Rule',
    plural: 'Report Card Rules',
  },
  admin: {
    group: 'Settings',
    useAsTitle: 'title',
    defaultColumns: ['title', 'roles', 'category', 'maxMarks', 'enabled', 'updatedAt'],
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data) return data
        if (Array.isArray(data.roles) && data.roles.length > 0) {
          data.role = data.roles[0]
        } else if (data.role && (!data.roles || data.roles.length === 0)) {
          data.roles = [data.role]
        }
        return data
      },
    ],
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) =>
      Boolean(user && ['superadmin', 'admin'].includes(user.role)),
    update: ({ req: { user } }) =>
      Boolean(user && ['superadmin', 'admin'].includes(user.role)),
    delete: ({ req: { user } }) =>
      Boolean(user && ['superadmin', 'admin'].includes(user.role)),
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Rule Name',
      admin: {
        description: 'Descriptive title for this performance rule (e.g. "KOT Timing SLA").',
      },
    },
    {
      name: 'enabled',
      type: 'checkbox',
      label: 'Rule Active (Switch Toggle On / Off)',
      defaultValue: true,
      admin: {
        description: 'Switch toggle ON to activate this rule in progress card calculations. Toggle OFF to disable.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'roles',
          type: 'select',
          hasMany: true,
          required: true,
          defaultValue: ['all'],
          label: 'Applicable Roles (Multi-Select)',
          admin: {
            width: '50%',
            description: 'Select one or more job roles this rule applies to.',
          },
          options: [
            { label: 'All Roles (General)', value: 'all' },
            { label: 'Waiter', value: 'waiter' },
            { label: 'Cashier', value: 'cashier' },
            { label: 'Chef', value: 'chef' },
            { label: 'Kitchen Staff', value: 'kitchen' },
            { label: 'Store Keeper', value: 'store_keeper' },
            { label: 'Branch Manager', value: 'manager' },
            { label: 'Supervisor', value: 'supervisor' },
            { label: 'Driver', value: 'driver' },
            { label: 'Delivery Staff', value: 'delivery' },
            { label: 'Watcher (CCTV)', value: 'watcher' },
            { label: 'Accountant', value: 'account' },
          ],
        },
        {
          name: 'role',
          type: 'select',
          admin: {
            hidden: true,
          },
          options: [
            { label: 'All Roles (General)', value: 'all' },
            { label: 'Waiter', value: 'waiter' },
            { label: 'Cashier', value: 'cashier' },
            { label: 'Chef', value: 'chef' },
            { label: 'Kitchen Staff', value: 'kitchen' },
            { label: 'Store Keeper', value: 'store_keeper' },
            { label: 'Branch Manager', value: 'manager' },
            { label: 'Supervisor', value: 'supervisor' },
            { label: 'Driver', value: 'driver' },
            { label: 'Delivery Staff', value: 'delivery' },
            { label: 'Watcher (CCTV)', value: 'watcher' },
            { label: 'Accountant', value: 'account' },
          ],
        },
        {
          name: 'category',
          type: 'select',
          required: true,
          defaultValue: 'call_speed',
          admin: {
            width: '50%',
            description: 'The functional pillar for evaluation.',
          },
          options: [
            { label: '⏱️ KOT Timing SLA (Prep / Deliver / Confirm)', value: 'kot_time' },
            { label: '🚨 Table Call Speed SLA', value: 'call_speed' },
            { label: '⏰ Attendance & Punctuality', value: 'attendance' },
            { label: '📋 Daily Task Checklist', value: 'tasks' },
            { label: '🍽️ Table Service & Billing Accuracy', value: 'billing' },
            { label: '⭐ Grooming, Hygiene & Cleanliness', value: 'hygiene' },
            { label: '💬 Customer Feedback & Reviews', value: 'reviews' },
            { label: 'ℹ️ General Guidelines & Policy', value: 'general' },
          ],
        },
      ],
    },
    {
      name: 'maxMarks',
      type: 'number',
      label: 'Max Marks (Out of 100)',
      defaultValue: 100,
      min: 0,
      max: 100,
      required: true,
      admin: {
        description: 'Maximum achievable score for this metric (e.g. 100).',
      },
    },
  ],
  timestamps: true,
}

export default ReportCardRules
