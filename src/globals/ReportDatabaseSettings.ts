import type { GlobalConfig } from 'payload'
import {
  invalidateReportDatabaseSettingsCache,
  REPORT_DATA_SOURCE_OPTIONS,
} from '../utilities/reportSecondDb'

export const ReportDatabaseSettings: GlobalConfig = {
  slug: 'report-database-settings',
  label: 'Report Database Settings',
  admin: {
    group: 'Settings',
    description:
      'Read-only Second DB routing for reports: enter a Second DB MongoDB connection string and choose which reports should load their data from it.',
  },
  access: {
    read: () => true,
    update: ({ req }) => req.user?.role === 'superadmin' || !req.user?.role,
  },
  hooks: {
    afterChange: [
      ({ doc }) => {
        invalidateReportDatabaseSettingsCache()
        return doc
      },
    ],
  },
  fields: [
    {
      type: 'ui',
      name: 'reportDbActions',
      admin: {
        components: {
          Field: '/components/ReportDatabaseActions/index.tsx#ReportDatabaseActions',
        },
      },
    },
    {
      name: 'enabled',
      type: 'checkbox',
      label: 'Enable Second DB for Selected Reports (Read-Only)',
      defaultValue: false,
      admin: {
        description:
          'When enabled, only the reports selected below will read data from the Second DB. Unselected reports continue using the primary DB.',
      },
    },
    {
      name: 'secondDbUri',
      type: 'text',
      label: 'Second DB MongoDB Connection String',
      required: false,
      admin: {
        placeholder: 'mongodb+srv://user:pass@cluster.mongodb.net/second_db',
        description:
          'MongoDB URI of the second database used strictly for reading selected reports.',
      },
    },
    {
      name: 'selectedReports',
      type: 'select',
      hasMany: true,
      label: 'Select Reports to Show Data From Second DB',
      required: false,
      options: REPORT_DATA_SOURCE_OPTIONS.map((opt) => ({
        label: opt.label,
        value: opt.value,
      })),
      admin: {
        description:
          'Choose which reports should query the Second DB instead of the primary DB.',
      },
    },
  ],
}
