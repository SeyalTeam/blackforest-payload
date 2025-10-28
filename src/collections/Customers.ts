// src/collections/Customers.ts
import { CollectionConfig } from 'payload'
import type { Where } from 'payload' // Import Where type

const Customers: CollectionConfig = {
  slug: 'customers',
  admin: {
    useAsTitle: 'name',
  },
  access: {
    read: ({ req: { user } }) => {
      if (user?.role === 'superadmin') return true

      if (user?.role === 'company') {
        const company = user.company
        if (!company) return false
        let companyId: string
        if (typeof company === 'string') {
          companyId = company
        } else if (
          typeof company === 'object' &&
          company !== null &&
          'id' in company &&
          typeof company.id === 'string'
        ) {
          companyId = company.id
        } else {
          return false
        }
        return { company: { equals: companyId } } as Where
      }

      if (user?.role === 'branch' || user?.role === 'waiter') {
        const branch = user.branch
        if (!branch) return false
        let branchId: string
        if (typeof branch === 'string') {
          branchId = branch
        } else if (
          typeof branch === 'object' &&
          branch !== null &&
          'id' in branch &&
          typeof branch.id === 'string'
        ) {
          branchId = branch.id
        } else {
          return false
        }
        return { branch: { equals: branchId } } as Where
      }

      return false
    },
    create: ({ req: { user } }) => user?.role != null && ['branch', 'waiter'].includes(user.role),
    update: ({ req: { user } }) =>
      user?.role != null && ['superadmin', 'branch', 'waiter'].includes(user.role),
    delete: ({ req: { user } }) => user?.role === 'superadmin',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'phone',
      type: 'text',
      required: true,
    },
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
      required: false, // Optional, but can link for filtering
    },
    {
      name: 'company',
      type: 'relationship',
      relationTo: 'companies',
      required: false, // Auto-set if needed via hook
    },
  ],
  timestamps: true,
}

export default Customers
