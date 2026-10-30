'use client'

import React, { useState, useMemo } from 'react'
import { Gutter } from '@payloadcms/ui'
import {
  LayoutDashboard,
  Receipt,
  PieChart,
  BarChart3,
  Clock,
  Hourglass,
  Lock,
  Users,
  ChefHat,
  Award,
  LineChart,
  CalendarCheck,
  CreditCard,
  HeartHandshake,
  Star,
  Truck,
  Boxes,
  Undo2,
  FileText,
  Calculator,
  Landmark,
  Warehouse,
  Store,
  PackageSearch,
  Coins,
  Wheat,
  UploadCloud,
  MessagesSquare,
  Search,
  ArrowRight,
  ExternalLink,
  Sparkles,
  TrendingUp,
  Layers,
  CheckCircle2,
} from 'lucide-react'
import './index.scss'

export interface ReportItem {
  id: string
  title: string
  menuLabel: string
  slug: string
  href: string
  group: 'Report' | 'Account' | 'Collections'
  category:
    | 'Sales & Billing'
    | 'Operations & Kitchen'
    | 'Inventory & Stock'
    | 'Staff & Tracking'
    | 'Accounts & Taxes'
    | 'Raw Materials & Factory'
    | 'Customer Insights'
  description: string
  tags: string[]
  icon: React.ElementType
  accentColor: string
  popular?: boolean
}

