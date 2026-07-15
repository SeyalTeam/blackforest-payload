import { GlobalConfig } from 'payload'

export const AccountsBillsReportGlobal: GlobalConfig = {
  slug: 'accounts-bills-report',
  label: 'All Bills Report',
  access: {
    read: () => true,
  },
  admin: {
    group: 'Account',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/AccountsBillsReport/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [],
}
