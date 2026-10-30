import { GlobalConfig } from 'payload'

export const ReportsDashboardGlobal: GlobalConfig = {
  slug: 'dashboard',
  label: 'Dashboard',
  access: {
    read: () => true,
  },
  admin: {
    group: 'Report',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/ReportsDashboard/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [],
}
