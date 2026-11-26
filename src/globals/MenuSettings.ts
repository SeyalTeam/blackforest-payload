import { GlobalConfig } from 'payload'

export const MenuSettingsGlobal: GlobalConfig = {
  slug: 'menu-settings',
  label: 'Menu Settings',
  admin: {
    group: 'Settings',
  },
  access: {
    read: () => true,
    update: ({ req }) => req.user?.role === 'superadmin',
  },
  fields: [
    {
      name: 'roleMenus',
      type: 'array',
      label: 'Role Menu Configuration',
      labels: {
        singular: 'Role Configuration',
        plural: 'Role Configurations',
      },
      fields: [
        {
          name: 'role',
          type: 'select',
          required: true,
          options: [
            { label: 'Admin', value: 'admin' },
            { label: 'Manager', value: 'manager' },
            { label: 'Account', value: 'account' },
            { label: 'Delivery', value: 'delivery' },
            { label: 'Branch', value: 'branch' },
            { label: 'Company', value: 'company' },
            { label: 'Factory', value: 'factory' },
            { label: 'Kitchen', value: 'kitchen' },
            { label: 'Chef', value: 'chef' },
            { label: 'Cashier', value: 'cashier' },
            { label: 'Waiter', value: 'waiter' },
            { label: 'Supervisor', value: 'supervisor' },
            { label: 'Driver', value: 'driver' },
            { label: 'Store Keeper', value: 'store_keeper' },
          ],
        },
        {
          name: 'visibleCollections',
          type: 'select',
          hasMany: true,
          label: 'Visible Collections',
          options: [
            { label: 'APK Files', value: 'apk-files' },
            { label: 'Attendance', value: 'attendance' },
            { label: 'Bank Statements', value: 'bank-statements' },
            { label: 'Billing Customers', value: 'billing-customers' },
            { label: 'Billings', value: 'billings' },
            { label: 'Branches', value: 'branches' },
            { label: 'Cakes', value: 'cakes' },
            { label: 'Call Logs', value: 'call-logs' },
            { label: 'Categories', value: 'categories' },
            { label: 'CCTV Reports', value: 'cctv-reports' },
            { label: 'Closing Entries', value: 'closing-entries' },
            { label: 'Companies', value: 'companies' },
            { label: 'Customers', value: 'customers' },
            { label: 'Dealer Billings', value: 'dealer-billings' },
            { label: 'Dealer Orders', value: 'dealer-orders' },
            { label: 'Dealers', value: 'dealers' },
            { label: 'Departments', value: 'departments' },
            { label: 'Employees', value: 'employees' },
            { label: 'Expenses', value: 'expenses' },
            { label: 'Idempotency Keys', value: 'idempotency-keys' },
            { label: 'Instock Entries', value: 'instock-entries' },
            { label: 'Kitchens', value: 'kitchens' },
            { label: 'Manager Closing Replies', value: 'manager-closing-replies' },
            { label: 'Media', value: 'media' },
            { label: 'Message Attachments', value: 'message-attachments' },
            { label: 'Message Receipts', value: 'message-receipts' },
            { label: 'Message Threads', value: 'message-threads' },
            { label: 'Messages', value: 'messages' },
            { label: 'Production Requests', value: 'production-requests' },
            { label: 'Products', value: 'products' },
            { label: 'Punch In', value: 'punch-in' },
            { label: 'Raw Material Billings', value: 'raw-material-billings' },
            { label: 'Raw Material Categories', value: 'raw-material-categories' },
            { label: 'Raw Material Dealers', value: 'raw-material-dealers' },
            { label: 'Raw Material In Stock Entries', value: 'raw-material-instock-entries' },
            { label: 'Raw Materials', value: 'raw-materials' },
            { label: 'Report Card Rules', value: 'report-card-rules' },
            { label: 'Return Order', value: 'return-order' },
            { label: 'Reviews', value: 'reviews' },
            { label: 'Stock Alerts', value: 'stock-alerts' },
            { label: 'Stock Orders', value: 'stock-orders' },
            { label: 'Tables', value: 'tables' },
            { label: 'Task Columns', value: 'task-columns' },
            { label: 'Task Completions', value: 'task-completions' },
            { label: 'Task Photo Audits', value: 'task-photo-audits' },
            { label: 'Tasks', value: 'tasks' },
            { label: 'Users', value: 'users' },
            { label: 'Waiter Calls', value: 'waiter-calls' },
          ],
        },
        {
          name: 'visibleGlobals',
          type: 'select',
          hasMany: true,
          label: 'Visible Globals',
          options: [
            { label: 'Afterstock Customer Report', value: 'afterstock-customer-report' },
            { label: 'All Bills Report', value: 'accounts-bills-report' },
            { label: 'All Report', value: 'all-report' },
            { label: 'App Download Settings', value: 'app-download-settings' },
            { label: 'App Version Settings', value: 'app-version-settings' },
            { label: 'Attendance Report', value: 'attendance-report' },
            { label: 'Bank Statement Upload', value: 'bank-statement-upload' },
            { label: 'Bill Summary', value: 'bill-summary' },
            { label: 'Branch Billing Report', value: 'branch-billing-report' },
            { label: 'Branch Geo Settings', value: 'branch-geo-settings' },
            { label: 'Category Wise Report', value: 'category-wise-report' },
            { label: 'Chef Report', value: 'chef-report' },
            { label: 'Chef Settings', value: 'chef-settings' },
            { label: 'Checking Report', value: 'checking-report' },
            { label: 'Closing Entry Report', value: 'closing-entry-report' },
            { label: 'Customer Offer Settings', value: 'customer-offer-settings' },
            { label: 'Database Sync Settings', value: 'database-sync-settings' },
            { label: 'Dealer Report', value: 'dealer-report' },
            { label: 'Expense Report', value: 'expense-report' },
            { label: 'GST Report', value: 'gst-report' },
            { label: 'Instock Entry Report', value: 'instock-entry-report' },
            { label: 'Inventory Report', value: 'inventory-report' },
            { label: 'IP Settings', value: 'ip-settings' },
            { label: 'Jarvis', value: 'jarvis' },
            { label: 'KOT Time', value: 'kot-time' },
            { label: 'Menu Settings', value: 'menu-settings' },
            { label: 'Message Chat', value: 'messages-chat' },
            { label: 'Network Status', value: 'network-status' },
            { label: 'Other Products Inventory', value: 'other-products-inventory-report' },
            { label: 'Overall (Dashboard)', value: 'general-dashboard' },
            { label: 'Payment Settings', value: 'payment-settings' },
            { label: 'Product Time Report', value: 'product-time-report' },
            { label: 'Product Wise Report', value: 'product-wise-report' },
            { label: 'Raw Material Billing Report', value: 'raw-material-billing-report' },
            { label: 'Raw Material Inventory', value: 'raw-material-inventory-report' },
            { label: 'Report Card', value: 'report-card' },
            { label: 'Report Graph', value: 'report-graph' },
            { label: 'Report Verification Settings', value: 'report-verification-settings' },
            { label: 'Return Order Report', value: 'return-order-report' },
            { label: 'Review Report', value: 'review-report' },
            { label: 'Stock Order Report', value: 'stock-order-report' },
            { label: 'Time Wise Report', value: 'time-wise-report' },
            { label: 'Waiter Wise Billing Report', value: 'waiter-wise-billing-report' },
            { label: 'Widget Settings', value: 'widget-settings' },
            { label: 'Work Board', value: 'work-tasks' },
            { label: 'Work GPS', value: 'work-gps' },
            { label: 'Work Settings', value: 'work-settings' },
          ],
        },
      ],
    },
  ],
}

