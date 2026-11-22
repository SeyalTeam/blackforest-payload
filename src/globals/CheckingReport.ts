import { GlobalConfig } from 'payload'

export const CheckingReportGlobal: GlobalConfig = {
  slug: 'checking-report',
  label: 'Checking',
  access: {
    read: () => true,
  },
  admin: {
    group: 'Report',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/CheckingReport/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [],
}

export default CheckingReportGlobal
