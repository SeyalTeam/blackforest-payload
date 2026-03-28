import { GlobalConfig } from 'payload'

export const ReviewReportGlobal: GlobalConfig = {
  slug: 'review-report',
  label: 'Review Report',
  access: {
    read: () => true,
  },
  admin: {
    group: 'Report',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/ReviewReport/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [],
}
