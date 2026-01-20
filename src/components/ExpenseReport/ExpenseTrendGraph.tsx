'use client'

import React, { useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import dayjs from 'dayjs'
import { Check } from 'lucide-react'
import { BranchGroup, ExpenseItem } from './index'

interface ExpenseTrendGraphProps {
  groups: BranchGroup[]
  preset?: string
}

const CATEGORY_COLORS: Record<string, string> = {
  'RAW MATERIAL': '#8b5cf6',
  MAINTENANCE: '#10b981',
  TRANSPORT: '#f59e0b',
  FUEL: '#ef4444',
  'STAFF WELFARE': '#3b82f6',
  Supplies: '#ec4899',
  PACKING: '#06b6d4',
  OTHERS: '#71717a',
}

const DEFAULT_COLOR = '#94a3b8'

const ExpenseTrendGraph: React.FC<ExpenseTrendGraphProps> = ({ groups, preset }) => {
  // Extract all unique categories present in the data
  const allCategories = useMemo(() => {
    const categories = new Set<string>()
    groups.forEach((group: BranchGroup) => {
      group.items.forEach((item: ExpenseItem) => categories.add(item.category))
    })
    return Array.from(categories).sort()
  }, [groups])

  // State for toggling category visibility on the graph
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    // Show top few categories by default, or all if few enough
    // For now, let's show all by default
    groups.forEach((group: BranchGroup) => {
      group.items.forEach((item: ExpenseItem) => {
        initial[item.category] = true
      })
    })
    return initial
  })

  const toggleVisibility = (category: string) => {
    setVisibility((prev) => ({ ...prev, [category]: !prev[category] }))
  }

  // Aggregate data by hour and category
  const aggregatedData = useMemo(() => {
    const timeBuckets: Record<string, any> = {}

    groups.forEach((group: BranchGroup) => {
      group.items.forEach((item: ExpenseItem) => {
        if (!item.time) return

        // Bucket by hour (e.g., "2026-01-20 14:00")
        const bucketKey = dayjs(item.time).format('YYYY-MM-DD HH:00')

        if (!timeBuckets[bucketKey]) {
          timeBuckets[bucketKey] = {
            time: bucketKey,
            timestamp: dayjs(bucketKey).valueOf(),
            displayTime: dayjs(bucketKey).format('HH:mm'),
            displayDate: dayjs(bucketKey).format('MM-DD'),
            breakdown: {},
          }
          // Initialize categories with 0
          allCategories.forEach((cat: string) => {
            timeBuckets[bucketKey][cat] = 0
            timeBuckets[bucketKey].breakdown[cat] = {}
          })
        }

        timeBuckets[bucketKey][item.category] += item.amount

        // Branch breakdown for tooltip
        if (!timeBuckets[bucketKey].breakdown[item.category][group.branchName]) {
          timeBuckets[bucketKey].breakdown[item.category][group.branchName] = 0
        }
        timeBuckets[bucketKey].breakdown[item.category][group.branchName] += item.amount
      })
    })

    return Object.values(timeBuckets).sort((a, b) => a.timestamp - b.timestamp)
  }, [groups, allCategories])

  // Calculate totals for summary cards
  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    groups.forEach((group: BranchGroup) => {
      group.items.forEach((item: ExpenseItem) => {
        totals[item.category] = (totals[item.category] || 0) + item.amount
      })
    })
    return totals
  }, [groups])

  if (aggregatedData.length === 0) return null

  const SummaryCard = ({ category, total }: { category: string; total: number }) => {
    const active = visibility[category]
    const color = CATEGORY_COLORS[category] || DEFAULT_COLOR

    return (
      <div
        onClick={() => toggleVisibility(category)}
        className="summary-card"
        style={{
          backgroundColor: active ? color : 'transparent',
          borderColor: active ? color : '#3f3f46',
          cursor: 'pointer',
          padding: '12px 16px',
          borderRadius: '8px',
          borderWidth: '1px',
          borderStyle: 'solid',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          minWidth: '160px',
          transition: 'all 0.2s ease',
          boxShadow: active ? `0 4px 12px rgba(0,0,0,0.2)` : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '14px',
              height: '14px',
              borderRadius: '3px',
              border: `2px solid ${active ? '#fff' : color}`,
              backgroundColor: active ? '#fff' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {active && <Check size={10} color={color} strokeWidth={4} />}
          </div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: '600',
              textTransform: 'uppercase',
              color: active ? '#fff' : '#a1a1aa',
            }}
          >
            {category}
          </span>
        </div>
        <span
          style={{
            fontSize: '18px',
            fontWeight: 'bold',
            color: active ? '#fff' : '#fcf8ef',
          }}
        >
          ₹{total.toLocaleString('en-IN')}
        </span>
      </div>
    )
  }

  const isTimeOnly = preset === 'today' || preset === 'yesterday'

  return (
    <div
      className="expense-trend-container"
      style={{
        marginTop: '3rem',
        marginBottom: '4rem',
        width: '100%',
      }}
    >
      <h3
        style={{
          marginTop: 0,
          marginBottom: '1.5rem',
          fontSize: '1.1rem',
          fontWeight: '600',
          color: 'var(--theme-text-primary)',
          opacity: 0.9,
        }}
      >
        Spending Trend
      </h3>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
        {allCategories.map((cat) => (
          <SummaryCard key={cat} category={cat} total={categoryTotals[cat]} />
        ))}
      </div>

      <div style={{ height: '400px', width: '100%', marginLeft: '-25px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={aggregatedData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="var(--theme-elevation-400)"
              opacity={0.2}
            />
            <XAxis
              dataKey={isTimeOnly ? 'displayTime' : 'displayDate'}
              tick={{ fill: '#e4e4e7', fontSize: 11, fontWeight: '500' }}
              axisLine={{ stroke: 'var(--theme-elevation-400)' }}
              tickLine={false}
              dy={10}
            />
            <YAxis
              tick={{ fill: '#e4e4e7', fontSize: 11, fontWeight: '500' }}
              axisLine={false}
              tickLine={false}
              width={75}
              tickFormatter={(val) => `₹${val.toLocaleString()}`}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload
                  return (
                    <div
                      style={{
                        backgroundColor: 'var(--theme-elevation-100)',
                        border: '1px solid var(--theme-elevation-300)',
                        borderRadius: '8px',
                        padding: '1rem',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4)',
                        minWidth: '240px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 'bold',
                          color: 'var(--theme-text-primary)',
                          marginBottom: '0.75rem',
                          borderBottom: '1px solid var(--theme-elevation-200)',
                          paddingBottom: '0.5rem',
                        }}
                      >
                        Time: {label}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {payload.map((p: any) => {
                          const cat = p.name
                          const branchData = data.breakdown[cat] || {}
                          return (
                            <div
                              key={cat}
                              style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  fontSize: '0.85rem',
                                }}
                              >
                                <span style={{ color: p.color, fontWeight: 'bold' }}>{cat}:</span>
                                <span style={{ color: '#fff' }}>
                                  ₹{p.value.toLocaleString('en-IN')}
                                </span>
                              </div>
                              {Object.entries(branchData).map(([branch, amount]: [string, any]) => (
                                <div
                                  key={branch}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    fontSize: '0.75rem',
                                    paddingLeft: '1rem',
                                    color: 'var(--theme-text-secondary)',
                                  }}
                                >
                                  <span>{branch}</span>
                                  <span>₹{amount.toLocaleString('en-IN')}</span>
                                </div>
                              ))}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                }
                return null
              }}
            />
            {allCategories.map(
              (cat) =>
                visibility[cat] && (
                  <Line
                    key={cat}
                    type="monotone"
                    dataKey={cat}
                    name={cat}
                    stroke={CATEGORY_COLORS[cat] || DEFAULT_COLOR}
                    strokeWidth={3}
                    dot={{ r: 0 }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    animationDuration={500}
                  />
                ),
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default ExpenseTrendGraph
