import { CollectionConfig } from 'payload'

const Cakes: CollectionConfig = {
  slug: 'cakes',
  admin: {
    useAsTitle: 'kotNumber',
    defaultColumns: [
      'kotNumber',
      'customerName',
      'customerPhone',
      'cakePrice',
      'paymentAmount',
      'pendingAmount',
      'status',
      'orderStatus',
      'deliveryDate',
      'branch',
    ],
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'kotNumber',
      type: 'text',
      required: true,
      index: true,
      label: 'Order / KOT Number',
    },
    {
      name: 'legacyOrderId',
      type: 'text',
      index: true,
      admin: {
        description: 'Original Order ID from blackforest-cakes backend',
        position: 'sidebar',
      },
    },
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
      index: true,
    },
    {
      type: 'row',
      fields: [
        {
          name: 'customerName',
          type: 'text',
          label: 'Customer Name',
          admin: { width: '50%' },
        },
        {
          name: 'customerPhone',
          type: 'text',
          label: 'Customer Phone',
          admin: { width: '50%' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'customerEmail',
          type: 'text',
          label: 'Customer Email',
          admin: { width: '50%' },
        },
        {
          name: 'deliveryType',
          type: 'select',
          label: 'Delivery Type',
          options: [
            { label: 'Shop Pickup', value: 'shop' },
            { label: 'Home Delivery', value: 'home' },
          ],
          defaultValue: 'shop',
          admin: { width: '50%' },
        },
      ],
    },
    {
      name: 'deliveryAddress',
      type: 'textarea',
      label: 'Delivery Address',
    },
    {
      type: 'row',
      fields: [
        {
          name: 'cakePrice',
          type: 'number',
          label: 'Total Amount (₹)',
          required: true,
          defaultValue: 0,
          admin: { width: '33%' },
        },
        {
          name: 'paymentAmount',
          type: 'number',
          label: 'Paid / Advance Amount (₹)',
          required: true,
          defaultValue: 0,
          admin: { width: '33%' },
        },
        {
          name: 'pendingAmount',
          type: 'number',
          label: 'Balance Amount (₹)',
          admin: {
            readOnly: true,
            width: '34%',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'paymentMethod',
          type: 'select',
          options: [
            { label: 'Cash', value: 'cash' },
            { label: 'Card', value: 'card' },
            { label: 'UPI', value: 'upi' },
            { label: 'Cashfree', value: 'cashfree' },
            { label: 'Other', value: 'other' },
          ],
          defaultValue: 'cash',
          admin: { width: '33%' },
        },
        {
          name: 'paymentType',
          type: 'select',
          options: [
            { label: 'Advance', value: 'advance' },
            { label: 'Full', value: 'full' },
          ],
          defaultValue: 'advance',
          admin: { width: '33%' },
        },
        {
          name: 'status',
          type: 'select',
          label: 'Payment Status',
          options: [
            { label: 'Paid', value: 'paid' },
            { label: 'Pending', value: 'pending' },
          ],
          required: true,
          defaultValue: 'pending',
          admin: { width: '34%' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'orderStatus',
          type: 'select',
          label: 'Order Lifecycle Status',
          options: [
            { label: 'Ordered / Pending', value: 'pending' },
            { label: 'Prepared', value: 'prepared' },
            { label: 'Ready', value: 'ready' },
            { label: 'Picked', value: 'picked' },
            { label: 'Delivered', value: 'delivered' },
            { label: 'Cancelled', value: 'cancelled' },
          ],
          defaultValue: 'pending',
          admin: { width: '50%' },
        },
        {
          name: 'deliveryDate',
          type: 'date',
          label: 'Delivery Date & Time',
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
            width: '50%',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'flavour',
          type: 'text',
          label: 'Flavour',
          admin: { width: '33%' },
        },
        {
          name: 'weight',
          type: 'text',
          label: 'Weight (e.g. 1 Kg)',
          admin: { width: '33%' },
        },
        {
          name: 'creamType',
          type: 'text',
          label: 'Cream Type',
          admin: { width: '34%' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'cakeModel',
          type: 'text',
          label: 'Cake Model / Design Name',
          admin: { width: '50%' },
        },
        {
          name: 'alteration',
          type: 'text',
          label: 'Alteration Details',
          admin: { width: '50%' },
        },
      ],
    },
    {
      name: 'wordings',
      type: 'textarea',
      label: 'Message on Cake (Wordings)',
      admin: {
        description: 'Custom message or name to write on the cake',
      },
    },
    {
      name: 'specialCare',
      type: 'textarea',
      label: 'Special Baking & Handling Instructions',
    },
    {
      type: 'row',
      fields: [
        {
          name: 'kotPhoto',
          type: 'relationship',
          relationTo: 'media',
          required: false,
          admin: { width: '50%' },
        },
        {
          name: 'cakePhoto',
          type: 'relationship',
          relationTo: 'media',
          required: false,
          admin: { width: '50%' },
        },
      ],
    },
    {
      name: 'orderDoc',
      type: 'text',
      label: 'Order Document / Photo URL',
      admin: {
        description: 'Direct URL or filename of uploaded order receipt/photo',
      },
    },
    {
      name: 'paymentHistory',
      type: 'array',
      fields: [
        {
          name: 'amount',
          type: 'number',
          required: true,
        },
        {
          name: 'method',
          type: 'select',
          options: [
            { label: 'Cash', value: 'cash' },
            { label: 'Card', value: 'card' },
            { label: 'UPI', value: 'upi' },
            { label: 'Cashfree', value: 'cashfree' },
            { label: 'Other', value: 'other' },
          ],
          required: true,
        },
        {
          name: 'date',
          type: 'date',
          required: true,
        },
      ],
    },
    {
      name: 'cashierId',
      type: 'text',
      index: true,
      admin: { description: 'ID of the cashier/staff who took the order.' },
    },
    {
      name: 'cashierName',
      type: 'text',
      index: true,
      admin: { description: 'Name of the cashier/staff who took the order.' },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ req, operation, data, originalDoc }) => {
        if (!data.cashierId && req.user) {
          const emp = (req.user as any)?.employee
          const empId = typeof emp === 'object' && emp !== null ? (emp.id || emp._id) : emp
          data.cashierId = empId ? String(empId) : String(req.user.id)
        }
        if (!data.cashierName && req.user) {
          const emp = (req.user as any)?.employee
          const empName = typeof emp === 'object' && emp !== null ? emp.name : null
          data.cashierName = empName || req.user.name || (req.user as any).username || ''
        }
        if (operation === 'create') {
          if (req.user?.role === 'branch' && req.user.branch) {
            data.branch = typeof req.user.branch === 'string' ? req.user.branch : req.user.branch.id
          }
        }

        // Calculate paymentAmount if paymentHistory exists
        let paid = 0
        if (data.paymentHistory && data.paymentHistory.length > 0) {
          data.paymentAmount = data.paymentHistory.reduce(
            (sum: number, p: { amount?: number }) => sum + (p.amount || 0),
            0
          )
          paid = data.paymentAmount
        } else {
          paid = typeof data.paymentAmount !== 'undefined' ? data.paymentAmount : (originalDoc?.paymentAmount || 0)
        }

        const price = typeof data.cakePrice !== 'undefined' ? data.cakePrice : (originalDoc?.cakePrice || 0)
        const pending = price - paid
        data.pendingAmount = pending < 0 ? 0 : pending

        // Set status based on pending amount
        data.status = data.pendingAmount <= 0 ? 'paid' : 'pending'

        return data
      },
    ],
  },
}

export default Cakes
