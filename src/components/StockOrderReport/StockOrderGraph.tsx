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

    const timeBuckets: Record<
      string,
      {
        time: string
        timestamp: number
        ord: number
        snt: number
        con: number
        pic: number
        rec: number
      }
    > = {}

    const addToBucket = (
      isoTime: string | undefined,
      type: 'ord' | 'snt' | 'con' | 'pic' | 'rec',
      qty: number,
      price: number,
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
        }
      }
      timeBuckets[bucketKey][type] += qty * price
    }

    items.forEach((item) => {
      addToBucket(item.ordTime, 'ord', item.ordQty, item.price)
      addToBucket(item.sntTime, 'snt', item.sntQty, item.price)
      addToBucket(item.conTime, 'con', item.conQty, item.price)
      addToBucket(item.picTime, 'pic', item.picQty, item.price)
      addToBucket(item.recTime, 'rec', item.recQty, item.price)
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
              contentStyle={{
                backgroundColor: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: '6px',
                color: '#e4e4e7',
              }}
              itemStyle={{ fontSize: '12px' }}
              labelStyle={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '8px' }}
              formatter={(value: number | undefined) =>
                (value || 0).toLocaleString('en-IN', {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })
              }
              itemSorter={(item: { name?: string }) => {
                const order = ['ORD', 'SNT', 'CON', 'PIC', 'REC']
                return order.indexOf(item.name || '')
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
