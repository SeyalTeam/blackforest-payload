import type { CollectionConfig, PayloadRequest, AccessArgs, FilterOptionsProps } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: true,

  fields: [
    {
      name: 'role',
      type: 'select',
      options: [
        { label: 'Superadmin', value: 'superadmin' },
        { label: 'Admin', value: 'admin' },
        { label: 'Delivery', value: 'delivery' },
        { label: 'Branch', value: 'branch' },
        { label: 'Company', value: 'company' },
        { label: 'Kitchen', value: 'kitchen' },
        { label: 'Cashier', value: 'cashier' },
        { label: 'Waiter', value: 'waiter' },
      ],
      defaultValue: 'admin',
      required: true,
      access: {
        update: ({ req }: AccessArgs) => req.user?.role === 'superadmin',
      },
    },

    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
      required: false,
      admin: {
        condition: ({ role }: { role?: string }) =>
          ['branch', 'kitchen', 'cashier'].includes(role || ''),
      },
      access: {
        create: ({ req }: AccessArgs) => req.user?.role === 'superadmin',
        update: ({ req }: AccessArgs) => req.user?.role === 'superadmin',
      },
    },

    {
      name: 'company',
      type: 'relationship',
      relationTo: 'companies',
      required: false,
      admin: {
        condition: ({ role }: { role?: string }) => role === 'company',
      },
      access: {
        create: ({ req }: AccessArgs) => req.user?.role === 'superadmin',
        update: ({ req }: AccessArgs) => req.user?.role === 'superadmin',
      },
    },

    {
      name: 'employee',
      type: 'relationship',
      relationTo: 'employees',
      required: false,
      admin: {
        condition: ({ role }: { role?: string }) => ['waiter', 'cashier'].includes(role || ''),
      },
      // ✅ Fixed FilterOptions typing
      filterOptions: (options: FilterOptionsProps<any>) => {
        const role = (options.siblingData as { role?: string })?.role
        if (!role || !['waiter', 'cashier'].includes(role)) {
          return false
        }
        return { team: { equals: role } }
      },
      access: {
        create: ({ req }: AccessArgs) => req.user?.role === 'superadmin',
        update: ({ req }: AccessArgs) => req.user?.role === 'superadmin',
      },
    },
  ],

  access: {
    create: ({ req }: AccessArgs) => req.user?.role === 'superadmin',

    // ✅ Fix for AccessArgs typing
    read: ({ req, id }: AccessArgs) => {
      if (!req.user) return false
      return (
        req.user.role === 'superadmin' ||
        req.user.role === 'admin' ||
        req.user.id === id?.toString()
      )
    },

    update: ({ req, id }: AccessArgs) => {
      if (!req.user) return false
      return req.user.role === 'superadmin' || req.user.id === id?.toString()
    },

    delete: ({ req }: AccessArgs) => req.user?.role === 'superadmin',
  },

  hooks: {
    beforeChange: [
      ({ data, operation }: { data: any; operation: 'create' | 'update' }) => {
        if (operation === 'create' || operation === 'update') {
          if (['branch', 'kitchen'].includes(data.role) && !data.branch) {
            throw new Error('Branch is required for branch or kitchen role users')
          }
          if (data.role === 'company' && !data.company) {
            throw new Error('Company is required for company role users')
          }
          if (['waiter', 'cashier'].includes(data.role) && !data.employee) {
            throw new Error('Employee is required for waiter or cashier role users')
          }
        }
        return data
      },
    ],

    // ✅ Add IP security check before login
    // @ts-ignore — Payload doesn't define "auth" hooks in CollectionConfig
    auth: {
      beforeLogin: [
        async ({ req, user }: { req: PayloadRequest; user: any }) => {
          const restrictedRoles = ['branch', 'kitchen', 'cashier']
          if (!user || !restrictedRoles.includes(user.role)) return

          // ✅ Fix for req.body possibly being undefined
          const body: any = req.body || {}
          const loginIp = (body as any)?.ip

          if (!loginIp) {
            throw new Error('Missing IP address in login request.')
          }

          if (!user.branch) {
            throw new Error('Branch not assigned to this user.')
          }

          const branchId = typeof user.branch === 'string' ? user.branch : user.branch.id

          const branch = await req.payload.findByID({
            collection: 'branches',
            id: branchId,
          })

          if (branch?.ipAddress && branch.ipAddress !== loginIp) {
            console.warn(`IP mismatch: expected ${branch.ipAddress}, got ${loginIp}`)
            throw new Error('Unauthorized: Login allowed only from branch network.')
          }
        },
      ],
    },
  },
}
