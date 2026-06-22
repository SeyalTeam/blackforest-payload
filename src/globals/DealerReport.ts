import { GlobalConfig } from 'payload'

export const DealerReportGlobal: GlobalConfig = {
  slug: 'dealer-report',
  label: 'Dealer Reports',
  access: {
    read: () => true,
  },
  admin: {
    group: 'Report',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/DealerReport/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [],
}
