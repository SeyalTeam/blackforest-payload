'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import './index.scss'

export interface CollectionItem {
  label: string
  slug: string
  canCreate?: boolean
  group: string
}

export interface CollectionGroup {
  label: string
  color: string
  accentColor: string
  bgLight: string
  entities: CollectionItem[]
}

interface AdminCollectionsGridProps {
  groups: CollectionGroup[]
  adminRoute?: string
}

// Crisp, high-clarity 28px SVG icon mapper
const getCollectionIcon = (slug: string) => {
  switch (slug) {
    case 'companies':
      // Multi-story corporate building / HQ
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <path d="M9 6h1M14 6h1M9 10h1M14 10h1M9 14h1M14 14h1" />
          <path d="M10 22v-4h4v4" />
        </svg>
      )

    case 'branches':
      // Storefront with awning & entrance
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-6 9 6v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <path d="M9 22V12h6v10" />
          <path d="M2 9h20" />
        </svg>
      )

    case 'departments':
      // Organization / Department hierarchy
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <rect x="3" y="17" width="6" height="4" rx="1" />
          <rect x="15" y="17" width="6" height="4" rx="1" />
          <path d="M12 7v5M6 17v-3a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3" />
        </svg>
      )

    case 'tables':
      // Restaurant dining table & chairs
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="11" rx="8" ry="4" />
          <path d="M12 15v6M8 21h8" />
          <path d="M4 11v-4a2 2 0 0 1 2-2M20 11v-4a2 2 0 0 0-2-2" />
        </svg>
      )

    case 'kitchens':
      // Professional Chef Toque / Kitchen Hat
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 18h12M6 18a4 4 0 0 1-2-7.5 5 5 0 0 1 9.5-3 5 5 0 0 1 6.5 6.5A4 4 0 0 1 18 18" />
          <path d="M7 18v3h10v-3" />
        </svg>
      )

    case 'products':
      // Product packaging box with ribbon
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      )

    case 'categories':
      // Category tag badges
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <circle cx="7" cy="7" r="1.5" fill="currentColor" />
        </svg>
      )

    case 'cakes':
      // Multi-layer celebration cake with candle
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7" />
          <path d="M4 17c1.5-1 3.5-1 5 0s3.5 1 5 0 3.5-1 6 0" />
          <path d="M2 21h20" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <circle cx="12" cy="5" r="1.5" fill="currentColor" />
        </svg>
      )

    case 'media':
      // Image gallery photo
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <circle cx="8.5" cy="8.5" r="2" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      )

    case 'billings':
      // POS billing invoice receipt
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 2 2V2l-2 2-3-2-3 2-3-2-3 2-3-2z" />
          <line x1="8" y1="8" x2="16" y2="8" />
          <line x1="8" y1="12" x2="16" y2="12" />
          <line x1="8" y1="16" x2="12" y2="16" />
        </svg>
      )

    case 'billing-customers':
    case 'customers':
      // Customer profile contacts
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )

    case 'closing-entries':
      // Cash register drawer / Daily audit book
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <polyline points="9 10 12 13 16 9" />
        </svg>
      )

    case 'manager-closing-replies':
      // Manager verified response bubble
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <polyline points="9 10 12 13 16 9" />
        </svg>
      )

    case 'stock-orders':
      // Stock dispatch truck
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13" rx="1" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      )

    case 'return-orders':
    case 'return-order':
    case 'dealer-orders':
      // Reverse stock return package
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          <rect x="9" y="9" width="6" height="6" rx="1" />
        </svg>
      )

    case 'stock-alerts':
      // Warning bell notification
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          <circle cx="12" cy="2" r="1" />
        </svg>
      )

    case 'instock-entries':
    case 'raw-material-instock-entries':
      // Warehouse pallet inbound entry
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="21 8 21 21 3 21 3 8" />
          <rect x="1" y="3" width="22" height="5" rx="1" />
          <line x1="12" y1="11" x2="12" y2="17" />
          <polyline points="9 14 12 17 15 14" />
        </svg>
      )

    case 'raw-materials':
    case 'raw-material-categories':
      // Ingredients flask & wheat
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" />
          <line x1="8.5" y1="2" x2="15.5" y2="2" />
          <line x1="7" y1="16" x2="17" y2="16" />
        </svg>
      )

    case 'dealers':
    case 'raw-material-dealers':
      // Business partnership handshake
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 11l2 2 4-4" />
          <path d="M18 20a6 6 0 0 0-6-6H4a2 2 0 0 0-2 2v4" />
          <circle cx="9" cy="7" r="4" />
        </svg>
      )

    case 'users':
      // Protected administrator profile
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      )

    case 'employees':
      // Staff lanyard identity badge
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <circle cx="9" cy="10" r="2.5" />
          <line x1="15" y1="8" x2="18" y2="8" />
          <line x1="15" y1="12" x2="18" y2="12" />
          <path d="M6 17a3 3 0 0 1 6 0" />
        </svg>
      )

    case 'attendance':
    case 'punch-in':
      // Biometric clock & calendar
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <circle cx="12" cy="15" r="3" />
          <polyline points="12 14 12 15 13.5 15" />
        </svg>
      )

    case 'waiter-calls':
    case 'call-logs':
      // Concierge table service bell
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          <path d="M12 2v2" />
          <line x1="19" y1="5" x2="21" y2="3" />
          <line x1="5" y1="5" x2="3" y2="3" />
        </svg>
      )

    case 'cctv-reports':
      // CCTV surveillance video camera
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" />
          <circle cx="8" cy="12" r="2" />
        </svg>
      )

    case 'reviews':
      // Star customer feedback rating
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      )

    case 'tasks':
    case 'task-columns':
    case 'task-completions':
      // Checked checklist
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      )

    case 'messages':
    case 'message-threads':
    case 'message-attachments':
    case 'message-receipts':
      // Discussion chat bubbles
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      )

    case 'production-requests':
      // Bakery production gear / factory
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" />
        </svg>
      )

    case 'expenses':
      // Expense payment wallet
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <circle cx="12" cy="12" r="2" />
          <path d="M6 12h.01M18 12h.01" />
        </svg>
      )

    case 'bank-statements':
      // Bank vault / pillars
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="21" x2="21" y2="21" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <polyline points="5 6 12 3 19 6" />
          <line x1="6" y1="10" x2="6" y2="21" />
          <line x1="10" y1="10" x2="10" y2="21" />
          <line x1="14" y1="10" x2="14" y2="21" />
          <line x1="18" y1="10" x2="18" y2="21" />
        </svg>
      )

    case 'apk-files':
      // Mobile app package / phone
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="2" width="14" height="20" rx="3" />
          <line x1="12" y1="18" x2="12.01" y2="18" />
          <path d="M9 11l3 3 3-3" />
          <line x1="12" y1="6" x2="12" y2="14" />
        </svg>
      )

    case 'report-card-rules':
      // Tuning sliders
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
        </svg>
      )

    default:
      // Universal modular cube
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      )
  }
}

