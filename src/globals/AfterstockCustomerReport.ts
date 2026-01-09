import { GlobalConfig } from 'payload'

export const AfterstockCustomerReportGlobal: GlobalConfig = {
  slug: 'afterstock-customer-report',
  label: 'Customer Report',
  admin: {
    group: 'Report',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/AfterstockCustomerReport/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [],
}
