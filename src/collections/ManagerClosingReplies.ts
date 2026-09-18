import { CollectionConfig } from 'payload'

const ManagerClosingReplies: CollectionConfig = {
  slug: 'manager-closing-replies',
  labels: {
    singular: 'Manager Closing Reply',
    plural: 'Manager Closing Replies',
  },
  admin: {
    useAsTitle: 'date',
    defaultColumns: ['branch', 'date', 'type', 'totalAmount'],
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
      required: true,
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
        },
      },
    },
    {
      name: 'type',
      type: 'select',
      options: [
        { label: 'Common', value: 'common' },
        { label: 'Individual', value: 'individual' },
      ],
      required: true,
      defaultValue: 'common',
    },
    {
      name: 'closingEntry',
      type: 'relationship',
      relationTo: 'closing-entries',
      admin: {
        condition: (data) => data.type === 'individual',
      },
    },
    {
      name: 'message',
      type: 'textarea',
      required: true,
    },
    {
      name: 'denominations',
      type: 'group',
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'rs500', type: 'number', min: 0, defaultValue: 0 },
            { name: 'rs200', type: 'number', min: 0, defaultValue: 0 },
            { name: 'rs100', type: 'number', min: 0, defaultValue: 0 },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'rs50', type: 'number', min: 0, defaultValue: 0 },
            { name: 'rs20', type: 'number', min: 0, defaultValue: 0 },
            { name: 'rs10', type: 'number', min: 0, defaultValue: 0 },
          ],
        },
        {
          name: 'coins',
          type: 'number',
          min: 0,
          defaultValue: 0,
        },
      ],
    },
    {
      name: 'totalAmount',
      type: 'number',
      required: true,
      admin: {
        readOnly: true,
      },
    },
  ],
}

export default ManagerClosingReplies
