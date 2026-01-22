import type { GlobalConfig } from 'payload'

export const BranchGeoSettings: GlobalConfig = {
  slug: 'branch-geo-settings',
  label: 'Branch Geo Settings',
  admin: {
    group: 'Settings',
  },
  access: {
    read: ({ req }) => ['superadmin', 'admin'].includes(req.user?.role || ''),
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
              label: 'Printer IP Address (Local)',
              admin: {
                width: '50%',
                description: 'Local Network IP for printers',
              },
            },
          ],
        },
      ],
    },
  ],
}
