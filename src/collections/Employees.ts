import { CollectionConfig } from 'payload'

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
      return user.role === 'company' || user.role === 'branch'
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
    {
      name: 'faceDescriptor',
      type: 'json',
      admin: { hidden: true },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ operation, data, req: _req }) => {
        if (operation === 'create' || operation === 'update') {
          if (data.name === 'Kitchen') {
            data.team = 'kitchen'
          }
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        // Auto-compute face descriptor when photo is added or changed
        const photoId = typeof doc.photo === 'object' ? doc.photo?.id : doc.photo
        const prevPhotoId = previousDoc
          ? typeof previousDoc.photo === 'object'
            ? previousDoc.photo?.id
            : previousDoc.photo
          : null

        // Only recompute if photo changed
        if (!photoId || (operation === 'update' && photoId === prevPhotoId && doc.faceDescriptor)) {
          return doc
        }

        try {
          // Dynamically import to avoid loading heavy models at startup
          const { computeDescriptor } = await import('../services/faceRecognition')

          // Fetch the media document to get the image URL
          const media = await req.payload.findByID({
            collection: 'media',
            id: photoId,
            depth: 0,
          })

          if (!media?.url) {
            console.log(`[Employees] No URL found for media ${photoId}, skipping face descriptor`)
            return doc
          }

          // Download the image
          const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL 
            || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
          const imageUrl = media.url.startsWith('http')
            ? media.url
            : `${baseUrl}${media.url}`

          const response = await fetch(imageUrl)
          if (!response.ok) {
            console.log(`[Employees] Failed to fetch image from ${imageUrl}: ${response.status}`)
            return doc
          }

          const arrayBuffer = await response.arrayBuffer()
          const imageBuffer = Buffer.from(arrayBuffer)

          // Compute face descriptor
          const descriptor = await computeDescriptor(imageBuffer)

          if (descriptor) {
            // Save the descriptor as a JSON array
            await req.payload.update({
              collection: 'employees',
              id: doc.id,
              data: {
                faceDescriptor: Array.from(descriptor),
              },
              depth: 0,
            })
            console.log(`[Employees] Face descriptor computed for ${doc.name} (${doc.employeeId})`)
          } else {
            console.log(`[Employees] No face detected in photo for ${doc.name} (${doc.employeeId})`)
          }
        } catch (error: any) {
          // Don't fail the employee save if face computation fails
          console.error(`[Employees] Error computing face descriptor for ${doc.name}:`, error.message)
        }

        return doc
      },
    ],
  },
  timestamps: true,
}

export default Employees
