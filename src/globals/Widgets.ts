import { GlobalConfig } from 'payload'

export const WidgetSettingsGlobal: GlobalConfig = {
  slug: 'widget-settings',
  label: 'Widgets',
  admin: {
    group: 'Settings',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/WidgetSettings/index.tsx#default',
          },
        },
      },
    },
  },
  access: {
    read: () => true,
    update: ({ req }) => req.user?.role === 'superadmin',
  },
  fields: [
    {
      name: 'tableOrderCustomerDetailsByBranch',
      label: 'Table Order Customer Details by Branch',
      type: 'array',
      admin: {
        description: 'Branch-wise control for showing customer details popup in table orders.',
      },
      fields: [
        {
          name: 'branch',
          type: 'relationship',
          relationTo: 'branches',
          required: true,
        },
        {
          name: 'showCustomerDetailsForTableOrders',
          label: 'Show Customer Details for Table Orders',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'allowSkipCustomerDetailsForTableOrders',
          label: 'Allow Skip in Customer Details Screen',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'showCustomerHistoryForTableOrders',
          label: 'Show Customer History Button',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'autoSubmitCustomerDetailsForTableOrders',
          label: 'Auto Submit',
          type: 'checkbox',
          defaultValue: true,
        },
      ],
    },
    {
      name: 'billingOrderCustomerDetailsByBranch',
      label: 'Billing Customer Details by Branch',
      type: 'array',
      admin: {
        description:
          'Branch-wise control for showing customer details popup in billing cart orders.',
      },
      fields: [
        {
          name: 'branch',
          type: 'relationship',
          relationTo: 'branches',
          required: true,
        },
        {
          name: 'showCustomerDetailsForBillingOrders',
          label: 'Show Customer Details for Billing Orders',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'allowSkipCustomerDetailsForBillingOrders',
          label: 'Allow Skip in Customer Details Screen',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'showCustomerHistoryForBillingOrders',
          label: 'Show Customer History Button',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'autoSubmitCustomerDetailsForBillingOrders',
          label: 'Auto Submit',
          type: 'checkbox',
          defaultValue: true,
        },
      ],
    },
    {
      name: 'favoriteProductsByBranchRules',
      label: 'Favorite Products by Branch Rules',
      type: 'array',
      admin: {
        description:
          'Configure multiple rules to map one or many branches to one or many favorite products.',
      },
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          label: 'Rule Enabled',
          defaultValue: true,
        },
        {
          name: 'ruleName',
          type: 'text',
          label: 'Rule Name',
          admin: {
            description: 'Optional label to identify this rule quickly in the widget.',
          },
        },
        {
          name: 'branches',
          type: 'relationship',
          relationTo: 'branches',
          hasMany: true,
          required: false,
          label: 'Branches',
        },
        {
          name: 'category',
          type: 'relationship',
          relationTo: 'categories',
          hasMany: true,
          required: false,
          label: 'Category Filter',
        },
        {
          name: 'products',
          type: 'relationship',
          relationTo: 'products',
          hasMany: true,
          required: true,
          label: 'Favorite Products',
        },
      ],
    },
    {
      name: 'favoriteCategoriesByBranchRules',
      label: 'Favorite Categories by Branch Rules',
      type: 'array',
      admin: {
        description:
          'Configure multiple rules to map one or many branches to one or many favorite categories.',
      },
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          label: 'Rule Enabled',
          defaultValue: true,
        },
        {
          name: 'ruleName',
          type: 'text',
          label: 'Rule Name',
          admin: {
            description: 'Optional label to identify this rule quickly in the widget.',
          },
        },
        {
          name: 'branches',
          type: 'relationship',
          relationTo: 'branches',
          hasMany: true,
          required: false,
          label: 'Branches',
        },
        {
          name: 'categories',
          type: 'relationship',
          relationTo: 'categories',
          hasMany: true,
          required: true,
          label: 'Favorite Categories',
        },
      ],
    },
    {
      name: 'tableQRDomains',
      label: 'Table QR Domains',
      type: 'array',
      admin: {
        description: 'Domain URLs used as the base for generating table QR links in the future.',
      },
      fields: [
        {
          name: 'domainURL',
          label: 'Domain URL',
          type: 'text',
          required: true,
        },
        {
          name: 'type',
          label: 'Type',
          type: 'select',
          options: [
            { label: 'Primary', value: 'primary' },
            { label: 'Secondary', value: 'secondary' },
          ],
          defaultValue: 'primary',
        },
        {
          name: 'enabled',
          label: 'Enabled',
          type: 'checkbox',
          defaultValue: true,
        },
      ],
    },
    {
      name: 'appAPIDomains',
      label: 'App LIVE API Domains',
      type: 'array',
      admin: {
        description:
          'Per-app API domains with primary/secondary priority. Mobile apps can fetch this to switch API base URL without a new release.',
      },
      fields: [
        {
          name: 'appKey',
          label: 'App',
          type: 'select',
          required: true,
          options: [{ label: 'Billing App', value: 'billing-app' }],
        },
        {
          name: 'domains',
          label: 'Domains',
          type: 'array',
          fields: [
            {
              name: 'domainURL',
              label: 'Domain URL',
              type: 'text',
              required: true,
            },
            {
              name: 'type',
              label: 'Type',
              type: 'select',
              options: [
                { label: 'Primary', value: 'primary' },
                { label: 'Secondary', value: 'secondary' },
              ],
              defaultValue: 'primary',
            },
            {
              name: 'enabled',
              label: 'Enabled',
              type: 'checkbox',
              defaultValue: true,
            },
          ],
        },
      ],
    },
    {
      name: 'skipDeliverByBranch',
      label: 'Skip Deliver by Branch',
      type: 'array',
      admin: {
        description: 'Branch-wise control for skipping deliver option/check before billing.',
      },
      fields: [
        {
          name: 'branch',
          type: 'relationship',
          relationTo: 'branches',
          required: true,
        },
        {
          name: 'skipDeliver',
          label: 'Skip Deliver',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'waiterSelectionType',
          label: 'Waiter Selection',
          type: 'select',
          options: [
            { label: 'All Waiters', value: 'all' },
            { label: 'Particular Waiters', value: 'particular' },
          ],
          defaultValue: 'all',
          required: true,
        },
        {
          name: 'waiters',
          label: 'Selected Waiters',
          type: 'relationship',
          relationTo: 'users',
          hasMany: true,
        },
      ],
    },
    {
      name: 'skipConfirmByBranch',
      label: 'Skip Confirm by Branch',
      type: 'array',
      admin: {
        description: 'Branch-wise control for skipping supervisor confirm check before billing.',
      },
      fields: [
        {
          name: 'branch',
          type: 'relationship',
          relationTo: 'branches',
          required: true,
        },
        {
          name: 'skipConfirm',
          label: 'Skip Confirm',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'waiterSelectionType',
          label: 'Waiter Selection',
          type: 'select',
          options: [
            { label: 'All Waiters', value: 'all' },
            { label: 'Particular Waiters', value: 'particular' },
          ],
          defaultValue: 'all',
          required: true,
        },
        {
          name: 'waiters',
          label: 'Selected Waiters',
          type: 'relationship',
          relationTo: 'users',
          hasMany: true,
        },
      ],
    },
    {
      name: 'categoryDelayByBranch',
      label: 'Category Delay by Branch',
      type: 'array',
      admin: {
        description: 'Branch-wise control for category delay time (minutes) before showing products.',
      },
      fields: [
        {
          name: 'branch',
          type: 'relationship',
          relationTo: 'branches',
          required: true,
        },
        {
          name: 'delayMinutes',
          label: 'Delay Minutes',
          type: 'number',
          required: true,
          min: 1,
          max: 60,
          defaultValue: 1,
        },
        {
          name: 'applyToBilling',
          label: 'Apply to Billing Orders',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'applyToTable',
          label: 'Apply to Table Orders',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'waiterSelectionType',
          label: 'Waiter Selection',
          type: 'select',
          options: [
            { label: 'All Waiters', value: 'all' },
            { label: 'Particular Waiters', value: 'particular' },
          ],
          defaultValue: 'all',
          required: true,
        },
        {
          name: 'waiters',
          label: 'Selected Waiters',
          type: 'relationship',
          relationTo: 'users',
          hasMany: true,
        },
      ],
    },
    {
      name: 'entireBillBlockingByBranch',
      label: 'Entire Bill Blocking by Branch',
      type: 'array',
      admin: {
        description: 'Branch-wise control to block billing if any table has undelivered items.',
      },
      fields: [
        {
          name: 'branch',
          type: 'relationship',
          relationTo: 'branches',
          required: true,
        },
        {
          name: 'enabled',
          label: 'Block Billing if Any Undelivered',
          type: 'checkbox',
          defaultValue: false,
        },
      ],
    },
  ],
}
