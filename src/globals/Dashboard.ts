import { GlobalConfig } from 'payload'

export const DashboardGlobal: GlobalConfig = {
  slug: 'general-dashboard',
  label: 'Overall',
  access: {
    read: () => true,
  },
  admin: {
    group: 'Report',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/Dashboard/index.tsx#default',
          },
        },
      },
      // Note: Custom Icon support might require a different approach or is not standard in this version for Globals
      // Removing 'graphics' to fix linter/build error.
    },
  },
  fields: [],
}
