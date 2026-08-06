import { GlobalConfig } from 'payload'

export const BillSummaryGlobal: GlobalConfig = {
  slug: 'bill-summary',
  label: 'Bill Summary',
  access: {
    read: () => true,
  },
  admin: {
    group: 'Account',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/BillSummary/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [],
}
