import { GlobalConfig } from 'payload'

export const RawMaterialInventoryReportGlobal: GlobalConfig = {
  slug: 'raw-material-inventory-report',
  label: 'Raw Material Inventory',
  admin: {
    group: 'Account',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/RawMaterialInventoryReport/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [],
}
