import { GlobalConfig } from 'payload'

export const ChefReportGlobal: GlobalConfig = {
  slug: 'chef-report',
  label: 'Chef Report',
  access: {
    read: () => true,
  },
  admin: {
    group: 'Report',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/ChefReport/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [],
}
