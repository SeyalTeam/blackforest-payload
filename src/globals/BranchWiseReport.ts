import { GlobalConfig } from 'payload'

export const BranchWiseReportGlobal: GlobalConfig = {
  slug: 'branch-wise-report',
  label: 'Branch Wise', // Label in the sidebar
  admin: {
    group: 'Report', // Groups under "Report"
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/BranchWiseReport/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [], // No fields needed as it's a custom view
}
