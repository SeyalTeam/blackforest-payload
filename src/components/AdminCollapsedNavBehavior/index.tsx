'use client'

import { useEffect } from 'react'

const DESKTOP_BREAKPOINT = '(min-width: 1025px)'

const isCollapsedDesktopNav = (template: Element, isDesktop: boolean): boolean => {
  if (!isDesktop) return false

  return (
    template.classList.contains('template-default--nav-hydrated') &&
    !template.classList.contains('template-default--nav-open')
  )
}

const AdminCollapsedNavBehavior = () => {
  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_BREAKPOINT)
    let attempts = 0
    const MAX_ATTEMPTS = 50 // Roughly 1 second if 60fps
    let observer: MutationObserver | null = null
    let rafId: number | null = null

    const sync = () => {
      const template = document.querySelector('.template-default')
      const nav = document.querySelector('aside.nav')

      if (!template || !nav) return

      const shouldAllowCollapsedRail = isCollapsedDesktopNav(template, mediaQuery.matches)

      if (shouldAllowCollapsedRail) {
        nav.removeAttribute('inert')
      } else if (
        !template.classList.contains('template-default--nav-open') &&
        !nav.hasAttribute('inert')
      ) {
        nav.setAttribute('inert', '')
      }
    }

    const setupObserver = () => {
      const template = document.querySelector('.template-default')
      const nav = document.querySelector('aside.nav')

      if (!template || !nav) {
        if (attempts < MAX_ATTEMPTS) {
          attempts++
          rafId = window.requestAnimationFrame(setupObserver)
        }
        return
      }

      observer = new MutationObserver(sync)
      observer.observe(template, { attributes: true, attributeFilter: ['class'] })
      observer.observe(nav, { attributes: true, attributeFilter: ['class', 'inert'] })

      sync()
    }

    setupObserver()
    mediaQuery.addEventListener('change', sync)
    window.addEventListener('resize', sync)

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
      }

      if (observer) {
        observer.disconnect()
      }

      mediaQuery.removeEventListener('change', sync)
      window.removeEventListener('resize', sync)
    }
  }, [])

  return null
}

export default AdminCollapsedNavBehavior
