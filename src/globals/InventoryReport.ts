import { GlobalConfig } from 'payload'

export const InventoryReportGlobal: GlobalConfig = {
  slug: 'inventory-report',
  label: 'Inventory Report',
  admin: {
    group: 'Report',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/InventoryReport/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [],
}
