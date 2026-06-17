import { GlobalConfig } from 'payload'

export const JarvisGlobal: GlobalConfig = {
  slug: 'jarvis',
  label: 'JARVIS',
  access: {
    read: () => true,
  },
  admin: {
    group: 'Report',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/Jarvis/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [],
}
