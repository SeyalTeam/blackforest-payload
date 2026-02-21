import { CollectionConfig } from 'payload'

const Customers: CollectionConfig = {
  slug: 'customers',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'phoneNumber', 'rewardPoints', 'isOfferEligible'],
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) =>
      user?.role != null && ['superadmin', 'admin', 'branch', 'waiter'].includes(user.role),
    update: ({ req: { user } }) =>
      user?.role != null && ['superadmin', 'admin', 'branch', 'waiter'].includes(user.role),
    delete: ({ req: { user } }) => user?.role === 'superadmin',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'phoneNumber',
      type: 'text',
      unique: true,
      required: true,
    },
    {
      name: 'bills',
      type: 'relationship',
      relationTo: 'billings',
      hasMany: true,
      admin: {
        components: {
          Field: '/components/CustomerBillsTable/index.tsx#default',
        },
      },
    },
    {
      name: 'rewardPoints',
      type: 'number',
      label: 'Credit Points',
      min: 0,
      defaultValue: 0,
      admin: {
        description: 'Editable: manually adjust customer points when required.',
      },
      access: {
        update: ({ req: { user } }) =>
          user?.role != null && ['superadmin', 'admin', 'branch'].includes(user.role),
      },
    },
    {
      name: 'rewardProgressAmount',
      type: 'number',
      label: 'Progress Amount (Rs)',
      min: 0,
      defaultValue: 0,
      admin: {
        description:
          'Editable: accumulated purchase amount towards next point step.',
      },
      access: {
        update: ({ req: { user } }) =>
          user?.role != null && ['superadmin', 'admin', 'branch'].includes(user.role),
      },
    },
    {
      name: 'isOfferEligible',
      type: 'checkbox',
      label: 'Eligible for Offer',
      defaultValue: false,
      admin: {
        description: 'Editable override for eligibility if needed.',
      },
      access: {
        update: ({ req: { user } }) =>
          user?.role != null && ['superadmin', 'admin', 'branch'].includes(user.role),
      },
    },
    {
      name: 'totalOffersRedeemed',
      type: 'number',
      min: 0,
      defaultValue: 0,
      admin: {
        description: 'Editable: manual correction field for redeemed offers.',
      },
      access: {
        update: ({ req: { user } }) =>
          user?.role != null && ['superadmin', 'admin', 'branch'].includes(user.role),
      },
    },
    {
      name: 'randomCustomerOfferAssigned',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'randomCustomerOfferRedeemed',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'randomCustomerOfferProduct',
      type: 'relationship',
      relationTo: 'products',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'randomCustomerOfferCampaignCode',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'randomCustomerOfferAssignedAt',
      type: 'date',
      admin: {
        readOnly: true,
      },
    },
  ],
  timestamps: true,
}

export default Customers
