import type { GlobalConfig } from 'payload'

export const LiveBillReportGlobal: GlobalConfig = {
  slug: 'live-bill-report',
  label: 'Live Bill Report',
  access: {
    read: () => true,
  },
  admin: {
    group: 'Report',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/LiveBillReport/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [],
}
