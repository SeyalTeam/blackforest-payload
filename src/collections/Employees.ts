import { CollectionConfig } from 'payload'

const timeOptions = Array.from({ length: 48 }, (_, i) => {
  const hours = String(Math.floor(i / 2)).padStart(2, '0')
  const minutes = i % 2 === 0 ? '00' : '30'
  return { label: `${hours}:${minutes}`, value: `${hours}:${minutes}` }
})



const Employees: CollectionConfig = {
  slug: 'employees',
  admin: {
    useAsTitle: 'name',
  },
  access: {
    read: ({ req }) => {
      if (!req.user) return false
      return true // Allow all authenticated users to read for relationship expansion
    },
    create: ({ req: { user } }) => {
      if (!user) return false
      return (
        user.role === 'superadmin' ||
        user.role === 'admin' ||
        user.role === 'company' ||
        user.role === 'branch'
      )
    },
    update: ({ req: { user }, id: _id }) => {
      if (!user) return false
      if (user.role === 'superadmin' || user.role === 'admin') return true
      return user.role === 'company' || user.role === 'branch' || user.role === 'manager'
    },
    delete: ({ req: { user } }) => {
      if (!user) return false
      return user.role === 'superadmin' || user.role === 'admin' || user.role === 'company'
    },
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
        },
        {
          name: 'employeeId',
          type: 'text',
          unique: true,
          required: true,
        },
      ],
    },
    {
      name: 'phoneNumber',
      type: 'text',
      required: true,
    },
    {
      name: 'email',
      type: 'email',
      required: false,
    },
    {
      name: 'address',
      type: 'text',
      required: false,
    },
    {
      type: 'row',
      fields: [
        {
          name: 'loginTime',
          type: 'select',
          options: timeOptions,
          label: 'Work In Time (HH:mm)',
          required: false,
          admin: { width: '33%' }
        },
        {
          name: 'logoutTime',
          type: 'select',
          options: timeOptions,
          label: 'Work Out Time (HH:mm)',
          required: false,
          admin: { width: '33%' }
        },
        {
          name: 'workingHours',
          type: 'number',
          label: 'Working Hours',
          required: false,
          admin: { 
            width: '33%',
            description: 'Auto-calculated from login and logout times',
            readOnly: true,
          }
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'monthlyLeaveCount',
          type: 'number',
          label: 'Monthly Leave Count',
          required: false,
          defaultValue: 0,
          admin: {
            width: '50%',
            description: 'Number of regular leaves per month',
          }
        },
        {
          name: 'weekoffCount',
          type: 'number',
          label: 'Weekoff Count',
          required: false,
          defaultValue: 0,
          admin: {
            width: '50%',
            description: 'Number of week-offs per month',
          }
        },
      ]
    },
    {
      name: 'salary',
      type: 'number',
      label: 'Salary',
      required: false,
      admin: {
        description: 'Monthly salary amount',
      }
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
      ],
      defaultValue: 'active',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'team',
      label: 'Role',
      type: 'select',
      options: [
        { label: 'Waiter', value: 'waiter' },
        { label: 'Chef', value: 'chef' },
        { label: 'Driver', value: 'driver' },
        { label: 'Cashier', value: 'cashier' },
        { label: 'Manager', value: 'manager' },
        { label: 'Supervisor', value: 'supervisor' },
        { label: 'Delivery', value: 'delivery' },
        { label: 'Kitchen', value: 'kitchen' },
        { label: 'Store Keeper', value: 'store_keeper' },
        { label: 'Account', value: 'account' },
        { label: 'Watcher', value: 'watcher' }, // CCTV monitoring team
      ],
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'aadhaarPhoto',
      type: 'upload',
      relationTo: 'media',
      required: false,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'photo',
      type: 'upload',
      relationTo: 'media',
      required: false,
      admin: {
        position: 'sidebar',
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ operation, data, req: _req }) => {
        if (operation === 'create' || operation === 'update') {
          if (data.name === 'Kitchen') {
            data.team = 'kitchen'
          }
          
          if (data.loginTime && data.logoutTime) {
            const [loginHour, loginMin] = data.loginTime.split(':').map(Number)
            const [logoutHour, logoutMin] = data.logoutTime.split(':').map(Number)
            
            let diffHours = logoutHour - loginHour
            let diffMins = logoutMin - loginMin
            
            if (diffMins < 0) {
              diffHours -= 1
              diffMins += 60
            }
            if (diffHours < 0) {
              diffHours += 24 // Handle overnight shifts
            }
            
            // Decimal format (e.g., 8 hours 30 mins = 8.5)
            data.workingHours = diffHours + (diffMins / 60)
          } else {
            data.workingHours = null
          }
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        // If team (role) has changed, update the associated User record
        if (doc.team !== previousDoc?.team) {
          const usersRes = await req.payload.find({
            collection: 'users',
            where: {
              employee: {
                equals: doc.id,
              },
            },
            depth: 0,
            overrideAccess: true,
          })

          if (usersRes.docs && usersRes.docs.length > 0) {
            for (const user of usersRes.docs) {
              try {
                await req.payload.update({
                  collection: 'users',
                  id: user.id,
                  data: {
                    role: doc.team,
                  },
                  overrideAccess: true,
                })
              } catch (e) {
                console.error(`Failed to sync role to user ${user.id}:`, e)
              }
            }
          }
        }
      },
    ],
  },
  timestamps: true,
}

export default Employees
