import type { GlobalConfig } from 'payload'

export const DatabaseSyncSettings: GlobalConfig = {
  slug: 'database-sync-settings',
  label: 'Database Sync Settings',
  admin: {
    group: 'Settings',
    description: 'Sync selected collections from DB 2 into DB 1 at a scheduled time or on demand.',
  },
  access: {
    read: () => true,
    update: ({ req }) => req.user?.role === 'superadmin' || !req.user?.role, // allow superadmin or dev
  },
  fields: [
    {
      type: 'ui',
      name: 'syncActions',
      admin: {
        components: {
          Field: '/components/DatabaseSyncActions/index.tsx#DatabaseSyncActions',
        },
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          label: 'Enable Automated Daily Sync',
          defaultValue: false,
          admin: {
            width: '50%',
          },
        },
        {
          name: 'syncTime',
          type: 'text',
          label: 'Daily Sync Time (IST - 24hr format HH:mm)',
          defaultValue: '03:00',
          admin: {
            placeholder: '03:00',
            width: '50%',
            description: 'Example: 03:00 for 3:00 AM, 04:00 for 4:00 AM, 23:00 for 11:00 PM',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'sourceDbUri',
          type: 'text',
          label: 'Source Database URL (DB 2 - Pull From)',
          required: false,
          admin: {
            placeholder: 'mongodb+srv://user:pass@cluster.mongodb.net/source_db',
            description: 'The MongoDB connection string of DB 2',
          },
        },
        {
          name: 'targetDbUri',
          type: 'text',
          label: 'Target Database URL (DB 1 - Push To)',
          required: false,
          admin: {
            placeholder: 'mongodb+srv://user:pass@cluster.mongodb.net/target_db (leave blank to use current project DB)',
            description: 'Leave blank to automatically use current project database',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'syncMode',
          type: 'select',
          label: 'Sync Strategy / Duplicate Handling',
          defaultValue: 'insert_only',
          options: [
            {
              label: 'Only New Records (Skip existing - Do NOT overwrite already synced data)',
              value: 'insert_only',
            },
            {
              label: 'Upsert (Insert new and update modified records)',
              value: 'upsert',
            },
          ],
          admin: {
            width: '50%',
            description: 'Determines whether already synced records should be skipped or updated',
          },
        },
        {
          name: 'syncMedia',
          type: 'checkbox',
          label: 'Sync Associated Images & Media',
          defaultValue: true,
          admin: {
            width: '50%',
            description: 'Ensures uploaded raw material images and attachments are preserved in DB1',
          },
        },
      ],
    },
    {
      name: 'collections',
      type: 'select',
      hasMany: true,
      label: 'Select Collections to Sync',
      required: false,
      options: [
        { label: 'Raw Materials (raw-materials)', value: 'raw-materials' },
        { label: 'Raw Material Categories (raw-material-categories)', value: 'raw-material-categories' },
        { label: 'Raw Material Dealers (raw-material-dealers)', value: 'raw-material-dealers' },
        { label: 'Raw Material Billings (raw-material-billings)', value: 'raw-material-billings' },
        { label: 'Raw Material Instock Entries (raw-material-instock-entries)', value: 'raw-material-instock-entries' },
        { label: 'Products (products)', value: 'products' },
        { label: 'Categories (categories)', value: 'categories' },
        { label: 'Dealers (dealers)', value: 'dealers' },
        { label: 'Dealer Billings (dealer-billings)', value: 'dealer-billings' },
        { label: 'Dealer Orders (dealer-orders)', value: 'dealer-orders' },
        { label: 'Customers (customers)', value: 'customers' },
        { label: 'Billing Customers (billing-customers)', value: 'billing-customers' },
        { label: 'Billings (billings)', value: 'billings' },
        { label: 'Branches (branches)', value: 'branches' },
        { label: 'Companies (companies)', value: 'companies' },
        { label: 'Departments (departments)', value: 'departments' },
        { label: 'Employees (employees)', value: 'employees' },
        { label: 'Users (users)', value: 'users' },
        { label: 'Stock Orders (stock-orders)', value: 'stock-orders' },
        { label: 'Stock Alerts (stock-alerts)', value: 'stock-alerts' },
        { label: 'Instock Entries (instock-entries)', value: 'instock-entries' },
        { label: 'Cakes (cakes)', value: 'cakes' },
        { label: 'Tables (tables)', value: 'tables' },
        { label: 'Kitchens (kitchens)', value: 'kitchens' },
        { label: 'Attendance (attendance)', value: 'attendance' },
        { label: 'Punch In (punch-in)', value: 'punch-in' },
        { label: 'Expenses (expenses)', value: 'expenses' },
        { label: 'Closing Entries (closing-entries)', value: 'closing-entries' },
        { label: 'Return Order (return-order)', value: 'return-order' },
        { label: 'Reviews (reviews)', value: 'reviews' },
        { label: 'Media / Uploads (media)', value: 'media' },
      ],
      admin: {
        description: 'Choose which collections should be copied from DB 2 to DB 1.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'lastSyncAt',
          type: 'date',
          label: 'Last Synced At',
          admin: {
            readOnly: true,
            width: '50%',
          },
        },
        {
          name: 'lastSyncStatus',
          type: 'select',
          label: 'Last Sync Status',
          defaultValue: 'idle',
          options: [
            { label: 'Idle / Waiting', value: 'idle' },
            { label: 'In Progress', value: 'in_progress' },
            { label: 'Success', value: 'success' },
            { label: 'Failed', value: 'failed' },
          ],
          admin: {
            readOnly: true,
            width: '50%',
          },
        },
      ],
    },
    {
      name: 'lastSyncLog',
      type: 'textarea',
      label: 'Last Sync Activity / Summary Log',
      admin: {
        readOnly: true,
        rows: 6,
        description: 'Detailed report of the last sync run (records inserted, skipped, or failed)',
      },
    },
  ],
}
