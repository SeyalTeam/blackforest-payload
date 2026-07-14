import { GlobalConfig } from 'payload'

export const RawMaterialBillingReportGlobal: GlobalConfig = {
  slug: 'raw-material-billing-report',
  label: 'Raw Material Billing Reports',
  access: {
    read: () => true,
  },
  admin: {
    group: 'Report',
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
