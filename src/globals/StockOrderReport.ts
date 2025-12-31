import { GlobalConfig } from 'payload'

export const StockOrderReportGlobal: GlobalConfig = {
  slug: 'stock-order-report',
  label: 'Stock Order Report',
  access: {
    read: () => true,
  },
  admin: {
    group: 'Report',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/StockOrderReport/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [],
}
