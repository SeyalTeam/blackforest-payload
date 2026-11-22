'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

const DESKTOP_BREAKPOINT = '(min-width: 1025px)'
const SCROLL_STORAGE_KEY = 'payload_admin_nav_scroll_top'

const isCollapsedDesktopNav = (template: Element, isDesktop: boolean): boolean => {
  if (!isDesktop) return false

  return (
    template.classList.contains('template-default--nav-hydrated') &&
    !template.classList.contains('template-default--nav-open')
  )
}

const getNavScrollElement = (): HTMLElement | null => {
  return (
    document.querySelector<HTMLElement>('.nav__scroll') ||
    document.querySelector<HTMLElement>('aside.nav') ||
    document.querySelector<HTMLElement>('.nav')
  )
}

const AdminCollapsedNavBehavior = () => {
  const pathname = usePathname()
  const lastIntentionalScrollTopRef = useRef<number>(0)
  const isNavigatingRef = useRef<boolean>(false)
  const navGuardTimeoutRef = useRef<number | null>(null)

  // Initialize stored scroll position into memory
  useEffect(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const saved = window.sessionStorage.getItem(SCROLL_STORAGE_KEY)
      if (saved !== null) {
        const top = parseFloat(saved)
        if (!isNaN(top) && top > 0) {
          lastIntentionalScrollTopRef.current = top
        }
      }
    }
  }, [])

  // Restore scroll position whenever pathname changes
  useEffect(() => {
    const restore = () => {
      const navScroll = getNavScrollElement()
      if (!navScroll) return

      navScroll.scrollLeft = 0

      let target = lastIntentionalScrollTopRef.current
      if (!target || target <= 0) {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          const saved = window.sessionStorage.getItem(SCROLL_STORAGE_KEY)
          if (saved !== null) {
            const top = parseFloat(saved)
            if (!isNaN(top) && top > 0) {
              target = top
              lastIntentionalScrollTopRef.current = top
            }
          }
        }
      }

      if (target && target > 0) {
        navScroll.scrollTop = target
      }
    }

    restore()
    const rafId = window.requestAnimationFrame(restore)
    const t1 = window.setTimeout(restore, 25)
    const t2 = window.setTimeout(restore, 60)
    const t3 = window.setTimeout(restore, 120)
    const t4 = window.setTimeout(restore, 250)
    const t5 = window.setTimeout(restore, 500)
    const t6 = window.setTimeout(() => {
      restore()
      isNavigatingRef.current = false
    }, 1000)

    return () => {
      window.cancelAnimationFrame(rafId)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
      window.clearTimeout(t4)
      window.clearTimeout(t5)
      window.clearTimeout(t6)
    }
  }, [pathname])

  // General sidebar behavior, rail synchronization, and interaction capture
  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_BREAKPOINT)
    let attempts = 0
    const MAX_ATTEMPTS = 50
    let observer: MutationObserver | null = null
    let navObserver: MutationObserver | null = null
    let rafId: number | null = null
    let scrollDebounce: number | null = null

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

      let target = lastIntentionalScrollTopRef.current
      if (!target || target <= 0) {
        const saved = window.sessionStorage.getItem(SCROLL_STORAGE_KEY)
        if (saved !== null) {
          const top = parseFloat(saved)
          if (!isNaN(top) && top > 0) {
            target = top
            lastIntentionalScrollTopRef.current = top
          }
        }
      }

      if (target && target > 0) {
        navScroll.scrollTop = target
        return
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
      if (!navScroll) return

      if (navScroll.scrollLeft !== 0) {
        navScroll.scrollLeft = 0
      }

      // If browser/router tries to reset scroll during navigation, restore instantly
      if (
        isNavigatingRef.current &&
        navScroll.scrollTop === 0 &&
        lastIntentionalScrollTopRef.current > 0
      ) {
        navScroll.scrollTop = lastIntentionalScrollTopRef.current
        return
      }

      lastIntentionalScrollTopRef.current = navScroll.scrollTop
      if (scrollDebounce !== null) {
        window.clearTimeout(scrollDebounce)
      }
      scrollDebounce = window.setTimeout(saveScrollPosition, 100)
    }

    const onUserInteraction = (e: Event) => {
      const target = (e.target as Element)?.closest?.('.nav a, aside.nav a, .nav__link')
      if (target) {
        const navScroll = getNavScrollElement()
        if (navScroll) {
          const top = navScroll.scrollTop
          lastIntentionalScrollTopRef.current = top
          isNavigatingRef.current = true
          if (typeof window !== 'undefined' && window.sessionStorage) {
            window.sessionStorage.setItem(SCROLL_STORAGE_KEY, String(top))
          }
          if (navGuardTimeoutRef.current) {
            window.clearTimeout(navGuardTimeoutRef.current)
          }
          navGuardTimeoutRef.current = window.setTimeout(() => {
            isNavigatingRef.current = false
          }, 2000)
        }
      }
    }

    const onUserManualScroll = () => {
      isNavigatingRef.current = false
    }

    // Intercept pushState & replaceState to guard scroll
    const origPushState = window.history.pushState
    const origReplaceState = window.history.replaceState

    window.history.pushState = function (...args) {
      const navScroll = getNavScrollElement()
      if (navScroll && navScroll.scrollTop > 0) {
        lastIntentionalScrollTopRef.current = navScroll.scrollTop
        isNavigatingRef.current = true
        window.sessionStorage?.setItem(SCROLL_STORAGE_KEY, String(navScroll.scrollTop))
      }
      const result = origPushState.apply(this, args)
      restoreScrollPosition()
      return result
    }

    window.history.replaceState = function (...args) {
      const result = origReplaceState.apply(this, args)
      return result
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

      if (navScroll) {
        navObserver = new MutationObserver(() => {
          if (
            isNavigatingRef.current &&
            navScroll.scrollTop === 0 &&
            lastIntentionalScrollTopRef.current > 0
          ) {
            navScroll.scrollTop = lastIntentionalScrollTopRef.current
          }
        })
        navObserver.observe(navScroll, { childList: true, subtree: true, attributes: true })
        navScroll.addEventListener('scroll', onScroll, { passive: true })
        navScroll.addEventListener('wheel', onUserManualScroll, { passive: true })
        navScroll.addEventListener('touchmove', onUserManualScroll, { passive: true })
      }

      sync()
      restoreScrollPosition()
      window.setTimeout(restoreScrollPosition, 50)
      window.setTimeout(restoreScrollPosition, 150)
      window.setTimeout(restoreScrollPosition, 350)
      window.setTimeout(restoreScrollPosition, 600)

      document.addEventListener('mousedown', onUserInteraction, true)
      document.addEventListener('pointerdown', onUserInteraction, true)
      document.addEventListener('click', onUserInteraction, true)
    }

    setupBehavior()
    mediaQuery.addEventListener('change', sync)
    window.addEventListener('resize', sync)
    window.addEventListener('popstate', restoreScrollPosition)

    return () => {
      window.history.pushState = origPushState
      window.history.replaceState = origReplaceState

      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
      }
      if (scrollDebounce !== null) {
        window.clearTimeout(scrollDebounce)
      }
      if (navGuardTimeoutRef.current) {
        window.clearTimeout(navGuardTimeoutRef.current)
      }
      if (observer) {
        observer.disconnect()
      }
      if (navObserver) {
        navObserver.disconnect()
      }

      const navScroll = getNavScrollElement()
      if (navScroll) {
        navScroll.removeEventListener('scroll', onScroll)
        navScroll.removeEventListener('wheel', onUserManualScroll)
        navScroll.removeEventListener('touchmove', onUserManualScroll)
      }
      document.removeEventListener('mousedown', onUserInteraction, true)
      document.removeEventListener('pointerdown', onUserInteraction, true)
      document.removeEventListener('click', onUserInteraction, true)

      mediaQuery.removeEventListener('change', sync)
      window.removeEventListener('resize', sync)
      window.removeEventListener('popstate', restoreScrollPosition)
    }
  }, [])

  return null
}

export default AdminCollapsedNavBehavior