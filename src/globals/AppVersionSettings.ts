import type { GlobalConfig } from 'payload'

const canManageAppVersion = (role?: string): boolean =>
  ['superadmin', 'admin'].includes(role || '')

export const AppVersionSettings: GlobalConfig = {
  slug: 'app-version-settings',
  label: 'App Version Control',
  admin: {
    group: 'Settings',
    description: 'Set the minimum allowed app version. Old APKs below this version will be blocked.',
  },
  access: {
    read: () => true,
    update: ({ req }) => canManageAppVersion(req.user?.role),
  },
  fields: [
    {
      name: 'minAppVersion',
      label: 'Minimum App Version',
      type: 'text',
      defaultValue: '1.0.0',
      admin: {
        description:
          'e.g. "2.0.0" — Any app with a version lower than this will be blocked and shown an update screen. Requests without a version header (e.g. browser / Postman) are always allowed.',
        placeholder: '2.0.0',
      },
    },
    {
      name: 'updateMessage',
      label: 'Update Message (shown to blocked users)',
      type: 'text',
      defaultValue: 'This version of the app is no longer supported. Please update to continue.',
      admin: {
        description: 'This message is shown inside the app when a user is on a blocked version.',
      },
    },
  ],
}
