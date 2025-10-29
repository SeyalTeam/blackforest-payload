import type { CollectionConfig } from 'payload'

export const Branches: CollectionConfig = {
  slug: 'branches',
  admin: {
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'company',
      type: 'relationship',
      relationTo: 'companies',
      required: true,
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'address',
      type: 'text',
      required: true,
    },
    {
      name: 'gst',
      type: 'text',
      required: true,
    },
    {
      name: 'phone',
      type: 'text',
      required: true,
    },
    {
      name: 'email',
      type: 'email',
      required: true,
    },
    {
      name: 'ipAddress',
      type: 'text',
      label: 'Branch IP Address (from ISP)',
      admin: {
        description:
          'Public IP for auto-detecting branch on login (e.g., 192.0.2.1). Fetch via whatismyip.com at branch.',
      },
    },
    {
      name: 'printerIp',
      type: 'text',
      label: 'Printer IP Address',
      admin: {
        description:
          'IP address of the network printer for this branch (e.g., 192.168.1.100). Used for printing bills directly over the local network.',
      },
    },
  ],
  access: {
    create: ({ req }) => req.user?.role === 'superadmin',
    read: () => true,
    update: ({ req, id }): boolean | import('payload').Where => {
      if (!req.user) return false
      if (req.user.role === 'superadmin') return true
      if (req.user.role === 'branch') {
        if (!req.user.branch) return false
        const userBranchId =
          typeof req.user.branch === 'string' ? req.user.branch : req.user.branch.id
        return { id: { equals: userBranchId } }
      }
      return false
    },
    delete: ({ req }) => req.user?.role === 'superadmin',
  },
}
