import type { AdminViewServerProps } from 'payload'

import { HydrateAuthProvider, SetStepNav } from '@payloadcms/ui'
import { Fragment } from 'react'
import AdminCollectionsGrid, { CollectionGroup, CollectionItem } from './AdminCollectionsGrid'

const GROUP_ORDER = [
  'Organization & Branches',
  'Products & Menu',
  'Sales & Billings',
  'Inventory & Logistics',
  'Raw Materials & Procurement',
  'Staff & HR',
  'Tasks & Kitchen Work',
  'Finance & Accounting',
  'Settings & System',
]

const GROUP_THEMES: Record<string, { color: string; accentColor: string; bgLight: string }> = {
  'Organization & Branches': { color: '#1a73e8', accentColor: '#174ea6', bgLight: '#e8f0fe' },
  'Products & Menu': { color: '#ea8600', accentColor: '#b06000', bgLight: '#fef7e0' },
  'Sales & Billings': { color: '#1e8e3e', accentColor: '#137333', bgLight: '#e6f4ea' },
  'Inventory & Logistics': { color: '#12b5cb', accentColor: '#007b83', bgLight: '#e4f7fb' },
  'Raw Materials & Procurement': { color: '#9334e6', accentColor: '#681da8', bgLight: '#f3e8fd' },
  'Staff & HR': { color: '#0284c7', accentColor: '#0369a1', bgLight: '#f0f9ff' },
  'Tasks & Kitchen Work': { color: '#d93025', accentColor: '#a50e0e', bgLight: '#fce8e6' },
  'Finance & Accounting': { color: '#0d904f', accentColor: '#096a39', bgLight: '#e6f4ea' },
  'Settings & System': { color: '#5f6368', accentColor: '#3c4043', bgLight: '#f1f3f4' },
}

const DEFAULT_THEME = { color: '#1a73e8', accentColor: '#174ea6', bgLight: '#e8f0fe' }

const FALLBACK_GROUP_MAPPING: Record<string, string> = {
  // Organization
  companies: 'Organization & Branches',
  branches: 'Organization & Branches',
  departments: 'Organization & Branches',
  tables: 'Organization & Branches',
  kitchens: 'Organization & Branches',

  // Products
  products: 'Products & Menu',
  categories: 'Products & Menu',
  cakes: 'Products & Menu',
  media: 'Products & Menu',

  // Sales & Billings
  billings: 'Sales & Billings',
  'billing-customers': 'Sales & Billings',
  customers: 'Sales & Billings',
  'closing-entries': 'Sales & Billings',
  'manager-closing-replies': 'Sales & Billings',

  // Inventory & Logistics
  'stock-orders': 'Inventory & Logistics',
  'stock-alerts': 'Inventory & Logistics',
  'instock-entries': 'Inventory & Logistics',
  'return-orders': 'Inventory & Logistics',
  'return-order': 'Inventory & Logistics',

  // Raw Materials
  'raw-materials': 'Raw Materials & Procurement',
  'raw-material-categories': 'Raw Materials & Procurement',
  'raw-material-dealers': 'Raw Materials & Procurement',
  'raw-material-billings': 'Raw Materials & Procurement',
  'raw-material-instock-entries': 'Raw Materials & Procurement',
  dealers: 'Raw Materials & Procurement',
  'dealer-billings': 'Raw Materials & Procurement',
  'dealer-orders': 'Raw Materials & Procurement',

  // Staff & HR
  users: 'Staff & HR',
  employees: 'Staff & HR',
  attendance: 'Staff & HR',
  'punch-in': 'Staff & HR',
  'waiter-calls': 'Staff & HR',
  'call-logs': 'Staff & HR',
  'cctv-reports': 'Staff & HR',
  reviews: 'Staff & HR',

  // Tasks & Messages
  tasks: 'Tasks & Kitchen Work',
  'task-columns': 'Tasks & Kitchen Work',
  'task-completions': 'Tasks & Kitchen Work',
  messages: 'Tasks & Kitchen Work',
  'message-threads': 'Tasks & Kitchen Work',
  'message-attachments': 'Tasks & Kitchen Work',
  'message-receipts': 'Tasks & Kitchen Work',
  'production-requests': 'Tasks & Kitchen Work',

  // Finance & Settings
  expenses: 'Finance & Accounting',
  'bank-statements': 'Finance & Accounting',
  'apk-files': 'Settings & System',
  'report-card-rules': 'Settings & System',
  'idempotency-keys': 'Settings & System',
}

const AdminCollectionsDashboard = (props: AdminViewServerProps) => {
  const {
    permissions,
    req: {
      i18n,
      payload: { config },
    },
    visibleEntities,
  } = props.initPageResult

  const collections = config.collections.filter(
    (collection) =>
      Array.isArray(visibleEntities?.collections) &&
      visibleEntities.collections.includes(collection.slug) &&
      collection.admin?.hidden !== true,
  )

  // Organize collections into distinct, beautiful groups
  const groupsMap = new Map<string, CollectionItem[]>()

  collections.forEach((collection) => {
    let groupName = ''
    if (typeof collection.admin?.group === 'string' && collection.admin.group.trim()) {
      groupName = collection.admin.group.trim()
    } else if (
      typeof collection.admin?.group === 'object' &&
      collection.admin.group &&
      'en' in collection.admin.group
    ) {
      groupName = (collection.admin.group as any).en
    }

    if (!groupName || groupName === 'Ungrouped' || groupName === 'General') {
      groupName = FALLBACK_GROUP_MAPPING[collection.slug] || 'Other Collections'
    }

    const canCreate = (permissions?.collections?.[collection.slug]?.create as any)?.permission ?? true

    const rawPlural = typeof collection.labels?.plural === 'function'
      ? collection.labels.plural({ i18n, t: i18n.t })
      : collection.labels?.plural || collection.slug
    const resolvedLabel = typeof rawPlural === 'string' ? rawPlural : (rawPlural as any)?.en || collection.slug

    const entity: CollectionItem = {
      label: resolvedLabel,
      slug: collection.slug,
      canCreate: canCreate,
      group: groupName,
    }

    if (!groupsMap.has(groupName)) {
      groupsMap.set(groupName, [])
    }
    groupsMap.get(groupName)!.push(entity)
  })

  // Sort groups in logical business flow order
  const sortedGroupKeys = Array.from(groupsMap.keys()).sort((a, b) => {
    const idxA = GROUP_ORDER.indexOf(a)
    const idxB = GROUP_ORDER.indexOf(b)
    if (idxA !== -1 && idxB !== -1) return idxA - idxB
    if (idxA !== -1) return -1
    if (idxB !== -1) return 1
    return a.localeCompare(b)
  })

  const collectionGroups: CollectionGroup[] = sortedGroupKeys.map((groupKey) => {
    const theme = GROUP_THEMES[groupKey] || DEFAULT_THEME
    return {
      label: groupKey,
      color: theme.color,
      accentColor: theme.accentColor,
      bgLight: theme.bgLight,
      entities: groupsMap.get(groupKey) || [],
    }
  })

  const adminRoute = config?.routes?.admin || '/admin'

  return (
    <Fragment>
      <HydrateAuthProvider permissions={permissions} />
      <SetStepNav nav={[{ label: 'Collections' }]} />
      <AdminCollectionsGrid groups={collectionGroups} adminRoute={adminRoute} />
    </Fragment>
  )
}

export default AdminCollectionsDashboard
