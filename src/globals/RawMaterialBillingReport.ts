import { GlobalConfig } from 'payload'

export const RawMaterialBillingReportGlobal: GlobalConfig = {
  slug: 'raw-material-billing-report',
  label: 'Raw Material',
  access: {
    read: () => true,
  },
  admin: {
    group: 'Account',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/RawMaterialBillingReport/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [],
}
