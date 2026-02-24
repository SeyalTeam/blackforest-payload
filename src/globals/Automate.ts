import { GlobalConfig } from 'payload'

export const AutomateGlobal: GlobalConfig = {
  slug: 'automate-settings',
  label: 'Automate',
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
      ],
    },
  ],
}
