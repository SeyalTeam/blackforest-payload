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
  Legend,
} from 'recharts'
import dayjs from 'dayjs'
import { Check } from 'lucide-react'

// Define the shape of the data item based on usage in index.tsx
// Ideally this should be imported from types, but for now we define it here based on usage
// Define the shape of the data item based on usage in index.tsx
// Ideally this should be imported from types, but for now we define it here based on usage
export interface StockReportItem {
  ordQty: number
  ordTime?: string
  sntQty: number
  sntTime?: string
  conQty: number
  conTime?: string
  picQty: number
  picTime?: string
  recQty: number
  recTime?: string
  difQty: number
  price: number
  branchName: string
  // Add other fields if necessary
}

interface StockOrderGraphProps {
  items: StockReportItem[]
}

const StockOrderGraph: React.FC<StockOrderGraphProps> = ({ items }) => {
  const [visibility, setVisibility] = useState({
    ord: true,
    snt: true,
    con: true,
    pic: true,
    rec: true,
  })

  const toggleVisibility = (key: keyof typeof visibility) => {
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Aggregate data by time
  const aggregatedData = useMemo(() => {
    // We want to verify the trend of SNT, CON, PIC, REC over time.
    // Since each stage happens at a different time, we can normalize to a common timeline
    // OR we can plot them on their respective times.
    // For a "trend" of total volume processed over the day, we can bucket by hour of the day.

    interface BucketValue {
      time: string
      timestamp: number
      ord: number
      snt: number
      con: number
      pic: number
      rec: number
      dif: number
      breakdown: {
        ord: Record<string, number>
        snt: Record<string, number>
        con: Record<string, number>
        pic: Record<string, number>
        rec: Record<string, number>
        dif: Record<string, number>
      }
    }

    const timeBuckets: Record<string, BucketValue> = {}

    const addToBucket = (
      isoTime: string | undefined,
      type: 'ord' | 'snt' | 'con' | 'pic' | 'rec' | 'dif',
      qty: number,
      price: number,
      branch: string,
    ) => {
      if (!isoTime) return
      // Bucket by hour, e.g., "2023-10-27 10:00"
      const bucketKey = dayjs(isoTime).format('YYYY-MM-DD HH:00')

      if (!timeBuckets[bucketKey]) {
        timeBuckets[bucketKey] = {
          time: bucketKey,
          timestamp: dayjs(bucketKey).valueOf(),
          ord: 0,
          snt: 0,
          con: 0,
          pic: 0,
          rec: 0,
          dif: 0,
          breakdown: { ord: {}, snt: {}, con: {}, pic: {}, rec: {}, dif: {} },
        }
      }
      const val = qty * price
      timeBuckets[bucketKey][type] += val

      // Add to breakdown
      if (!timeBuckets[bucketKey].breakdown[type][branch]) {
        timeBuckets[bucketKey].breakdown[type][branch] = 0
      }
      timeBuckets[bucketKey].breakdown[type][branch] += val
    }

    items.forEach((item) => {
      addToBucket(item.ordTime, 'ord', item.ordQty, item.price, item.branchName)
      addToBucket(item.sntTime, 'snt', item.sntQty, item.price, item.branchName)
      addToBucket(item.conTime, 'con', item.conQty, item.price, item.branchName)
      addToBucket(item.picTime, 'pic', item.picQty, item.price, item.branchName)
      addToBucket(item.recTime, 'rec', item.recQty, item.price, item.branchName)
      // For DIF, we use recTime as the timestamp, or maybe ordTime?
      // Usually DIF is calculated at the end, so recTime is appropriate.
      // If recTime is missing, fallback to others or current time?
      // Safe to use recTime or fallback to ordTime.
      const time = item.recTime || item.picTime || item.conTime || item.sntTime || item.ordTime
      addToBucket(time, 'dif', item.difQty, item.price, item.branchName)
    })

    // Convert to array and sort by time
    return Object.values(timeBuckets)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((bucket) => ({
        ...bucket,
        displayTime: dayjs(bucket.time).format('HH:mm'),
      }))
  }, [items])

  // Calculate totals for summary cards
  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => ({
        ord: acc.ord + item.ordQty * item.price,
        snt: acc.snt + item.sntQty * item.price,
        con: acc.con + item.conQty * item.price,
        pic: acc.pic + item.picQty * item.price,
        rec: acc.rec + item.recQty * item.price,
      }),
      { ord: 0, snt: 0, con: 0, pic: 0, rec: 0 },
    )
  }, [items])

  if (aggregatedData.length === 0) return null

  // Google Search Console style cards
  const SummaryCard = ({
    title,
    value,
    color,
    active,
    onClick,
  }: {
    title: string
    value: number | string
    color: string
    active: boolean
    onClick: () => void
  }) => (
    <div
      onClick={onClick}
      style={{
        backgroundColor: active ? color : 'transparent',
        padding: '16px',
        borderRadius: '8px',
        border: active ? 'none' : '1px solid #3f3f46',
        color: active ? '#fff' : '#a1a1aa',
        minWidth: '150px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        boxShadow: active
          ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
          : 'none',
        position: 'relative',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Checkbox-like indicator */}
        <div
          style={{
            width: '16px',
            height: '16px',
            borderRadius: '3px',
            border: `2px solid ${active ? '#fff' : color}`,
            backgroundColor: active ? '#fff' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {active && <Check size={12} color={color} strokeWidth={4} />}
        </div>
        <span style={{ fontSize: '13px', fontWeight: '500' }}>{title}</span>
      </div>
      <span style={{ fontSize: '24px', fontWeight: 'bold', color: active ? '#fff' : '#e4e4e7' }}>
        {value.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
      </span>
    </div>
  )

  return (
    <div
      style={{
        marginBottom: '24px',
        backgroundColor: '#18181b',
        padding: '24px',
        borderRadius: '8px',
        border: '1px solid #27272a',
      }}
    >
      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' }}>
        <SummaryCard
          title="Total ORD"
          value={totals.ord}
          color="#facc15"
          active={visibility.ord}
          onClick={() => toggleVisibility('ord')}
        />
        <SummaryCard
          title="Total SNT"
          value={totals.snt}
          color="#3b82f6"
          active={visibility.snt}
          onClick={() => toggleVisibility('snt')}
        />
        <SummaryCard
          title="Total CON"
          value={totals.con}
          color="#a855f7"
          active={visibility.con}
          onClick={() => toggleVisibility('con')}
        />
        <SummaryCard
          title="Total PIC"
          value={totals.pic}
          color="#f97316"
          active={visibility.pic}
          onClick={() => toggleVisibility('pic')}
        />
        <SummaryCard
          title="Total REC"
          value={totals.rec}
          color="#22c55e"
          active={visibility.rec}
          onClick={() => toggleVisibility('rec')}
        />
      </div>

      {/* Chart */}
      <div style={{ height: '350px', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={aggregatedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" opacity={0.5} />
            <XAxis
              dataKey="displayTime"
              tick={{ fill: '#71717a', fontSize: 12 }}
              axisLine={{ stroke: '#3f3f46' }}
              tickLine={false}
              padding={{ left: 20, right: 20 }}
            />
            <YAxis
              tick={{ fill: '#71717a', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  // Cast payload data to our internal BucketValue type
                  const data = payload[0].payload as {
                    [key: string]: any
                    breakdown: {
                      ord: Record<string, number>
                      snt: Record<string, number>
                      con: Record<string, number>
                      pic: Record<string, number>
                      rec: Record<string, number>
                      dif: Record<string, number>
                    }
                  }

                  const cols = [
                    { key: 'ord', name: 'ORD', color: '#facc15' },
                    { key: 'snt', name: 'SNT', color: '#3b82f6' },
                    { key: 'con', name: 'CON', color: '#a855f7' },
                    { key: 'pic', name: 'PIC', color: '#f97316' },
                    { key: 'rec', name: 'REC', color: '#22c55e' },
                    { key: 'dif', name: 'DIF', color: '#f87171' }, // Red for DIF
                  ] as const

                  // Collect all unique branches from all metrics
                  const allBranches = new Set<string>()
                  cols.forEach((col) => {
                    const breakdown = data.breakdown[col.key] || {}
                    Object.keys(breakdown).forEach((b) => allBranches.add(b))
                  })

                  const branchList = Array.from(allBranches).sort()

                  if (branchList.length === 0) return null

                  return (
                    <div
                      style={{
                        backgroundColor: '#18181b',
                        border: '1px solid #3f3f46',
                        borderRadius: '6px',
                        padding: '12px',
                        color: '#e4e4e7',
                        minWidth: '350px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
                      }}
                    >
                      <p
                        style={{
                          fontSize: '13px',
                          color: '#a1a1aa',
                          marginBottom: '12px',
                          fontWeight: '600',
                          borderBottom: '1px solid #27272a',
                          paddingBottom: '8px',
                        }}
                      >
                        {label}
                      </p>
                      <table
                        style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}
                      >
                        <thead>
                          <tr style={{ borderBottom: '1px solid #3f3f46' }}>
                            <th
                              style={{
                                textAlign: 'left',
                                padding: '4px 8px',
                                color: '#a1a1aa',
                                fontWeight: '600',
                              }}
                            >
                              Branch
                            </th>
                            {cols.map((col) => (
                              <th
                                key={col.key}
                                style={{
                                  textAlign: 'right',
                                  padding: '4px 8px',
                                  color: col.color,
                                  fontWeight: '700',
                                }}
                              >
                                {col.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {branchList.map((branch) => (
                            <tr
                              key={branch}
                              style={{
                                borderBottom: '1px solid #27272a',
                                transition: 'background 0.2s',
                              }}
                            >
                              <td
                                style={{
                                  textAlign: 'left',
                                  padding: '6px 8px',
                                  fontWeight: '600',
                                  color: '#e4e4e7',
                                }}
                              >
                                {branch}
                              </td>
                              {cols.map((col) => {
                                const val = data.breakdown[col.key]?.[branch] || 0
                                return (
                                  <td
                                    key={col.key}
                                    style={{
                                      textAlign: 'right',
                                      padding: '6px 8px',
                                      color: val !== 0 ? '#e4e4e7' : '#52525b', // Dim zeros
                                    }}
                                  >
                                    {val !== 0
                                      ? val.toLocaleString('en-IN', {
                                          minimumFractionDigits: val % 1 === 0 ? 0 : 2,
                                          maximumFractionDigits: 2,
                                        })
                                      : '-'}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                }
                return null
              }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />

            {visibility.ord && (
              <Line
                type="monotone"
                dataKey="ord"
                stroke="#facc15"
                strokeWidth={3}
                dot={{ r: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                name="ORD"
              />
            )}
            {visibility.snt && (
              <Line
                type="monotone"
                dataKey="snt"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ r: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                name="SNT"
              />
            )}
            {visibility.con && (
              <Line
                type="monotone"
                dataKey="con"
                stroke="#a855f7"
                strokeWidth={3}
                dot={{ r: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                name="CON"
              />
            )}
            {visibility.pic && (
              <Line
                type="monotone"
                dataKey="pic"
                stroke="#f97316"
                strokeWidth={3}
                dot={{ r: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                name="PIC"
              />
            )}
            {visibility.rec && (
              <Line
                type="monotone"
                dataKey="rec"
                stroke="#22c55e"
                strokeWidth={3}
                dot={{ r: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                name="REC"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default StockOrderGraph
