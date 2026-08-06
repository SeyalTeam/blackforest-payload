import { GlobalConfig } from 'payload'

export const BankStatementUploadGlobal: GlobalConfig = {
  slug: 'bank-statement-upload',
  label: 'Bank Statement Upload',
  access: {
    read: () => true,
    update: () => true,
  },
  admin: {
    group: 'Account',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/BankStatementUpload/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [],
}
