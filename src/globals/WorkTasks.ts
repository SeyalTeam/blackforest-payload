import { GlobalConfig } from 'payload'

export const WorkTasksGlobal: GlobalConfig = {
  slug: 'work-tasks',
  label: 'Work Board',
  access: {
    read: () => true,
  },
  admin: {
    group: 'Work',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/WorkTasksBoard/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [],
}

export default WorkTasksGlobal
