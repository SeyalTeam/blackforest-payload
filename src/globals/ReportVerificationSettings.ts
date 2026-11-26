import type { GlobalConfig } from 'payload'

const ruleFields = [
  {
    name: 'effectiveFrom',
    type: 'date' as const,
    label: 'Effective From Date',
    required: false,
  },
  {
    name: 'flowType',
    type: 'select' as const,
    label: 'Verification Flow',
    options: [
      { label: 'Sequential Order (Step 1 → Step 2 → Step 3)', value: 'sequential' },
      { label: 'Any Order / Parallel (எந்த வரிசையிலும்)', value: 'any' },
    ],
    defaultValue: 'sequential',
  },
  {
    name: 'requireManager',
    type: 'checkbox' as const,
    label: 'Require Manager Verification (Step 1)',
    defaultValue: true,
  },
  {
    name: 'requireAccountant',
    type: 'checkbox' as const,
    label: 'Require Accountant / Office Admin Verification (Step 2)',
    defaultValue: true,
  },
  {
    name: 'requireWatcher',
    type: 'checkbox' as const,
    label: 'Require Watcher Verification (Step 3)',
    defaultValue: true,
  },
]

export const ReportVerificationSettings: GlobalConfig = {
  slug: 'report-verification-settings',
  label: 'Report Verification Settings',
  admin: {
    group: 'Settings',
  },
  access: {
    read: () => true,
    update: ({ req }) => {
      if (!req.user) return false
      return ['superadmin', 'admin'].includes(req.user.role)
    },
  },
  fields: [
    {
      name: 'rawMaterial',
      type: 'group',
      label: 'Raw Material Report Verification Rules',
      fields: ruleFields,
    },
    {
      name: 'closingEntry',
      type: 'group',
      label: 'Closing Entry Verification Rules',
      fields: ruleFields,
    },
    {
      name: 'stockOrder',
      type: 'group',
      label: 'Stock Order Verification Rules',
      fields: ruleFields,
    },
    {
      name: 'returnOrder',
      type: 'group',
      label: 'Return Order Verification Rules',
      fields: ruleFields,
    },
    {
      name: 'otherProducts',
      type: 'group',
      label: 'Other Products Report Verification Rules',
      fields: ruleFields,
    },
    {
      name: 'expense',
      type: 'group',
      label: 'Expense Report Verification Rules',
      fields: ruleFields,
    },
  ],
}
