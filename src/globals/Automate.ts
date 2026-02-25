import { GlobalConfig } from 'payload'

export const AutomateGlobal: GlobalConfig = {
  slug: 'widget-settings',
  label: 'Widgets',
  admin: {
    group: 'Settings',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/AutomateSettings/index.tsx#default',
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
        description:
          'Branch-wise control for showing customer details popup in table orders.',
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
      ],
    },
  ],
}
