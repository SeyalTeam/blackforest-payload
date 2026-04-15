import type { AdminViewServerProps } from 'payload'

import { HydrateAuthProvider, SetStepNav } from '@payloadcms/ui'
import { EntityType } from '@payloadcms/ui/shared'
import { DefaultDashboard } from '@payloadcms/next/views'
import { Fragment } from 'react'

const AdminCollectionsDashboard = (props: AdminViewServerProps) => {
  const {
    locale,
    permissions,
    req: {
      i18n,
      payload: { config },
      payload,
      user,
    },
    visibleEntities,
  } = props.initPageResult

  const collections = config.collections.filter(
    (collection) =>
      visibleEntities.collections.includes(collection.slug) &&
      collection.admin?.hidden !== true,
  )

  const navGroups = [
    {
      label: i18n.t('general:collections'),
      entities: collections.map((collection) => ({
        label:
          typeof collection.labels?.plural === 'function'
            ? collection.labels.plural({ i18n, t: i18n.t })
            : collection.labels?.plural || collection.slug,
        slug: collection.slug,
        type: EntityType.collection,
      })),
    },
  ]

  return (
    <Fragment>
      <HydrateAuthProvider permissions={permissions} />
      <SetStepNav nav={[]} />
      <DefaultDashboard
        {...props}
        globalData={[]}
        i18n={i18n}
        locale={locale!}
        navGroups={navGroups}
        payload={payload}
        permissions={permissions}
        user={user ?? undefined}
        visibleEntities={visibleEntities}
      />
    </Fragment>
  )
}

export default AdminCollectionsDashboard
