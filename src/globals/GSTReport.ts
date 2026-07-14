import { GlobalConfig } from 'payload'

export const GSTReportGlobal: GlobalConfig = {
  slug: 'gst-report',
  label: 'GST Report',
  access: {
    read: () => true,
  },
  admin: {
    group: 'Account',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/GSTReport/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [],
}
