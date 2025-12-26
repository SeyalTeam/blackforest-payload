import { GlobalConfig } from 'payload'

export const ProductWiseReportGlobal: GlobalConfig = {
  slug: 'product-wise-report',
  label: 'Product Wise', // Label in the sidebar
  admin: {
    group: 'Report', // Groups under "Report"
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/ProductWiseReport/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [],
}
