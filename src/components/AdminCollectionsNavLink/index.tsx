import type { ServerProps } from 'payload'

const getCollectionsHref = (adminRoute?: string): string => {
  const normalizedAdminRoute = (adminRoute || '/admin').trim()
  const base = normalizedAdminRoute === '/' ? '' : normalizedAdminRoute.replace(/\/+$/, '')

  return base || '/admin'
}

const AdminCollectionsNavLink = ({
  i18n,
  params,
  payload,
}: Pick<ServerProps, 'i18n' | 'params' | 'payload'>) => {
  const href = getCollectionsHref(payload?.config?.routes?.admin)
  const routeSegments = params?.segments
  const firstSegment = Array.isArray(routeSegments) ? routeSegments[0] : routeSegments
  const isCollectionsActive = !firstSegment

  return (
    <div className="nav-group nav-group--collections-shortcut">
      <a
        aria-current={isCollectionsActive ? 'page' : undefined}
        className={`nav__link nav__link--collections-shortcut${isCollectionsActive ? ' active' : ''}`}
        href={href}
        id="nav-collections"
      >
        <span className="nav__link-label">{i18n.t('general:collections')}</span>
      </a>
    </div>
  )
}

export default AdminCollectionsNavLink
