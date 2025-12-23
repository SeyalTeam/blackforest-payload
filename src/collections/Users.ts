import type { CollectionConfig } from 'payload'
import { isIPAllowed } from '../utilities/ipCheck'
import type { IpSetting } from '../payload-types'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'role'],
  },
  auth: {
    tokenExpiration: 86400, // 24 hours in seconds
  },
  fields: [
    // Email added by default
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'role',
      type: 'select',
      options: [
        { label: 'Superadmin', value: 'superadmin' },
        { label: 'Admin', value: 'admin' },
        { label: 'Delivery', value: 'delivery' },
        { label: 'Branch', value: 'branch' },
        { label: 'Company', value: 'company' },
        { label: 'Factory', value: 'factory' }, // New
        { label: 'Kitchen', value: 'kitchen' }, // New
        { label: 'Chef', value: 'chef' }, // New
        { label: 'Cashier', value: 'cashier' }, // New
        { label: 'Waiter', value: 'waiter' }, // New
        { label: 'Supervisor', value: 'supervisor' },
        { label: 'Driver', value: 'driver' },
      ],
      defaultValue: 'admin',
      required: true,
      access: {
        update: ({ req }) => req.user?.role === 'superadmin',
      },
    },
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
      required: false,
      admin: {
        condition: ({ role }) => ['branch', 'kitchen'].includes(role), // Show for branch, kitchen
      },
      access: {
        create: ({ req }) => req.user?.role === 'superadmin',
        update: ({ req }) => req.user?.role === 'superadmin',
      },
    },
    {
      name: 'company',
      type: 'relationship',
      relationTo: 'companies',
      required: false,
      admin: {
        condition: ({ role }) => role === 'company',
      },
      access: {
        create: ({ req }) => req.user?.role === 'superadmin',
        update: ({ req }) => req.user?.role === 'superadmin',
      },
    },
    {
      name: 'factory_companies',
      type: 'relationship',
      relationTo: 'companies',
      hasMany: true,
      required: false,
      admin: {
        condition: ({ role }) => role === 'factory',
      },
      access: {
        create: ({ req }) => req.user?.role === 'superadmin',
        update: ({ req }) => req.user?.role === 'superadmin',
      },
    },
    {
      name: 'employee',
      type: 'relationship',
      relationTo: 'employees',
      required: false,
      admin: {
        condition: ({ role }) =>
          ['waiter', 'cashier', 'supervisor', 'delivery', 'driver', 'chef'].includes(role),
      },
      filterOptions: ({ siblingData }) => {
        const role = (siblingData as { role?: string }).role
        if (
          !role ||
          !['waiter', 'cashier', 'supervisor', 'delivery', 'driver', 'chef'].includes(role)
        ) {
          return false
        }
        return { team: { equals: role } }
      },
      access: {
        create: ({ req }) => req.user?.role === 'superadmin',
        update: ({ req }) => req.user?.role === 'superadmin',
      },
    },
  ],
  access: {
    create: ({ req }) => req.user?.role === 'superadmin',
    read: ({ req, id }) => {
      if (!req.user) return false
      return req.user.role === 'superadmin' || req.user.role === 'admin' || req.user.id === id
    },
    update: ({ req, id }) => {
      if (!req.user) return false
      return req.user.role === 'superadmin' || req.user.id === id
    },
    delete: ({ req }) => req.user?.role === 'superadmin',
  },
  hooks: {
    beforeLogin: [
      async ({ req, user }) => {
        if (user.role === 'superadmin') return

        const ipSettings: IpSetting = await req.payload.findGlobal({
          slug: 'ip-settings',
        })

        const restriction = ipSettings.roleRestrictions?.find((r) => r.role === user.role)

        if (restriction) {
          // Detect Public IP
          const forwarded = req.headers.get('x-forwarded-for')
          const publicIp =
            typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '127.0.0.1'

          // Detect Private IP (from custom header)
          const privateIpHeader = req.headers.get('x-private-ip')
          const privateIp = typeof privateIpHeader === 'string' ? privateIpHeader.trim() : null

          const publicAllowedRanges =
            restriction.ipRanges
              ?.filter((r: { ipType: string }) => r.ipType === 'public')
              .map((r: { ipOrRange: string }) => r.ipOrRange) || []
          const privateAllowedRanges =
            restriction.ipRanges
              ?.filter((r: { ipType: string }) => r.ipType === 'private')
              .map((r: { ipOrRange: string }) => r.ipOrRange) || []

          const isPublicAllowed =
            publicAllowedRanges.length > 0 && isIPAllowed(publicIp, publicAllowedRanges)
          const isPrivateAllowed =
            privateIp &&
            privateAllowedRanges.length > 0 &&
            isIPAllowed(privateIp, privateAllowedRanges)

          if (!isPublicAllowed && !isPrivateAllowed) {
            console.warn(
              `Login denied for role ${user.role}. Public IP: ${publicIp}, Private IP: ${privateIp || 'Not provided'}.`,
            )

            let errorMessage = `Login restricted from this IP address. Please contact admin.`
            if (privateAllowedRanges.length > 0 && !privateIp) {
              errorMessage += ` (Missing Private IP detection. Ensure your app sends the x-private-ip header).`
            }
            errorMessage += ` (Detected Public IP: ${publicIp}${privateIp ? `, Private IP: ${privateIp}` : ''})`

            throw new Error(errorMessage)
          }
        }
      },
    ],
    beforeChange: [
      async ({ data, req, operation }) => {
        if (operation === 'create' || operation === 'update') {
          // Auto-populate name from employee if not set
          if (!data.name && data.employee) {
            const employeeId = typeof data.employee === 'string' ? data.employee : data.employee.id
            if (employeeId) {
              const employee = await req.payload.findByID({
                collection: 'employees',
                id: employeeId,
              })
              if (employee?.name) {
                data.name = employee.name
              }
            }
          }
          if (['branch', 'kitchen'].includes(data.role) && !data.branch) {
            throw new Error('Branch is required for branch or kitchen role users')
          }
          if (data.role === 'company' && !data.company) {
            throw new Error('Company is required for company role users')
          }
          if (
            data.role === 'factory' &&
            (!data.factory_companies || data.factory_companies.length === 0)
          ) {
            throw new Error('At least one company is required for factory role users')
          }
          if (
            ['waiter', 'cashier', 'supervisor', 'delivery', 'driver', 'chef'].includes(data.role) &&
            !data.employee
          ) {
            throw new Error(
              'Employee is required for waiter, cashier, supervisor, delivery, driver, or chef role users',
            )
          }
        }
        return data
      },
    ],
  },
}
