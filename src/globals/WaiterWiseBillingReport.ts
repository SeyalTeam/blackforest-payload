import { GlobalConfig } from 'payload'

export const WaiterWiseBillingReportGlobal: GlobalConfig = {
  slug: 'waiter-wise-billing-report',
  label: 'Waiter Wise', // Label in the sidebar
  admin: {
    group: 'Report', // Groups under "Report"
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/WaiterWiseBillingReport/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [],
}
