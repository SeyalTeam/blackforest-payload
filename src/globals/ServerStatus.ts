import { GlobalConfig } from 'payload'

export const ServerStatusGlobal: GlobalConfig = {
  slug: 'server-status',
  label: 'Server Monitoring',
  admin: {
    group: 'Settings',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/ServerStatus/index.tsx#default',
          },
        },
      },
    },
  },
  access: {
    read: ({ req }) => ['superadmin', 'admin'].includes(req.user?.role || ''),
    update: ({ req }) => req.user?.role === 'superadmin',
  },
  fields: [],
}
