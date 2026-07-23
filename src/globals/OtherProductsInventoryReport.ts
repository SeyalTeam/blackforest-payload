import { GlobalConfig } from 'payload'

export const OtherProductsInventoryReportGlobal: GlobalConfig = {
  slug: 'other-products-inventory-report',
  label: 'Other Products Inventory',
  access: {
    read: () => true,
  },
  admin: {
    group: 'Account',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/OtherProductsInventoryReport/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [],
}
