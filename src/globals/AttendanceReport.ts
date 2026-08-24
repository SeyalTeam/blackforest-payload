import { GlobalConfig } from 'payload'

export const AttendanceReportGlobal: GlobalConfig = {
  slug: 'attendance-report',
  label: 'Attendance Report',
  access: {
    read: () => true,
  },
  admin: {
    group: 'Report',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/AttendanceReport/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [],
}
