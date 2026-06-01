import { GlobalConfig } from 'payload'

export const TimeWiseReportGlobal: GlobalConfig = {
  slug: 'time-wise-report',
  label: 'Time-Wise Report',
  access: {
    read: () => true,
  },
  admin: {
    group: 'Report',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/TimeWiseReport/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [],
}
