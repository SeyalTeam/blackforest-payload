import { GlobalConfig } from 'payload'

export const AllReportGlobal: GlobalConfig = {
  slug: 'all-report',
  label: 'All Report',
  access: {
    read: () => true,
  },
  admin: {
    group: 'Report',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/AllReport/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [],
}
