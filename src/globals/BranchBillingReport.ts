import { GlobalConfig } from 'payload'

export const BranchBillingReportGlobal: GlobalConfig = {
  slug: 'branch-billing-report',
  label: 'Billing Reports',
  access: {
    read: () => true,
  },
  admin: {
    group: 'Report',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/BranchBillingReport/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [],
} // No fields needed as it's a custom view
