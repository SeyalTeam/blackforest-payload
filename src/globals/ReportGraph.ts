import { GlobalConfig } from 'payload'

export const ReportGraphGlobal: GlobalConfig = {
  slug: 'report-graph',
  label: 'Report Graph',
  access: {
    read: () => true,
  },
  admin: {
    group: 'Report',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/ReportGraph/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [],
}
