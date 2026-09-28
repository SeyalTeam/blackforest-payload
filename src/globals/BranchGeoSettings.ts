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
              name: 'buildingType',
              type: 'select',
              label: 'Building Type',
              defaultValue: 'standalone',
              options: [
                { label: 'Standalone Building / Outlet', value: 'standalone' },
                { label: 'Shopping Mall / Complex', value: 'mall' },
                { label: 'Commercial Shop / Street Outlet', value: 'commercial' },
                { label: 'Central Kitchen / Bakery', value: 'kitchen' },
                { label: 'Warehouse / Stock Center', value: 'warehouse' },
                { label: 'Kiosk / Outdoor Stall', value: 'kiosk' },
                { label: 'Custom / Other', value: 'custom' },
              ],
              admin: {
                width: '50%',
                description: 'Building category for this location',
              },
            },
            {
              name: 'shape',
              type: 'select',
              label: 'Geofence Boundary Shape',
              defaultValue: 'circle',
              options: [
                { label: 'Circle (Radial GPS)', value: 'circle' },
                { label: 'Square (Equal Sides with Rotation)', value: 'square' },
                { label: 'Rectangle (Length × Width with Rotation)', value: 'rectangle' },
              ],
              admin: {
                width: '50%',
                description: 'Choose shape based on building layout (Circle, Square, or Rectangle)',
              },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'latitude',
              type: 'number',
              required: true,
              admin: {
                width: '50%',
              },
            },
            {
              name: 'longitude',
              type: 'number',
              required: true,
              admin: {
                width: '50%',
              },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'radius',
              type: 'number',
              label: 'Radius (meters, for Circle)',
              defaultValue: 100,
              admin: {
                width: '50%',
                description: 'Allowed distance in meters for circular geofence',
                condition: (data, siblingData) => !siblingData?.shape || siblingData?.shape === 'circle',
              },
            },
            {
              name: 'squareSize',
              type: 'number',
              label: 'Square Side Length (meters)',
              defaultValue: 50,
              admin: {
                width: '50%',
                description: 'Length of each side in meters for square boundary',
                condition: (data, siblingData) => siblingData?.shape === 'square',
              },
            },
            {
              name: 'rectWidth',
              type: 'number',
              label: 'Width (meters)',
              defaultValue: 40,
              admin: {
                width: '33%',
                description: 'Footprint width in meters',
                condition: (data, siblingData) => siblingData?.shape === 'rectangle',
              },
            },
            {
              name: 'rectLength',
              type: 'number',
              label: 'Length (meters)',
              defaultValue: 60,
              admin: {
                width: '33%',
                description: 'Footprint length in meters',
                condition: (data, siblingData) => siblingData?.shape === 'rectangle',
              },
            },
            {
              name: 'rotation',
              type: 'number',
              label: 'Rotation (° Clockwise from North)',
              defaultValue: 0,
              min: 0,
              max: 360,
              admin: {
                width: '33%',
                description: 'Rotate boundary to align with building orientation (0° to 360°)',
                condition: (data, siblingData) =>
                  siblingData?.shape === 'square' || siblingData?.shape === 'rectangle',
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
