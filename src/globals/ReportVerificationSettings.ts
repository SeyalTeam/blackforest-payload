import type { GlobalConfig } from 'payload'

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
      fields: [
        {
          name: 'requireAccountant',
          type: 'checkbox',
          label: 'Require Accountant / Office Admin Verification (Step 1)',
          defaultValue: true,
        },
        {
          name: 'requireWatcher',
          type: 'checkbox',
          label: 'Require Watcher Verification (Step 2)',
          defaultValue: true,
        },
        {
          name: 'requireManager',
          type: 'checkbox',
          label: 'Require Manager Verification (Step 3)',
          defaultValue: true,
        },
      ],
    },
    {
      name: 'closingEntry',
      type: 'group',
      label: 'Closing Entry Verification Rules',
      fields: [
        {
          name: 'requireAccountant',
          type: 'checkbox',
          label: 'Require Accountant / Office Admin Verification (Step 1)',
          defaultValue: true,
        },
        {
          name: 'requireWatcher',
          type: 'checkbox',
          label: 'Require Watcher Verification (Step 2)',
          defaultValue: true,
        },
        {
          name: 'requireManager',
          type: 'checkbox',
          label: 'Require Manager Verification (Step 3)',
          defaultValue: true,
        },
      ],
    },
    {
      name: 'stockOrder',
      type: 'group',
      label: 'Stock Order Verification Rules',
      fields: [
        {
          name: 'requireAccountant',
          type: 'checkbox',
          label: 'Require Accountant / Office Admin Verification (Step 1)',
          defaultValue: true,
        },
        {
          name: 'requireWatcher',
          type: 'checkbox',
          label: 'Require Watcher Verification (Step 2)',
          defaultValue: true,
        },
        {
          name: 'requireManager',
          type: 'checkbox',
          label: 'Require Manager Verification (Step 3)',
          defaultValue: true,
        },
      ],
    },
    {
      name: 'returnOrder',
      type: 'group',
      label: 'Return Order Verification Rules',
      fields: [
        {
          name: 'requireAccountant',
          type: 'checkbox',
          label: 'Require Accountant / Office Admin Verification (Step 1)',
          defaultValue: true,
        },
        {
          name: 'requireWatcher',
          type: 'checkbox',
          label: 'Require Watcher Verification (Step 2)',
          defaultValue: true,
        },
        {
          name: 'requireManager',
          type: 'checkbox',
          label: 'Require Manager Verification (Step 3)',
          defaultValue: true,
        },
      ],
    },
    {
      name: 'otherProducts',
      type: 'group',
      label: 'Other Products Report Verification Rules',
      fields: [
        {
          name: 'requireAccountant',
          type: 'checkbox',
          label: 'Require Accountant / Office Admin Verification (Step 1)',
          defaultValue: true,
        },
        {
          name: 'requireWatcher',
          type: 'checkbox',
          label: 'Require Watcher Verification (Step 2)',
          defaultValue: true,
        },
        {
          name: 'requireManager',
          type: 'checkbox',
          label: 'Require Manager Verification (Step 3)',
          defaultValue: true,
        },
      ],
    },
    {
      name: 'expense',
      type: 'group',
      label: 'Expense Report Verification Rules',
      fields: [
        {
          name: 'requireAccountant',
          type: 'checkbox',
          label: 'Require Accountant / Office Admin Verification (Step 1)',
          defaultValue: true,
        },
        {
          name: 'requireWatcher',
          type: 'checkbox',
          label: 'Require Watcher Verification (Step 2)',
          defaultValue: true,
        },
        {
          name: 'requireManager',
          type: 'checkbox',
          label: 'Require Manager Verification (Step 3)',
          defaultValue: true,
        },
      ],
    },
  ],
}
