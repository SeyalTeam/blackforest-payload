import { GlobalConfig } from 'payload'

export const WorkGPSGlobal: GlobalConfig = {
  slug: 'work-gps',
  label: 'GPS',
  access: {
    read: () => true,
  },
  admin: {
    group: 'Work',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/BranchGPSView/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [],
}

export default WorkGPSGlobal
