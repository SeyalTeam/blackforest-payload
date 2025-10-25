// src/collections/Dealers.ts
import { CollectionConfig } from 'payload'

const Dealers: CollectionConfig = {
  slug: 'dealers',
  admin: {
    useAsTitle: 'companyName',
    group: 'Others',
    defaultColumns: ['companyName', 'gst', 'status'],
  },
  access: {
    // Role-based access without custom User type import—use type assertions or any for compatibility with your existing setup
    create: ({ req: { user } }) => (user as any)?.role === 'superadmin',
    read: ({ req: { user } }) => {
      if ((user as any)?.role === 'superadmin') return true
      if (
        (user as any)?.role === 'admin' ||
        (user as any)?.role === 'company' ||
        (user as any)?.role === 'branch'
      ) {
        // Filter to user's companies—handle companies as array of IDs or objects
        const companies = (user as any)?.companies || []
        const companyIds = companies.map((c: any) => (typeof c === 'string' ? c : c.id))
        return {
          'allowedCompanies.id': { in: companyIds },
        }
      }
      return false
    },
    update: ({ req: { user } }) =>
      (user as any)?.role === 'superadmin' || (user as any)?.role === 'admin',
    delete: ({ req: { user } }) => (user as any)?.role === 'superadmin',
  },
  fields: [
    // Core Identification Fields (main/left side)
    {
      name: 'companyName',
      type: 'text',
      label: 'Company Name',
      required: true,
    },
    {
      name: 'address',
      type: 'textarea',
      label: 'Address',
      required: true,
    },
    {
      name: 'phoneNumber',
      type: 'text',
      label: 'Phone Number',
      required: true,
    },
    {
      name: 'email',
      type: 'email',
      label: 'Email',
      required: true,
    },
    {
      name: 'gst',
      type: 'text',
      label: 'GST',
      required: true,
      unique: true, // Ensure no duplicates
    },
    {
      name: 'pan',
      type: 'text',
      label: 'PAN',
      required: true,
    },
    {
      name: 'fssai',
      type: 'text',
      label: 'FSSAI',
      required: false,
    },
    // Contact Person Details (main/left side)
    {
      name: 'contactPerson',
      type: 'group',
      label: 'Contact Person Details',
      fields: [
        {
          name: 'name',
          type: 'text',
          label: 'Contact Name',
          required: true,
        },
        {
          name: 'designation',
          type: 'text',
          label: 'Designation',
          required: false,
        },
        {
          name: 'phone',
          type: 'text',
          label: 'Phone',
          required: false,
        },
        {
          name: 'email',
          type: 'email',
          label: 'Email',
          required: false,
        },
      ],
    },
    // Allowed Companies (moved back to main/left side, after Contact Person)
    {
      name: 'allowedCompanies',
      type: 'relationship',
      label: 'Allowed Companies',
      relationTo: 'companies',
      hasMany: true,
      required: true, // At least one company
      admin: {
        condition: ({ user }) => (user as any)?.role !== 'branch', // Hide for branch users if needed
      },
    },
    // Allowed Branches (moved back to main/left side, after Allowed Companies)
    {
      name: 'allowedBranches',
      type: 'relationship',
      label: 'Allowed Branches',
      relationTo: 'branches',
      hasMany: true,
      required: false,
    },
    // Status (moved to sidebar/right side, before Bank Details)
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      defaultValue: 'active',
      admin: {
        position: 'sidebar',
      },
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
        { label: 'On Hold', value: 'on-hold' },
      ],
    },
    // Bank Details (sidebar/right side, after Status)
    {
      name: 'bankDetails',
      type: 'group',
      label: 'Bank Details',
      admin: {
        position: 'sidebar',
      },
      fields: [
        {
          name: 'bankName',
          type: 'text',
          label: 'Bank Name',
          required: true,
        },
        {
          name: 'accountNumber',
          type: 'text',
          label: 'Account Number',
          required: true,
        },
        {
          name: 'ifscCode',
          type: 'text',
          label: 'IFSC Code',
          required: true,
        },
        {
          name: 'branch',
          type: 'text',
          label: 'Branch',
          required: false,
        },
      ],
    },
  ],
  hooks: {
    // Example hook for validations (e.g., GST/PAN format)
    beforeChange: [
      async ({ data, req, operation }) => {
        if (operation === 'create' || operation === 'update') {
          // Validate GST format (basic regex example)
          const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
          if (data.gst && !gstRegex.test(data.gst)) {
            throw new Error('Invalid GST format')
          }
          // Validate PAN format
          const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
          if (data.pan && !panRegex.test(data.pan)) {
            throw new Error('Invalid PAN format')
          }
        }
        return data
      },
    ],
  },
}

export default Dealers
