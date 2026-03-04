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
          required: true,
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
  ],
}
