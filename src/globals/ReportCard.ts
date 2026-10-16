import { GlobalConfig } from 'payload'

export const ReportCardGlobal: GlobalConfig = {
  slug: 'report-card',
  label: 'Report Card',
  access: {
    read: () => true,
  },
  admin: {
    group: 'Report',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/ReportCard/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [],
}

export default ReportCardGlobal
