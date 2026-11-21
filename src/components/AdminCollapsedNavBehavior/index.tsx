'use client'

import { useEffect } from 'react'

const DESKTOP_BREAKPOINT = '(min-width: 1025px)'
const SCROLL_STORAGE_KEY = 'payload_admin_nav_scroll_top'

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
    let scrollDebounce: number | null = null

    const getNavScrollElement = (): HTMLElement | null => {
      return (
        document.querySelector<HTMLElement>('.nav__scroll') ||
        document.querySelector<HTMLElement>('aside.nav') ||
        document.querySelector<HTMLElement>('.nav')
      )
    }

    const saveScrollPosition = () => {
      const navScroll = getNavScrollElement()
      if (navScroll && typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(SCROLL_STORAGE_KEY, String(navScroll.scrollTop))
      }
    }

    const restoreScrollPosition = () => {
      const navScroll = getNavScrollElement()
      if (!navScroll || typeof window === 'undefined' || !window.sessionStorage) return

      navScroll.scrollLeft = 0

      const saved = window.sessionStorage.getItem(SCROLL_STORAGE_KEY)
      if (saved !== null) {
        const top = parseFloat(saved)
        if (!isNaN(top) && top > 0) {
          navScroll.scrollTop = top
          return
        }
      }

      // Ensure active item is visible if not in view and no saved scroll position
      const activeLink = navScroll.querySelector<HTMLElement>(
        '.nav__link.active, .nav__link[aria-current="page"], a.active, a[aria-current="page"]'
      )
      if (activeLink) {
        const navRect = navScroll.getBoundingClientRect()
        const linkRect = activeLink.getBoundingClientRect()
        if (linkRect.bottom > navRect.bottom || linkRect.top < navRect.top) {
          activeLink.scrollIntoView({ block: 'nearest' })
        }
      }
    }

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
      const navScroll = getNavScrollElement()

      if (navScroll) {
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

    const onScroll = () => {
      const navScroll = getNavScrollElement()
      if (navScroll && navScroll.scrollLeft !== 0) {
        navScroll.scrollLeft = 0
      }
      if (scrollDebounce !== null) {
        window.clearTimeout(scrollDebounce)
      }
      scrollDebounce = window.setTimeout(saveScrollPosition, 80)
    }

    const onLinkClick = (e: MouseEvent) => {
      const target = (e.target as Element)?.closest?.('.nav a, aside.nav a, .nav__link')
      if (target) {
        saveScrollPosition()
      }
    }

    const setupBehavior = () => {
      const template = document.querySelector('.template-default')
      const nav = document.querySelector('aside.nav')
      const navScroll = getNavScrollElement()

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

      // Restore scroll on load across frames to counter React re-renders
      restoreScrollPosition()
      window.setTimeout(restoreScrollPosition, 50)
      window.setTimeout(restoreScrollPosition, 150)
      window.setTimeout(restoreScrollPosition, 350)
      window.setTimeout(restoreScrollPosition, 600)

      if (navScroll) {
        navScroll.addEventListener('scroll', onScroll, { passive: true })
      }
      document.addEventListener('click', onLinkClick, true)
    }

    setupBehavior()
    mediaQuery.addEventListener('change', sync)
    window.addEventListener('resize', sync)
    window.addEventListener('popstate', restoreScrollPosition)

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
      }
      if (scrollDebounce !== null) {
        window.clearTimeout(scrollDebounce)
      }
      if (observer) {
        observer.disconnect()
      }

      const navScroll = getNavScrollElement()
      if (navScroll) {
        navScroll.removeEventListener('scroll', onScroll)
      }
      document.removeEventListener('click', onLinkClick, true)

      mediaQuery.removeEventListener('change', sync)
      window.removeEventListener('resize', sync)
      window.removeEventListener('popstate', restoreScrollPosition)
    }
  }, [])

  return null
}

export default AdminCollapsedNavBehavior
