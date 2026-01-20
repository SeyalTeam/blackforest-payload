import { GlobalConfig } from 'payload'

export const ExpenseReportGlobal: GlobalConfig = {
  slug: 'expense-report',
  label: 'Expense Reports',
  access: {
    read: () => true,
  },
  admin: {
    group: 'Report',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/ExpenseReport/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [],
}
