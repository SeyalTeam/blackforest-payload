import { GlobalConfig } from 'payload'

export const NetworkStatus: GlobalConfig = {
  slug: 'network-status',
  label: 'Branch Connectivity',
  admin: {
    group: 'Settings',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/NetworkStatus/index.tsx#default',
          },
        },
      },
    },
  },
  access: {
    read: () => true,
  },
  fields: [],
}
