import { GlobalConfig } from 'payload'

export const MessagesChatGlobal: GlobalConfig = {
  slug: 'messages-chat',
  label: 'Message Chat',
  access: {
    read: () => true,
  },
  admin: {
    group: 'Account',
    components: {
      views: {
        edit: {
          root: {
            Component: '/components/MessageChat/index.tsx#default',
          },
        },
      },
    },
  },
  fields: [],
}
