// src/collections/Dealers.ts
import { CollectionConfig } from 'payload'

const Dealers: CollectionConfig = {
  slug: 'dealers',
  admin: {
    useAsTitle: 'companyName',
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
      required: false,
    },
    {
      name: 'phoneNumber',
      type: 'text',
      label: 'Phone Number',
      required: false,
    },
    {
      name: 'email',
      type: 'email',
      label: 'Email',
      required: false,
    },
    // GST Registration Flag
    {
      name: 'isGSTRegistered',
      type: 'checkbox',
      label: 'Is GST Registered?',
      defaultValue: true,
    },
    // Conditional Compliance Fields
    {
      name: 'gst',
      type: 'text',
      label: 'GST',
      required: false,
      unique: true,
      admin: {
        condition: (data) => data.isGSTRegistered,
      },
    },
    {
      name: 'pan',
      type: 'text',
      label: 'PAN',
      required: false,
      admin: {
        condition: (data) => data.isGSTRegistered,
      },
    },
    {
      name: 'fssai',
      type: 'text',
      label: 'FSSAI',
      required: false,
      admin: {
        condition: (data) => data.isGSTRegistered,
      },
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
          required: false,
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
    // Allowed Companies (moved back to main/left side, under Contact Person)
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
    // Allowed Branches (moved back to main/left side, under Allowed Companies)
    {
      name: 'allowedBranches',
      type: 'relationship',
      label: 'Allowed Branches',
      relationTo: 'branches',
      hasMany: true,
      required: false,
    },
    // Notes (for extra details, e.g., on non-GST dealers)
    {
      name: 'notes',
      type: 'textarea',
      label: 'Notes',
      required: false,
    },
    // Status (moved before Bank Details, sidebar/right side)
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: false,
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
    // Bank Account Flag
    {
      name: 'hasBankAccount',
      type: 'checkbox',
      label: 'Has Bank Account?',
      defaultValue: true,
      admin: {
        position: 'sidebar',
      },
    },
    // Preferred Payment Method (shown if no bank)
    {
      name: 'preferredPaymentMethod',
      type: 'select',
      label: 'Preferred Payment Method',
      required: false,
      admin: {
        position: 'sidebar',
        condition: (data) => !data.hasBankAccount,
      },
      options: [
        { label: 'Cash', value: 'cash' },
        { label: 'UPI', value: 'upi' },
        { label: 'Cheque', value: 'cheque' },
        { label: 'Credit', value: 'credit' },
      ],
      defaultValue: 'cash',
    },
    // Bank Details (sidebar/right side, after Status, conditional)
    {
      name: 'bankDetails',
      type: 'group',
      label: 'Bank Details',
      admin: {
        position: 'sidebar',
        condition: (data) => data.hasBankAccount,
      },
      fields: [
        {
          name: 'bankName',
          type: 'text',
          label: 'Bank Name',
          required: false,
        },
        {
          name: 'accountNumber',
          type: 'text',
          label: 'Account Number',
          required: false,
        },
        {
          name: 'ifscCode',
          type: 'text',
          label: 'IFSC Code',
          required: false,
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
    // Updated hook for conditional validations (validate format only if provided, no required checks for GST/PAN even if registered)
    beforeChange: [
      async ({ data, req, operation }) => {
        if (operation === 'create' || operation === 'update') {
          if (data.isGSTRegistered) {
            // Validate GST format only if provided
            const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
            if (data.gst && !gstRegex.test(data.gst)) {
              throw new Error('Invalid GST format')
            }
            // Validate PAN format only if provided
            const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
            if (data.pan && !panRegex.test(data.pan)) {
              throw new Error('Invalid PAN format')
            }
          } else {
            // Clear fields if not registered
            data.gst = null
            data.pan = null
            data.fssai = null
          }

          if (data.hasBankAccount) {
            // No required checks; validate if provided (add ifsc/account format if needed later)
          } else {
            // Clear bank details if no account
            data.bankDetails = null
          }
        }
        return data
      },
    ],
  },
}

export default Dealers