const ALL_REPORTS: ReportItem[] = [
  // --- Sales & Billing ---
  {
    id: 'branch-billing-report',
    title: 'Branch Billing Reports',
    menuLabel: 'Billing Reports',
    slug: 'branch-billing-report',
    href: '/admin/globals/branch-billing-report',
    group: 'Report',
    category: 'Sales & Billing',
    description:
      'Live store sales performance, payment splits across Cash, UPI, Card, Swiggy, and Zomato, with monthly revenue trends.',
    tags: ['Cash', 'UPI', 'Card', 'Revenue', 'Store Sales'],
    icon: Receipt,
    accentColor: '#10B981', // emerald
    popular: true,
  },
  {
    id: 'time-wise-report',
    title: 'Time-Wise Sales Analysis',
    menuLabel: 'Time-Wise Report',
    slug: 'time-wise-report',
    href: '/admin/globals/time-wise-report',
    group: 'Report',
    category: 'Sales & Billing',
    description:
      'Hourly sales distributions, rush-hour peak times, customer traffic influx, and time-slot based revenue analytics.',
    tags: ['Hourly Trends', 'Peak Hours', 'Order Influx'],
    icon: Hourglass,
    accentColor: '#06B6D4', // cyan
  },
  {
    id: 'report-graph',
    title: 'Visual Revenue Trends & Charts',
    menuLabel: 'Report Graph',
    slug: 'report-graph',
    href: '/admin/globals/report-graph',
    group: 'Report',
    category: 'Sales & Billing',
    description:
      'High-level graphical charts, sales momentum, monthly growth curves, and cross-branch visual comparisons.',
    tags: ['Charts', 'Sales Graph', 'Trends', 'Visuals'],
    icon: LineChart,
    accentColor: '#8B5CF6', // purple
  },
  {
    id: 'category-wise-report',
    title: 'Category-Wise Sales Report',
    menuLabel: 'Category Wise',
    slug: 'category-wise-report',
    href: '/admin/globals/category-wise-report',
    group: 'Report',
    category: 'Sales & Billing',
    description:
      'Units sold and total turnover grouped by product categories (Cakes, Pastries, Savouries, Beverages) across all stores.',
    tags: ['Categories', 'Item Turnover', 'Product Mix'],
    icon: PieChart,
    accentColor: '#F59E0B', // amber
    popular: true,
  },
  {
    id: 'product-wise-report',
    title: 'Product-Wise Sales & Volume',
    menuLabel: 'Product Wise',
    slug: 'product-wise-report',
    href: '/admin/globals/product-wise-report',
    group: 'Report',
    category: 'Sales & Billing',
    description:
      'Detailed item-level sales rankings, units sold, best-performing cakes and snacks, and branch sales contribution.',
    tags: ['Top Sellers', 'Units Sold', 'Item Ranking'],
    icon: BarChart3,
    accentColor: '#6366F1', // indigo
  },

  // --- Operations & Kitchen ---
  {
    id: 'closing-entry-report',
    title: 'Daily Store Closing Report',
    menuLabel: 'Closing Report',
    slug: 'closing-entry-report',
    href: '/admin/globals/closing-entry-report',
    group: 'Report',
    category: 'Operations & Kitchen',
    description:
      'End-of-day register closing entries, physical cash denomination tally, system vs manual sales reconciliation, and manager sign-offs.',
    tags: ['Cash Drawer', 'Reconciliation', 'Manager Closing', 'Denominations'],
    icon: Lock,
    accentColor: '#F43F5E', // rose
    popular: true,
  },
  {
    id: 'chef-report',
    title: 'Kitchen & Chef Performance',
    menuLabel: 'Chef Report',
    slug: 'chef-report',
    href: '/admin/globals/chef-report',
    group: 'Report',
    category: 'Operations & Kitchen',
    description:
      'Live kitchen station production metrics, KOT order preparation latency, delayed order alerts, and chef workload analytics.',
    tags: ['KOT Times', 'Kitchen Stations', 'Chef Latency'],
    icon: ChefHat,
    accentColor: '#EA580C', // orange
  },
  {
    id: 'product-time-report',
    title: 'Product Preparation Time Report',
    menuLabel: 'Product Time',
    slug: 'product-time-report',
    href: '/admin/globals/product-time-report',
    group: 'Report',
    category: 'Operations & Kitchen',
    description:
      'Preparation duration analysis per product, fulfillment speed benchmarks, and kitchen throughput bottlenecks.',
    tags: ['Preparation Speed', 'Order Latency', 'Bottlenecks'],
    icon: Clock,
    accentColor: '#0EA5E9', // sky
  },
  {
    id: 'messages-chat',
    title: 'Internal Branch Message Chat',
    menuLabel: 'Message Chat',
    slug: 'messages-chat',
    href: '/admin/globals/messages-chat',
    group: 'Account',
    category: 'Operations & Kitchen',
    description:
      'Internal staff announcements, branch communication logs, operational notices, and supervisor messaging.',
    tags: ['Communication', 'Branch Notices', 'Chat'],
    icon: MessagesSquare,
    accentColor: '#3B82F6', // blue
  },

  // --- Inventory & Stock ---
  {
    id: 'general-dashboard',
    title: 'Overall Stock & Inventory Status',
    menuLabel: 'Overall',
    slug: 'general-dashboard',
    href: '/admin/globals/general-dashboard',
    group: 'Report',
    category: 'Inventory & Stock',
    description:
      'Complete stock overview table: Starting Instock (OIS), Received (REC), Returned (RTN), Total Available (TOT), Billing (BILL), and Current Instock (CIS).',
    tags: ['OIS', 'REC', 'RTN', 'TOT', 'BILL', 'CIS'],
    icon: LayoutDashboard,
    accentColor: '#38BDF8', // light blue
    popular: true,
  },
  {
    id: 'stock-order-report',
    title: 'Branch Stock Order & Dispatch',
    menuLabel: 'Stock Order Report',
    slug: 'stock-order-report',
    href: '/admin/globals/stock-order-report',
    group: 'Report',
    category: 'Inventory & Stock',
    description:
      'Inter-branch stock transfers, central warehouse supply dispatches, order picking, and transfer fulfillment tracking.',
    tags: ['Stock Transfer', 'Warehouse Dispatch', 'Fulfillment'],
    icon: Truck,
    accentColor: '#64748B', // slate
  },
  {
    id: 'instock-entry-report',
    title: 'Morning Stock Intake & Verification',
    menuLabel: 'Instock Entry Report',
    slug: 'instock-entry-report',
    href: '/admin/globals/instock-entry-report',
    group: 'Report',
    category: 'Inventory & Stock',
    description:
      'Morning fresh delivery intake records, received quantities verification, damaged stock deductions, and confirmation logs.',
    tags: ['Morning Intake', 'Received Goods', 'Verification'],
    icon: Boxes,
    accentColor: '#22C55E', // green
  },
  {
    id: 'return-order-report',
    title: 'Damaged & Return Goods Report',
    menuLabel: 'Return Order Report',
    slug: 'return-order-report',
    href: '/admin/globals/return-order-report',
    group: 'Report',
    category: 'Inventory & Stock',
    description:
      'Damaged items, stale or expired returns, return causes, credit notes, and store loss tracking.',
    tags: ['Returns', 'Damaged Goods', 'Expired Items', 'Wastage'],
    icon: Undo2,
    accentColor: '#F97316', // orange
  },
  {
    id: 'inventory-report',
    title: 'Central Warehouse Inventory Ledger',
    menuLabel: 'Inventory Report',
    slug: 'inventory-report',
    href: '/admin/globals/inventory-report',
    group: 'Account',
    category: 'Inventory & Stock',
    description:
      'Comprehensive inventory ledger, warehouse valuation, batch tracking, reorder thresholds, and current asset worth.',
    tags: ['Ledger', 'Valuation', 'Stock Balance', 'Asset Value'],
    icon: Warehouse,
    accentColor: '#A855F7', // purple
  },
  {
    id: 'dealer-report',
    title: 'Third-Party Products & Dealer Orders',
    menuLabel: 'Other Products',
    slug: 'dealer-report',
    href: '/admin/globals/dealer-report',
    group: 'Account',
    category: 'Inventory & Stock',
    description:
      'Third-party supplier procurement, FMCG dealer purchase orders, invoices, and external vendor delivery audits.',
    tags: ['Dealers', 'Supplier Bills', 'Third-Party Items'],
    icon: Store,
    accentColor: '#06B6D4', // cyan
  },
  {
    id: 'other-products-inventory-report',
    title: 'Other Products Stock & Inventory',
    menuLabel: 'Other Products Inventory',
    slug: 'other-products-inventory-report',
    href: '/admin/globals/other-products-inventory-report',
    group: 'Account',
    category: 'Inventory & Stock',
    description:
      'Stock counts, opening/closing balance, and sale numbers for retail / FMCG packaged goods, drinks, and chips.',
    tags: ['Retail Goods', 'Packaged Items', 'FMCG Stock'],
    icon: PackageSearch,
    accentColor: '#38BDF8', // sky
  },

  // --- Staff & Tracking ---
  {
    id: 'attendance-report',
    title: 'Staff Attendance & Punch Records',
    menuLabel: 'Attendance Report',
    slug: 'attendance-report',
    href: '/admin/globals/attendance-report',
    group: 'Report',
    category: 'Staff & Tracking',
    description:
      'Daily staff punch-in logs, biometric/photo timestamps, late arrivals, shift working hours, and branch employee attendance.',
    tags: ['Punch-In', 'Late Arrivals', 'Working Hours', 'Shifts'],
    icon: CalendarCheck,
    accentColor: '#14B8A6', // teal
    popular: true,
  },
  {
    id: 'waiter-wise-billing-report',
    title: 'Waiter-Wise Sales & Efficiency',
    menuLabel: 'Waiter Wise',
    slug: 'waiter-wise-billing-report',
    href: '/admin/globals/waiter-wise-billing-report',
    group: 'Report',
    category: 'Staff & Tracking',
    description:
      'Orders taken, bills generated, customer settlement metrics, and sales contribution broken down by waiter.',
    tags: ['Waiter Sales', 'Table Service', 'Staff Revenue'],
    icon: Users,
    accentColor: '#4F46E5', // indigo
  },
  {
    id: 'report-card',
    title: 'Branch Performance Report Card',
    menuLabel: 'Report Card',
    slug: 'report-card',
    href: '/admin/globals/report-card',
    group: 'Report',
    category: 'Staff & Tracking',
    description:
      'Automated KPI scoring, branch grading metrics, rule compliance evaluations, and operational performance benchmarks.',
    tags: ['KPI Scores', 'Branch Grading', 'Operational Rules'],
    icon: Award,
    accentColor: '#EAB308', // yellow
  },

  // --- Accounts & Taxes ---
  {
    id: 'accounts-bills-report',
    title: 'All Bills Transaction Ledger',
    menuLabel: 'All Bills Report',
    slug: 'accounts-bills-report',
    href: '/admin/globals/accounts-bills-report',
    group: 'Account',
    category: 'Accounts & Taxes',
    description:
      'Auditing ledger of all customer bills, payment methods, transaction reference IDs, and verification statuses.',
    tags: ['All Bills', 'Auditing', 'Payment Verification', 'Transaction IDs'],
    icon: FileText,
    accentColor: '#2563EB', // blue
    popular: true,
  },
  {
    id: 'bill-summary',
    title: 'Consolidated Billing Summary',
    menuLabel: 'Bill Summary',
    slug: 'bill-summary',
    href: '/admin/globals/bill-summary',
    group: 'Account',
    category: 'Accounts & Taxes',
    description:
      'High-level daily financial summaries, bill counts, average customer ticket values, and aggregated totals per branch.',
    tags: ['Daily Aggregates', 'Average Bill', 'Turnover'],
    icon: Calculator,
    accentColor: '#10B981', // emerald
  },
  {
    id: 'gst-report',
    title: 'GST Tax Compliance & Filing',
    menuLabel: 'GST Report',
    slug: 'gst-report',
    href: '/admin/globals/gst-report',
    group: 'Account',
    category: 'Accounts & Taxes',
    description:
      'Monthly/quarterly tax filing figures, CGST, SGST, IGST calculations, taxable value totals, and B2B/B2C invoice summaries.',
    tags: ['Tax Filing', 'CGST', 'SGST', 'HSN Wise', 'Compliance'],
    icon: Landmark,
    accentColor: '#6366F1', // indigo
    popular: true,
  },
  {
    id: 'expense-report',
    title: 'Store Operational Expenses',
    menuLabel: 'Expense Reports',
    slug: 'expense-report',
    href: '/admin/globals/expense-report',
    group: 'Report',
    category: 'Accounts & Taxes',
    description:
      'Daily store petty cash expenses, repair costs, utility payments, vendor bills, and categorical expense distribution.',
    tags: ['Petty Cash', 'Vendor Payments', 'Repairs', 'Utilities'],
    icon: CreditCard,
    accentColor: '#EF4444', // red
  },
  {
    id: 'bank-statement-upload',
    title: 'Bank Statement Auto-Reconciliation',
    menuLabel: 'Bank Statement Upload',
    slug: 'bank-statement-upload',
    href: '/admin/globals/bank-statement-upload',
    group: 'Account',
    category: 'Accounts & Taxes',
    description:
      'Upload bank statement spreadsheets (CSV/Excel) to automatically match settlement payouts against POS UPI and Card receipts.',
    tags: ['Bank CSV', 'UPI Payouts', 'Card Settlement', 'Reconciliation'],
    icon: UploadCloud,
    accentColor: '#475569', // slate
  },

  // --- Raw Materials & Factory ---
  {
    id: 'raw-material-billing-report',
    title: 'Raw Material Purchases & Invoices',
    menuLabel: 'Raw Material',
    slug: 'raw-material-billing-report',
    href: '/admin/globals/raw-material-billing-report',
    group: 'Account',
    category: 'Raw Materials & Factory',
    description:
      'Central kitchen raw material purchase bills, ingredient procurement invoices, dealer payments, and manufacturing costs.',
    tags: ['Ingredient Purchases', 'Factory Invoices', 'Supplier Bills'],
    icon: Coins,
    accentColor: '#D97706', // amber
  },
  {
    id: 'raw-material-inventory-report',
    title: 'Raw Material Stock & Consumption',
    menuLabel: 'Raw Material Inventory',
    slug: 'raw-material-inventory-report',
    href: '/admin/globals/raw-material-inventory-report',
    group: 'Account',
    category: 'Raw Materials & Factory',
    description:
      'Flour, sugar, dairy, chocolate, and packaging inventory balances, usage rates, spoilage logs, and reorder levels.',
    tags: ['Baking Ingredients', 'Consumption', 'Stock Alerts', 'Factory Stock'],
    icon: Wheat,
    accentColor: '#CA8A04', // yellow
  },

  // --- Customer Insights ---
  {
    id: 'afterstock-customer-report',
    title: 'Customer Frequency & Loyalty Report',
    menuLabel: 'Customer Report',
    slug: 'afterstock-customer-report',
    href: '/admin/globals/afterstock-customer-report',
    group: 'Report',
    category: 'Customer Insights',
    description:
      'Customer order counts, repeat visit frequencies, top patrons, lifetime value calculations, and loyalty patterns.',
    tags: ['Customer Retention', 'Repeat Visits', 'Patron Profiles'],
    icon: HeartHandshake,
    accentColor: '#EC4899', // pink
  },
  {
    id: 'review-report',
    title: 'Customer Feedback & Ratings Report',
    menuLabel: 'Review Report',
    slug: 'review-report',
    href: '/admin/globals/review-report',
    group: 'Report',
    category: 'Customer Insights',
    description:
      'Table dining reviews, customer star ratings, feedback sentiments, food quality evaluations, and service compliments.',
    tags: ['Ratings', 'Feedback Sentiment', 'Customer Comments'],
    icon: Star,
    accentColor: '#F59E0B', // amber
  },
]

