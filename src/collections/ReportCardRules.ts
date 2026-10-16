import type { CollectionConfig } from 'payload'

export const ReportCardRules: CollectionConfig = {
  slug: 'report-card-rules',
  labels: {
    singular: 'Report Card Rule & FAQ',
    plural: 'Report Card Rules & FAQs',
  },
  admin: {
    group: 'Settings',
    useAsTitle: 'title',
    defaultColumns: ['title', 'role', 'category', 'maxMarks', 'weightage', 'enabled', 'order', 'updatedAt'],
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
      label: 'Rule / FAQ Title',
      admin: {
        description: 'Descriptive title for this performance rule or FAQ topic (e.g. "Table Call Response Speed SLA").',
      },
    },
    {
      name: 'enabled',
      type: 'checkbox',
      label: 'Rule Active (Switch Toggle On / Off)',
      defaultValue: true,
      admin: {
        description: 'Switch toggle ON to activate this rule in progress card calculations and show in FAQ. Toggle OFF to disable.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'role',
          type: 'select',
          required: true,
          defaultValue: 'waiter',
          admin: {
            width: '50%',
            description: 'The job role this rule applies to.',
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
      type: 'row',
      fields: [
        {
          name: 'maxMarks',
          type: 'number',
          label: 'Max Marks (Out of 100)',
          defaultValue: 100,
          min: 0,
          max: 100,
          required: true,
          admin: {
            width: '34%',
            description: 'Maximum achievable score for this metric (standard: 100).',
          },
        },
        {
          name: 'weightage',
          type: 'number',
          label: 'Weightage in Total Score (%)',
          defaultValue: 20,
          min: 0,
          max: 100,
          admin: {
            width: '33%',
            description: 'Percentage contribution to overall score (e.g. 30%).',
          },
        },
        {
          name: 'order',
          type: 'number',
          label: 'Display Order / Priority',
          defaultValue: 1,
          admin: {
            width: '33%',
            description: 'Sort order in dashboard report cards and FAQ lists.',
          },
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Rule Details & Evaluation Criteria',
      admin: {
        initCollapsed: false,
      },
      fields: [
        {
          name: 'ruleDetails',
          type: 'textarea',
          required: true,
          label: 'Rule Specification & Criteria',
          admin: {
            description: 'Detailed explanation of the rule, SLA standards, and how marks are calculated.',
          },
        },
        {
          name: 'deductionRules',
          type: 'textarea',
          label: 'Deductions & Penalties',
          admin: {
            description: 'Points deducted for delays, misses, order errors, or late punch-ins.',
          },
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'FAQ Details (Staff View)',
      admin: {
        initCollapsed: false,
      },
      fields: [
        {
          name: 'faqQuestion',
          type: 'text',
          label: 'FAQ Question',
          admin: {
            description: 'The question shown to employees in their progress card modal (e.g. "How is my Table Call Response score calculated?").',
          },
        },
        {
          name: 'faqAnswer',
          type: 'textarea',
          label: 'FAQ Answer & Tips',
          admin: {
            description: 'Helpful guidance and explanation for employees to understand and improve their score.',
          },
        },
      ],
    },
  ],
  timestamps: true,
}

export default ReportCardRules
