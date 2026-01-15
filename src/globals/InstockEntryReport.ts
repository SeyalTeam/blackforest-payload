import { GlobalConfig } from 'payload'

export const InstockEntryReportGlobal: GlobalConfig = {
  slug: 'instock-entry-report',
  label: 'Instock Entry Report',
  access: {
    read: () => true,
  },
  admin: {
    group: 'Report',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/InstockEntryReport/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [],
}
