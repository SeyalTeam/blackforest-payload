import { GlobalConfig } from 'payload'

export const AutomateGlobal: GlobalConfig = {
  slug: 'automate-settings',
  label: 'Automate',
  admin: {
    group: 'Settings',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/AutomateSettings/index.tsx#default',
          },
        },
      },
    },
  },
  access: {
    read: () => true,
    update: ({ req }) => req.user?.role === 'superadmin',
  },
  fields: [],
}