const AdminCollectionsGrid: React.FC<AdminCollectionsGridProps> = ({
  groups,
  adminRoute = '/admin',
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL')

  const totalCollections = useMemo(() => {
    return groups.reduce((acc, g) => acc + g.entities.length, 0)
  }, [groups])

  // Filtered collections by search and active category tab
  const filteredGroups = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    return groups
      .filter((group) => {
        if (selectedGroup === 'ALL') return true
        return group.label === selectedGroup
      })
      .map((group) => {
        const matchingEntities = group.entities.filter((entity) => {
          if (!term) return true
          return (
            entity.label.toLowerCase().includes(term) ||
            entity.slug.toLowerCase().includes(term) ||
            group.label.toLowerCase().includes(term)
          )
        })
        return {
          ...group,
          entities: matchingEntities,
        }
      })
      .filter((group) => group.entities.length > 0)
  }, [groups, searchTerm, selectedGroup])

  const totalFilteredCount = useMemo(() => {
    return filteredGroups.reduce((acc, g) => acc + g.entities.length, 0)
  }, [filteredGroups])

  // Smart Layout:
  // 1. Groups with 2 or more collections come first (sorted descending by count to fill 4-per-row).
  // 2. Groups with only 1 collection are unified into a single continuous grid row/section
  //    so no card sits alone with huge empty whitespace on the right!
  const { multiGroups, singleEntities } = useMemo(() => {
    if (selectedGroup !== 'ALL' || searchTerm.trim()) {
      return {
        multiGroups: filteredGroups,
        singleEntities: [],
      }
    }

    const multi: (CollectionGroup & { entities: CollectionItem[] })[] = []
    const singles: (CollectionItem & { groupColor: string; groupBg: string })[] = []

    filteredGroups.forEach((group) => {
      if (group.entities.length >= 2) {
        multi.push(group)
      } else if (group.entities.length === 1) {
        const item = group.entities[0]
        singles.push({
          ...item,
          groupColor: group.color,
          groupBg: group.bgLight,
        })
      }
    })

    // Sort multi-item groups descending by count so full rows (4, 3 cards) render first
    multi.sort((a, b) => b.entities.length - a.entities.length)

    return {
      multiGroups: multi,
      singleEntities: singles,
    }
  }, [filteredGroups, selectedGroup, searchTerm])

  const normalizedAdminRoute = adminRoute === '/' ? '' : adminRoute.replace(/\/+$/, '')

  const renderCard = (
    item: CollectionItem,
    color: string,
    bgLight: string,
  ) => {
    const viewHref = `${normalizedAdminRoute}/collections/${item.slug}`
    const createHref = `${normalizedAdminRoute}/collections/${item.slug}/create`

    return (
      <div key={item.slug} className="bf-card">
        <Link href={viewHref} className="bf-card-main-link" title={`View ${item.label}`}>
          {/* Centered Large Icon */}
          <div className="bf-card-icon-wrap">
            <div
              className="bf-card-icon"
              style={{
                color: color,
                backgroundColor: bgLight,
              }}
            >
              {getCollectionIcon(item.slug)}
            </div>
          </div>

          {/* Centered Big Title and Slug Badge */}
          <div className="bf-card-body">
            <h3 className="bf-card-title">{item.label}</h3>
            <span className="bf-card-badge">{item.slug}</span>
          </div>
        </Link>

        {/* Action Buttons */}
        <div className="bf-card-footer">
          <Link href={viewHref} className="bf-card-action-btn bf-action-view">
            <span>Browse</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
          {item.canCreate !== false && (
            <Link
              href={createHref}
              className="bf-card-action-btn bf-action-create"
              title={`Create new ${item.label}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>New</span>
            </Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bf-collections-hub">
      {/* Google Analytics Style Hero Header */}
      <div className="bf-hub-header">
        <div className="bf-hub-header__left">
          <div className="bf-hub-badge">
            <span className="bf-hub-badge__dot"></span>
            Management Hub
          </div>
          <h1 className="bf-hub-title">Collections Overview</h1>
          <p className="bf-hub-subtitle">
            Browse, manage, and configure all system collections across {groups.length} business domains.
          </p>
        </div>

        {/* Quick Stats Pill */}
        <div className="bf-hub-stats">
          <div className="bf-stat-item">
            <span className="bf-stat-num">{totalCollections}</span>
            <span className="bf-stat-label">Total Collections</span>
          </div>
          <div className="bf-stat-divider" />
          <div className="bf-stat-item">
            <span className="bf-stat-num">{groups.length}</span>
            <span className="bf-stat-label">Categories</span>
          </div>
        </div>
      </div>

      {/* Control Bar: Search & Category Pills */}
      <div className="bf-hub-controls">
        <div className="bf-search-box">
          <svg className="bf-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="bf-search-input"
            placeholder="Search collections (e.g. Products, Companies, Billings)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              className="bf-search-clear"
              onClick={() => setSearchTerm('')}
              title="Clear search"
              type="button"
            >
              ✕
            </button>
          )}
        </div>

        {/* Group Filter Tabs */}
        <div className="bf-filter-tabs">
          <button
            type="button"
            className={`bf-tab-btn ${selectedGroup === 'ALL' ? 'active' : ''}`}
            onClick={() => setSelectedGroup('ALL')}
          >
            All <span className="bf-tab-count">{totalCollections}</span>
          </button>
          {groups.map((g) => (
            <button
              key={g.label}
              type="button"
              className={`bf-tab-btn ${selectedGroup === g.label ? 'active' : ''}`}
              onClick={() => setSelectedGroup(g.label)}
            >
              {g.label} <span className="bf-tab-count">{g.entities.length}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Results Count Banner if searching */}
      {searchTerm && (
        <div className="bf-search-results-banner">
          Showing <strong>{totalFilteredCount}</strong> matching collections for &quot;{searchTerm}&quot;
        </div>
      )}

      {/* Groups and Collections Big Grid */}
      <div className="bf-hub-groups">
        {filteredGroups.length === 0 ? (
          <div className="bf-empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <h3>No collections found</h3>
            <p>No collections match &quot;{searchTerm}&quot;. Try adjusting your keywords.</p>
            <button type="button" className="bf-reset-btn" onClick={() => setSearchTerm('')}>
              Clear Search Filter
            </button>
          </div>
        ) : (
          <>
            {/* Multi-Item Groups Render First (4, 3, 2 cards per category) */}
            {multiGroups.map((group) => (
              <section key={group.label} className="bf-group-section">
                <div className="bf-group-header">
                  <div className="bf-group-title-wrap">
                    <span className="bf-group-accent-bar" style={{ backgroundColor: group.color }} />
                    <h2 className="bf-group-title">{group.label}</h2>
                    <span className="bf-group-count">{group.entities.length}</span>
                  </div>
                </div>

                <div className="bf-cards-grid">
                  {group.entities.map((item) =>
                    renderCard(item, group.color, group.bgLight)
                  )}
                </div>
              </section>
            ))}

            {/* Single Collections Unified Section (No empty whitespace!) */}
            {singleEntities.length > 0 && (
              <section className="bf-group-section bf-group-section--singles">
                <div className="bf-group-header">
                  <div className="bf-group-title-wrap">
                    <span className="bf-group-accent-bar" style={{ backgroundColor: '#1a73e8' }} />
                    <h2 className="bf-group-title">Other Collections</h2>
                    <span className="bf-group-count">{singleEntities.length}</span>
                  </div>
                </div>

                <div className="bf-cards-grid">
                  {singleEntities.map((item) =>
                    renderCard(item, item.groupColor, item.groupBg)
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default AdminCollectionsGrid