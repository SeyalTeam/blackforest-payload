// src/collections/Dealers.ts
import { CollectionConfig } from 'payload'

const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/

const normalizeText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const normalizeUpperText = (value: unknown): string | null => {
  const normalized = normalizeText(value)
  return normalized ? normalized.toUpperCase() : null
}

const Dealers: CollectionConfig = {
  slug: 'dealers',
  admin: {
    group: 'Others',
    useAsTitle: 'companyName',
    defaultColumns: ['companyName', 'gst', 'status'],
  },
  access: {
    create: ({ req: { user } }) => {
      const role = (user as { role?: string })?.role
      return role === 'superadmin' || role === 'admin'
    },
    read: () => true,
    update: ({ req: { user } }) => {
      const u = user as { role?: string } | null
      return u?.role === 'superadmin' || u?.role === 'admin'
    },
    delete: ({ req: { user } }) => (user as { role?: string })?.role === 'superadmin',
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
      required: false, // Handled in hook
      admin: {
        condition: (data) => data.isGSTRegistered,
      },
    },
    {
      name: 'pan',
      type: 'text',
      label: 'PAN',
      required: false, // Handled in hook
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
    // Allowed Companies (moved back to main/left side, under Contact Person)
    {
      name: 'allowedCompanies',
      type: 'relationship',
      label: 'Allowed Companies',
      relationTo: 'companies',
      hasMany: true,
      required: true, // At least one company
      admin: {
        condition: ({ user }) => (user as { role?: string })?.role !== 'branch', // Hide for branch users if needed
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
          required: false, // Handled in hook
        },
        {
          name: 'accountNumber',
          type: 'text',
          label: 'Account Number',
          required: false, // Handled in hook
        },
        {
          name: 'ifscCode',
          type: 'text',
          label: 'IFSC Code',
          required: false, // Handled in hook
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
    beforeChange: [
      async ({ data, req, operation, originalDoc }) => {
        if (!data) return data

        if (operation === 'create' || operation === 'update') {
          const nextData = data as Record<string, unknown>
          const currentDoc = (originalDoc || {}) as Record<string, unknown>

          const isGSTRegistered =
            typeof nextData.isGSTRegistered === 'boolean'
              ? nextData.isGSTRegistered
              : typeof currentDoc.isGSTRegistered === 'boolean'
                ? (currentDoc.isGSTRegistered as boolean)
                : true

          const hasBankAccount =
            typeof nextData.hasBankAccount === 'boolean'
              ? nextData.hasBankAccount
              : typeof currentDoc.hasBankAccount === 'boolean'
                ? (currentDoc.hasBankAccount as boolean)
                : true

          nextData.isGSTRegistered = isGSTRegistered
          nextData.hasBankAccount = hasBankAccount

          if (isGSTRegistered) {
            const normalizedGST = normalizeUpperText(nextData.gst ?? currentDoc.gst)
            const normalizedPAN = normalizeUpperText(nextData.pan ?? currentDoc.pan)
            const normalizedFSSAI = normalizeText(nextData.fssai ?? currentDoc.fssai)

            if (!normalizedGST) throw new Error('GST is required for registered dealers')
            if (!gstRegex.test(normalizedGST)) {
              throw new Error('Invalid GST format')
            }

            if (!normalizedPAN) throw new Error('PAN is required for registered dealers')
            if (!panRegex.test(normalizedPAN)) {
              throw new Error('Invalid PAN format')
            }

            const existingDealerWithSameGST = await req.payload.find({
              collection: 'dealers',
              limit: 1,
              where: {
                and: [
                  { gst: { equals: normalizedGST } },
                  ...((currentDoc.id as string | undefined)
                    ? [{ id: { not_equals: currentDoc.id as string } }]
                    : []),
                ],
              },
            })

            if (existingDealerWithSameGST.docs.length > 0) {
              throw new Error('A dealer with this GST already exists')
            }

            nextData.gst = normalizedGST
            nextData.pan = normalizedPAN
            nextData.fssai = normalizedFSSAI
          } else {
            nextData.gst = null
            nextData.pan = null
            nextData.fssai = null
          }

          const incomingBankDetails = nextData.bankDetails
          const currentBankDetails = currentDoc.bankDetails
          const mergedBankDetails =
            incomingBankDetails === null
              ? null
              : {
                  ...((currentBankDetails &&
                  typeof currentBankDetails === 'object' &&
                  !Array.isArray(currentBankDetails)
                    ? currentBankDetails
                    : {}) as Record<string, unknown>),
                  ...((incomingBankDetails &&
                  typeof incomingBankDetails === 'object' &&
                  !Array.isArray(incomingBankDetails)
                    ? incomingBankDetails
                    : {}) as Record<string, unknown>),
                }

          if (hasBankAccount) {
            const normalizedBankName = normalizeText(mergedBankDetails?.bankName)
            const normalizedAccountNumber = normalizeText(mergedBankDetails?.accountNumber)
            const normalizedIfscCode = normalizeUpperText(mergedBankDetails?.ifscCode)
            const normalizedBranch = normalizeText(mergedBankDetails?.branch)

            if (!normalizedBankName) throw new Error('Bank Name is required')
            if (!normalizedAccountNumber) throw new Error('Account Number is required')
            if (!normalizedIfscCode) throw new Error('IFSC Code is required')

            nextData.bankDetails = {
              bankName: normalizedBankName,
              accountNumber: normalizedAccountNumber,
              ifscCode: normalizedIfscCode,
              branch: normalizedBranch,
            }
            nextData.preferredPaymentMethod = null
          } else {
            const preferredPaymentMethod = normalizeText(
              nextData.preferredPaymentMethod ?? currentDoc.preferredPaymentMethod ?? 'cash',
            )

            nextData.bankDetails = null
            if (!preferredPaymentMethod) {
              throw new Error('Preferred Payment Method is required for non-bank dealers')
            }

            nextData.preferredPaymentMethod = preferredPaymentMethod
          }
        }
        return data
      },
    ],
  },
}

export default Dealers
