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
    const MAX_ATTEMPTS = 50
    let observer: MutationObserver | null = null
    let rafId: number | null = null

    // Update title tooltips on links for collapsed mode
    const syncTooltips = () => {
      const links = document.querySelectorAll<HTMLElement>('.nav .nav__link, aside.nav .nav__link')
      links.forEach((link) => {
        if (!link.getAttribute('title')) {
          const text = link.textContent?.trim()
          if (text) {
            link.setAttribute('title', text)
          }
        }
      })
    }

    const sync = () => {
      const template = document.querySelector('.template-default')
      const nav = document.querySelector('aside.nav')
      const navScroll = document.querySelector<HTMLElement>('.nav__scroll')

      if (navScroll && navScroll.scrollLeft !== 0) {
        navScroll.scrollLeft = 0
      }

      if (!template || !nav) return

      const shouldAllowCollapsedRail = isCollapsedDesktopNav(template, mediaQuery.matches)

      if (shouldAllowCollapsedRail) {
        if (nav.hasAttribute('inert')) {
          nav.removeAttribute('inert')
        }
      } else if (
        !template.classList.contains('template-default--nav-open') &&
        !nav.hasAttribute('inert')
      ) {
        nav.setAttribute('inert', '')
      }

      syncTooltips()
    }

    const setupBehavior = () => {
      const template = document.querySelector('.template-default')
      const nav = document.querySelector('aside.nav')

      if (!template || !nav) {
        if (attempts < MAX_ATTEMPTS) {
          attempts++
          rafId = window.requestAnimationFrame(setupBehavior)
        }
        return
      }

      observer = new MutationObserver(() => {
        sync()
      })
      observer.observe(template, { attributes: true, attributeFilter: ['class'] })
      observer.observe(nav, { attributes: true, attributeFilter: ['class'] })

      sync()
    }

    setupBehavior()
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