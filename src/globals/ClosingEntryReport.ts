import { GlobalConfig } from 'payload'

export const ClosingEntryReportGlobal: GlobalConfig = {
  slug: 'closing-entry-report',
  label: 'Closing Report', // Label in the sidebar
  admin: {
    group: 'Report', // Groups under "Report"
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/ClosingEntryReport/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [], // No fields needed as it's a custom view
}
