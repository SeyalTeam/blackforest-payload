import { GlobalConfig } from 'payload'

export const ProductTimeReportGlobal: GlobalConfig = {
  slug: 'product-time-report',
  label: 'Product Time',
  access: {
    read: () => true,
  },
  admin: {
    group: 'Report',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/ProductTimeReport/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [],
}