const CATEGORIES = [
  'All Reports',
  'Sales & Billing',
  'Operations & Kitchen',
  'Inventory & Stock',
  'Staff & Tracking',
  'Accounts & Taxes',
  'Raw Materials & Factory',
  'Customer Insights',
] as const

const ReportsDashboard: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('All Reports')

  // Filter reports
  const filteredReports = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    return ALL_REPORTS.filter((report) => {
      // Category match
      if (activeCategory !== 'All Reports' && report.category !== activeCategory) {
        return false
      }

      // Search match
      if (!term) return true

      const matchTitle = report.title.toLowerCase().includes(term)
      const matchMenu = report.menuLabel.toLowerCase().includes(term)
      const matchDesc = report.description.toLowerCase().includes(term)
      const matchTags = report.tags.some((t) => t.toLowerCase().includes(term))
      const matchCat = report.category.toLowerCase().includes(term)

      return matchTitle || matchMenu || matchDesc || matchTags || matchCat
    })
  }, [searchTerm, activeCategory])

  // Count by category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { 'All Reports': ALL_REPORTS.length }
    for (const report of ALL_REPORTS) {
      counts[report.category] = (counts[report.category] || 0) + 1
    }
    return counts
  }, [])

  const popularReports = useMemo(() => {
    return ALL_REPORTS.filter((r) => r.popular)
  }, [])

  return (
    <div className="reports-dashboard-root">
      <Gutter className="reports-dashboard-gutter">
        {/* Top Header Banner */}
        <header className="dashboard-hero">
          <div className="hero-text-block">
            <div className="badge-pill">
              <Sparkles size={14} className="sparkle-icon" />
              <span>Executive Overview</span>
            </div>
            <h1 className="hero-heading">Central Reports Dashboard</h1>
            <p className="hero-subheading">
              Access every branch metric, revenue stream, inventory tally, and financial audit in one
              place. Click any report below to open its dedicated view with live filters.
            </p>
          </div>

          <div className="hero-stats-row">
            <div className="stat-card">
              <div className="stat-value">{ALL_REPORTS.length}</div>
              <div className="stat-label">Total Reports</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{CATEGORIES.length - 1}</div>
              <div className="stat-label">Categories</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">100%</div>
              <div className="stat-label">Live Sync</div>
            </div>
          </div>
        </header>

        {/* Quick Access Popular Reports */}
        {!searchTerm && activeCategory === 'All Reports' && (
          <section className="popular-section">
            <div className="section-header-row">
              <div className="section-title-wrap">
                <TrendingUp size={18} className="section-icon text-cyan" />
                <h2 className="section-title">Frequently Accessed Reports</h2>
              </div>
              <span className="section-caption">Instant shortcuts to daily operations</span>
            </div>

            <div className="popular-grid">
              {popularReports.map((report) => {
                const IconComponent = report.icon
                return (
                  <a
                    key={report.id}
                    href={report.href}
                    className="popular-card"
                    style={{ '--accent': report.accentColor } as React.CSSProperties}
                  >
                    <div className="popular-icon-wrap">
                      <IconComponent size={20} />
                    </div>
                    <div className="popular-info">
                      <div className="popular-title">{report.menuLabel}</div>
                      <div className="popular-category">{report.category}</div>
                    </div>
                    <ArrowRight size={16} className="popular-arrow" />
                  </a>
                )
              })}
            </div>
          </section>
        )}

        {/* Search and Category Filters */}
        <section className="controls-bar">
          <div className="search-input-wrap">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search reports by name, metric, cash, stock, gst, or tag..."
              className="search-input"
            />
            {searchTerm && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchTerm('')}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="category-scroll-strip">
            {CATEGORIES.map((cat) => {
              const count = categoryCounts[cat] || 0
              const isActive = activeCategory === cat
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`category-pill ${isActive ? 'active' : ''}`}
                >
                  <span>{cat}</span>
                  <span className="pill-count">{count}</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Report Cards Grid */}
        <main className="reports-catalog">
          <div className="catalog-header">
            <h2 className="catalog-title">
              {activeCategory === 'All Reports' ? 'All Available Reports' : activeCategory}
              <span className="catalog-counter">({filteredReports.length})</span>
            </h2>
            <p className="catalog-hint">
              Click any card to open its separate report page, or use the corner icon to open in a new tab.
            </p>
          </div>

          {filteredReports.length === 0 ? (
            <div className="empty-catalog-state">
              <Layers size={48} className="empty-icon" />
              <h3>No matching reports found</h3>
              <p>
                We could not find any reports matching &quot;{searchTerm}&quot; in{' '}
                {activeCategory}.
              </p>
              <button
                type="button"
                className="reset-filters-btn"
                onClick={() => {
                  setSearchTerm('')
                  setActiveCategory('All Reports')
                }}
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="reports-grid">
              {filteredReports.map((report) => {
                const IconComponent = report.icon
                return (
                  <div
                    key={report.id}
                    className="report-card-container"
                    style={{ '--card-accent': report.accentColor } as React.CSSProperties}
                  >
                    <a
                      href={report.href}
                      className="report-card-link"
                      title={`Open ${report.title}`}
                    >
                      <div className="card-top-row">
                        <div className="card-icon-bubble">
                          <IconComponent size={22} />
                        </div>
                        <div className="card-header-actions">
                          <span className="card-category-tag">{report.category}</span>
                          <button
                            type="button"
                            className="new-tab-btn"
                            title="Open in new browser tab"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              window.open(report.href, '_blank', 'noopener,noreferrer')
                            }}
                          >
                            <ExternalLink size={15} />
                          </button>
                        </div>
                      </div>

                      <div className="card-body">
                        <div className="card-menu-indicator">
                          <span className="menu-dot" />
                          <span className="menu-label-text">
                            Menu: <strong>{report.menuLabel}</strong>
                          </span>
                        </div>
                        <h3 className="card-title">{report.title}</h3>
                        <p className="card-description">{report.description}</p>
                      </div>

                      <div className="card-tags-list">
                        {report.tags.map((tag) => (
                          <span key={tag} className="tag-chip">
                            {tag}
                          </span>
                        ))}
                      </div>

                      <div className="card-footer">
                        <span className="open-report-text">
                          Open Report Page
                          <ArrowRight size={15} className="arrow-slide" />
                        </span>
                        <span className="route-badge">
                          /admin/globals/{report.slug}
                        </span>
                      </div>
                    </a>
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </Gutter>
    </div>
  )
}

export default ReportsDashboard