/**
 * Dynamically ensures any registered Collection or Global in Payload config
 * is available in MenuSettings options, so newly added collections/globals
 * are automatically selectable without modifying MenuSettingsGlobal manually.
 */
export function syncMenuSettingsOptions(
  collections: { slug: string; labels?: { singular?: string }; admin?: { useAsTitle?: string } }[],
  globals: { slug: string; label?: string }[]
) {
  const roleMenusField = MenuSettingsGlobal.fields?.find(
    (f) => 'name' in f && f.name === 'roleMenus'
  ) as any
  if (!roleMenusField || !Array.isArray(roleMenusField.fields)) return

  const collectionsField = roleMenusField.fields.find(
    (f: any) => f.name === 'visibleCollections'
  )
  const globalsField = roleMenusField.fields.find(
    (f: any) => f.name === 'visibleGlobals'
  )

  const toLabel = (slug: string) =>
    slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')

  if (collectionsField) {
    const map = new Map<string, string>()
    for (const opt of collectionsField.options || []) {
      const val = typeof opt === 'string' ? opt : opt.value
      const lbl = typeof opt === 'string' ? toLabel(opt) : opt.label
      map.set(val, lbl)
    }
    for (const col of collections) {
      if (!map.has(col.slug)) {
        const lbl =
          (typeof col.labels?.singular === 'string' ? col.labels.singular : '') ||
          toLabel(col.slug)
        map.set(col.slug, lbl)
      }
    }
    collectionsField.options = Array.from(map.entries())
      .map(([value, label]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }

  if (globalsField) {
    const map = new Map<string, string>()
    for (const opt of globalsField.options || []) {
      const val = typeof opt === 'string' ? opt : opt.value
      const lbl = typeof opt === 'string' ? toLabel(opt) : opt.label
      map.set(val, lbl)
    }
    for (const glob of globals) {
      if (!map.has(glob.slug)) {
        const lbl =
          (typeof glob.label === 'string' ? glob.label : '') ||
          toLabel(glob.slug)
        map.set(glob.slug, lbl)
      }
    }
    globalsField.options = Array.from(map.entries())
      .map(([value, label]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }
}
