import type { GlobalConfig } from 'payload'

export const BranchGeoSettings: GlobalConfig = {
  slug: 'branch-geo-settings',
  label: 'Branch Geo Settings',
  admin: {
    group: 'Settings',
  },
  access: {
    read: () => true,
    update: ({ req }) => req.user?.role === 'superadmin',
  },
  fields: [
    {
      name: 'locations',
      type: 'array',
      label: 'Branch Locations',
      fields: [
        {
          name: 'branch',
          type: 'relationship',
          relationTo: 'branches',
          required: true,
        },
        {
          type: 'ui',
          name: 'getLocation',
          admin: {
            components: {
              Field: '/components/GeoLocationButton/index.tsx#GeoLocationButton',
            },
          },
        },
        {
          type: 'row',
          fields: [
            {
              name: 'latitude',
              type: 'number',
              required: true,
              admin: {
                width: '33%',
              },
            },
            {
              name: 'longitude',
              type: 'number',
              required: true,
              admin: {
                width: '33%',
              },
            },
            {
              name: 'radius',
              type: 'number',
              label: 'Radius (meters)',
              required: true,
              defaultValue: 100,
              admin: {
                width: '33%',
                description: 'Allowed distance in meters',
              },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'ipAddress',
              type: 'text',
              label: 'Branch IP Address (Public)',
              admin: {
                width: '50%',
                description: 'Public IP required for login (optional override)',
              },
            },
            {
              name: 'printerIp',
              type: 'text',
              label: 'Default Printer IP',
              admin: {
                width: '50%',
                description: 'Default Local Network IP for billing printer',
              },
            },
          ],
        },
        {
          name: 'kotPrinters',
          type: 'array',
          label: 'KOT Printers (Kitchen Based)',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'kitchens',
                  type: 'relationship',
                  relationTo: 'kitchens',
                  hasMany: true,
                  required: true,
                  admin: {
                    width: '50%',
                  },
                },
                {
                  name: 'printerIp',
                  type: 'text',
                  label: 'Printer IP',
                  required: true,
                  admin: {
                    width: '50%',
                    description: 'Local IP for this category group',
                  },
                },
              ],
            },
            {
              name: 'label',
              type: 'text',
              label: 'Printer Name/Label',
              admin: {
                description: 'e.g. Kitchen, Bar, Juice Counter',
              },
            },
          ],
        },
      ],
    },
  ],
}
