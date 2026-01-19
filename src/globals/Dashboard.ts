import { GlobalConfig } from 'payload'

export const DashboardGlobal: GlobalConfig = {
  slug: 'general-dashboard',
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
            Component: '/components/Dashboard/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [],
}
