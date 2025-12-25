import { GlobalConfig } from 'payload'

export const CategoryWiseReportGlobal: GlobalConfig = {
  slug: 'category-wise-report',
  label: 'Category Wise', // Label in the sidebar
  admin: {
    group: 'Report', // Groups under "Report"
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/CategoryWiseReport/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [],
}
