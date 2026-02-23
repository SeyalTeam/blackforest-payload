import { GlobalConfig } from 'payload'

export const ReturnOrderReportGlobal: GlobalConfig = {
  slug: 'return-order-report',
  label: 'Return Order Report',
  access: {
    read: () => true,
  },
  admin: {
    group: 'Report',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/ReturnOrderReport/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [],
}
