'use client'

import React, { useMemo } from 'react'
import { useField } from '@payloadcms/ui'
import './index.scss'

type CategoryKey =
  | 'kot_time'
  | 'call_speed'
  | 'attendance'
  | 'tasks'
  | 'billing'
  | 'billing_table'
  | 'billing_counter'
  | 'hygiene'
  | 'reviews'
  | 'general'

interface CategoryConfig {
  key: CategoryKey
  icon: string
  title: string
  description: string
  formulaDisplay: string
  formulaExplanation: string
  metricLabel: string
  tiers: Array<{
    threshold: string
    score: number
    rating: string
    color: string
    note: string
  }>
  roleNotes?: Array<{
    role: string
    badge: string
    slaTarget: string
    criteria: string
  }>
  example: (maxMarks: number) => {
    scenario: string
    calculation: string
    finalMarks: number
  }
}

const CATEGORY_CONFIGS: Record<CategoryKey, CategoryConfig> = {
  kot_time: {
    key: 'kot_time',
    icon: '⏱️',
    title: 'KOT Timing SLA (Prep / Deliver / Confirm)',
    description:
      'Evaluates turn-around times at each stage of the Kitchen Order Ticket (KOT) workflow against role SLAs.',
    formulaDisplay:
      'Score = (On-Time KOT Items / Total KOT Items) × 100\nMarks = (Score / 100) × Max Marks',
    formulaExplanation:
      'Each KOT item timestamp is compared against its role-specific SLA threshold. Strict exact percentage is evaluated against tier thresholds without rounding up (e.g. 94.8% strictly qualifies for the 90.0%–94.99% bracket with 90 marks).',
    metricLabel: 'On-Time Delivery / Prep Rate (%)',
    tiers: [
      {
        threshold: '≥ 95.0% On-Time',
        score: 100,
        rating: '🌟 Exceptional SLA',
        color: '#10b981',
        note: 'Super fast prep & delivery (Strict ≥ 95%)',
      },
      {
        threshold: '90.0% – 94.99% On-Time',
        score: 90,
        rating: '🟢 High Discipline',
        color: '#22c55e',
        note: 'Solid performance within SLA',
      },
      {
        threshold: '80.0% – 89.99% On-Time',
        score: 75,
        rating: '🟡 Average Speed',
        color: '#eab308',
        note: 'Moderate delays during rush hours',
      },
      {
        threshold: '70.0% – 79.99% On-Time',
        score: 60,
        rating: '🟠 Needs Speed Improvement',
        color: '#f97316',
        note: 'Frequent SLA breaches',
      },
      {
        threshold: '< 70.0% On-Time',
        score: 40,
        rating: '🔴 Critical KOT Delay',
        color: '#ef4444',
        note: 'Unacceptable delay in kitchen or service',
      },
    ],
    roleNotes: [
      {
        role: 'Chef / Kitchen',
        badge: '👨‍🍳 Kitchen Team',
        slaTarget: 'Individual item prep time (or 15 min default)',
        criteria:
          'Measured from when order is Confirmed to when Chef marks it Prepared (item.preparedAt - item.confirmedAt).',
      },
      {
        role: 'Supervisor / Manager',
        badge: '👔 Supervisor',
        slaTarget: 'KotTimeGlobal.supervisorTime (Default 2 mins / 120s)',
        criteria:
          'Measured from Customer Order to Supervisor Confirmation (item.confirmedAt - item.orderedAt).',
      },
      {
        role: 'Waiter',
        badge: '🏃 Waiter',
        slaTarget: 'KotTimeGlobal.waiterTime (Default 5 mins / 300s)',
        criteria:
          'Measured from Chef Prepared to Waiter Delivery at table (item.deliveredAt - item.preparedAt).',
      },
    ],
    example: (maxMarks: number) => {
      const score = 90
      const marks = Math.round((score / 100) * maxMarks)
      return {
        scenario: 'Chef prepares 100 dishes. 92 dishes completed within prep time (92% on-time rate).',
        calculation: `On-Time Rate = 92% → Falls in 90%–94% bracket → Score = 90\nMarks = (${score} / 100) × ${maxMarks} = ${marks} Marks`,
        finalMarks: marks,
      }
    },
  },
  call_speed: {
    key: 'call_speed',
    icon: '🚨',
    title: 'Table Call Speed SLA (< 30s Target)',
    description:
      'Evaluates waiter reaction time from when a customer presses the Call Waiter button on their table to acknowledgement.',
    formulaDisplay:
      'Average Score = round( ∑ Call Points / Total Calls )\nMarks = (Average Score / 100) × Max Marks',
    formulaExplanation:
      'Every single table call is graded into a tiered point bracket based on response elapsed seconds. Unattended/pending calls get 0 points.',
    metricLabel: 'Call Response Speed Tiers',
    tiers: [
      {
        threshold: '≤ 30 seconds',
        score: 100,
        rating: '🟢 Instant Response',
        color: '#10b981',
        note: 'Full 100 pts per call (Target SLA)',
      },
      {
        threshold: '31 – 60 seconds',
        score: 80,
        rating: '🔵 Quick Response',
        color: '#3b82f6',
        note: '80 pts per call',
      },
      {
        threshold: '61 – 120 seconds',
        score: 60,
        rating: '🟡 Acceptable Speed',
        color: '#eab308',
        note: '60 pts per call',
      },
      {
        threshold: '121 – 180 seconds',
        score: 40,
        rating: '🟠 Slow Response',
        color: '#f97316',
        note: '40 pts per call',
      },
      {
        threshold: '> 180s or Unattended',
        score: 20,
        rating: '🔴 Critical Delay / Missed',
        color: '#ef4444',
        note: '20 pts if > 180s, 0 pts if Missed/Pending',
      },
    ],
    roleNotes: [
      {
        role: 'Waiter',
        badge: '🏃 Waiter & Floor Staff',
        slaTarget: '< 30 seconds instant arrival',
        criteria:
          'Elapsed time = call.updatedAt (acknowledged) - call.callTimestamp (triggered by diner).',
      },
    ],
    example: (maxMarks: number) => {
      const totalCalls = 20
      const totalPoints = 16 * 100 + 3 * 80 + 1 * 60 // 16 under 30s, 3 under 60s, 1 under 120s = 1900 pts
      const avgScore = Math.round(totalPoints / totalCalls) // 95
      const marks = Math.round((avgScore / 100) * maxMarks)
      return {
        scenario: `20 table calls in month: 16 under 30s (100pts), 3 under 60s (80pts), 1 under 120s (60pts).`,
        calculation: `Total Points = (16 × 100) + (3 × 80) + (1 × 60) = 1,900 pts\nAverage Score = 1,900 / 20 = 95\nMarks = (95 / 100) × ${maxMarks} = ${marks} Marks`,
        finalMarks: marks,
      }
    },
  },
  attendance: {
    key: 'attendance',
    icon: '⏰',
    title: 'Shift Attendance & Punctuality',
    description:
      'Evaluates staff attendance consistency and on-time punch-in compared to their scheduled shift login time.',
    formulaDisplay:
      'Punctuality Score = round( ∑ Day Attendance Points / Present Days )\nMarks = (Punctuality Score / 100) × Max Marks',
    formulaExplanation:
      'Each present day is scored based on the difference between actual punch-in time and scheduled login time (from employee profile).',
    metricLabel: 'Punch-In Punctuality Tiers',
    tiers: [
      {
        threshold: 'On-Time (≤ 0 min late)',
        score: 100,
        rating: '🟢 Punctual & Ready',
        color: '#10b981',
        note: '100 pts per day',
      },
      {
        threshold: '1 – 15 mins late',
        score: 90,
        rating: '🔵 Minor Delay',
        color: '#3b82f6',
        note: '90 pts per day (small deduction)',
      },
      {
        threshold: '16 – 30 mins late',
        score: 75,
        rating: '🟡 Moderate Late',
        color: '#eab308',
        note: '75 pts per day',
      },
      {
        threshold: '> 30 mins late',
        score: 60,
        rating: '🔴 Severe Late',
        color: '#ef4444',
        note: '60 pts per day',
      },
    ],
    roleNotes: [
      {
        role: 'All Roles',
        badge: '👥 All Employees',
        slaTarget: 'Scheduled Login Time (e.g. 09:00 AM)',
        criteria:
          'Evaluates first punch-in session vs scheduledLoginTime. Attendance Rate = Present Days / Total Expected Working Days.',
      },
    ],
    example: (maxMarks: number) => {
      const presentDays = 25
      const totalPoints = 22 * 100 + 2 * 90 + 1 * 75 // 22 on-time, 2 late <=15m, 1 late 20m = 2455 pts
      const avgScore = Math.round(totalPoints / presentDays) // 98
      const marks = Math.round((avgScore / 100) * maxMarks)
      return {
        scenario: `25 shifts worked: 22 strictly on-time (100pts), 2 late by 10 mins (90pts), 1 late by 25 mins (75pts).`,
        calculation: `Total Points = (22 × 100) + (2 × 90) + (1 × 75) = 2,455 pts\nPunctuality Score = 2,455 / 25 = 98.2 → 98\nMarks = (98 / 100) × ${maxMarks} = ${marks} Marks`,
        finalMarks: marks,
      }
    },
  },
  tasks: {
    key: 'tasks',
    icon: '📋',
    title: 'Daily Floor Tasks & Station Checklist',
    description:
      'Evaluates execution of daily opening, station readiness, food safety, and shift closing checklists.',
    formulaDisplay:
      'Task Completion Rate = (Completed Tasks / Total Assigned Tasks) × 100\nMarks = (Bracket Score / 100) × Max Marks',
    formulaExplanation:
      'Counts checklist tasks completed vs assigned in task-completions collection. Strict exact completion percentage is evaluated against tier thresholds without rounding up (e.g. 94.6% strictly falls in the 90.0%–94.99% bracket with 90 marks).',
    metricLabel: 'Checklist Completion Rate (%)',
    tiers: [
      {
        threshold: '≥ 95.0% Completion',
        score: 100,
        rating: '🟢 Exemplary Station Readiness',
        color: '#10b981',
        note: 'Near perfect checklist discipline (Strict ≥ 95%)',
      },
      {
        threshold: '90.0% – 94.99% Completion',
        score: 90,
        rating: '🔵 High Checklist Discipline',
        color: '#3b82f6',
        note: 'Minor non-critical tasks missed',
      },
      {
        threshold: '80.0% – 89.99% Completion',
        score: 75,
        rating: '🟡 Average Compliance',
        color: '#eab308',
        note: 'Occasional missed cleaning or prep items',
      },
      {
        threshold: '70.0% – 79.99% Completion',
        score: 60,
        rating: '🟠 Needs Supervision',
        color: '#f97316',
        note: 'Frequent incomplete tasks',
      },
      {
        threshold: '< 70.0% Completion',
        score: 40,
        rating: '🔴 Critical Task Gaps',
        color: '#ef4444',
        note: 'High operational failure risk',
      },
    ],
    roleNotes: [
      {
        role: 'All Roles',
        badge: '📋 Floor & Station Staff',
        slaTarget: '100% daily checklist completion',
        criteria:
          'Evaluates tasks where completed === true or status in ["yes", "no_complaint"].',
      },
    ],
    example: (maxMarks: number) => {
      const assigned = 150
      const completed = 144
      const rate = Math.round((completed / assigned) * 100) // 96%
      const score = 100
      const marks = Math.round((score / 100) * maxMarks)
      return {
        scenario: `150 checklist tasks assigned across 25 working days. Employee completed 144 tasks.`,
        calculation: `Completion Rate = (144 / 150) × 100 = 96.0% → Falls in ≥ 95% bracket → Score = 100\nMarks = (100 / 100) × ${maxMarks} = ${marks} Marks`,
        finalMarks: marks,
      }
    },
  },
  billing: {
    key: 'billing',
    icon: '🍽️',
    title: 'Table Service & Billing Accuracy',
    description:
      'Evaluates order punching accuracy, cancelled bills, and cancelled individual products to prevent wastage and revenue leakage.',
    formulaDisplay:
      'Product Accuracy % = (Served Products / Total Products Ordered) × 100\nMarks = (Product Accuracy % / 100) × Max Marks',
    formulaExplanation:
      'Direct exact percentage calculation. Marks directly show the exact percentage of items served without cancellation. E.g. 99.59% accuracy awards exactly 99.59 marks (out of 100), and 97.62% awards 97.62 marks.',
    metricLabel: 'Served Product Accuracy (%)',
    tiers: [
      {
        threshold: '98.0% – 100.0% Accuracy',
        score: 100,
        rating: '🟢 Flawless Order Accuracy',
        color: '#10b981',
        note: 'Near zero cancellations (e.g. 99.59% gives 99.59 marks)',
      },
      {
        threshold: '95.0% – 97.99% Accuracy',
        score: 95,
        rating: '🔵 High Billing Precision',
        color: '#3b82f6',
        note: 'High accuracy (e.g. 97.62% gives 97.62 marks)',
      },
      {
        threshold: '90.0% – 94.99% Accuracy',
        score: 90,
        rating: '🟡 Average Adjustments',
        color: '#eab308',
        note: 'Acceptable order handling',
      },
      {
        threshold: '80.0% – 89.99% Accuracy',
        score: 80,
        rating: '🟠 Frequent Item Voids',
        color: '#f97316',
        note: 'Noticeable voids / wastage risk',
      },
      {
        threshold: '< 80.0% Accuracy',
        score: 60,
        rating: '🔴 High Cancellation Rate',
        color: '#ef4444',
        note: 'Severe order mispunching or cancelled tables',
      },
    ],
    roleNotes: [
      {
        role: 'Waiter & Cashier',
        badge: '🍽️ Service & Billing',
        slaTarget: '100% served item accuracy',
        criteria:
          'Total Products = sum(item.quantity). Cancelled Products = items from cancelled bills + cancelled items from active bills. Served = Total - Cancelled. Marks = Exact Accuracy %.',
      },
    ],
    example: (maxMarks: number) => {
      const totalOrdered = 3186.75
      const served = 3173.75
      const exactAccuracy = Number(((served / totalOrdered) * 100).toFixed(2)) // 99.59%
      const marks = Number(((exactAccuracy / 100) * maxMarks).toFixed(2))
      return {
        scenario: `3,186.75 items ordered. 13 cancelled across 2 voided bills and single voids. Total served = 3,173.75 items.`,
        calculation: `Exact Accuracy = (3,173.75 / 3,186.75) × 100 = 99.59%\nMarks = (${exactAccuracy} / 100) × ${maxMarks} = ${marks} Marks`,
        finalMarks: marks,
      }
    },
  },
  billing_table: {
    key: 'billing_table',
    icon: '🍽️',
    title: 'Table Order Billing & Revenue SLA',
    description:
      'Evaluates payment revenue collected from dine-in table orders (bills with tableNumber) compared to Branch, Company, and Overall sales benchmarks.',
    formulaDisplay:
      'Branch Benchmark = Branch Total Table Billing / Active Floor Staff\nAchievement % = (Employee Table Billing / Branch Benchmark) × 100\nMarks = min(Max Marks, (Achievement % / 100) × Max Marks)',
    formulaExplanation:
      'Evaluates all active paid/settled dine-in table bills punched or served by the employee. Performance is benchmarked against the branch average per active staff (or fixed target quota if set). Exact unrounded score is awarded.',
    metricLabel: 'Table Sales Achievement vs Benchmark (%)',
    tiers: [
      {
        threshold: '≥ 105.0% of Benchmark',
        score: 100,
        rating: '🌟 Star Contributor',
        color: '#10b981',
        note: 'Superb table sales (+5% or more above branch peer average)',
      },
      {
        threshold: '95.0% – 104.99% of Benchmark',
        score: 95,
        rating: '🟢 Target Met',
        color: '#22c55e',
        note: 'Balanced branch contribution meeting expected quota',
      },
      {
        threshold: '80.0% – 94.99% of Benchmark',
        score: 85,
        rating: '🟡 Fair Contribution',
        color: '#eab308',
        note: 'Slightly below branch average sales per staff',
      },
      {
        threshold: '65.0% – 79.99% of Benchmark',
        score: 70,
        rating: '🟠 Under Benchmark Alert',
        color: '#f97316',
        note: 'Noticeable shortfall in table revenue generation',
      },
      {
        threshold: '< 65.0% of Benchmark',
        score: 50,
        rating: '🔴 Critical Shortfall Alert',
        color: '#ef4444',
        note: 'Severe sales lag requiring floor assignment review',
      },
    ],
    roleNotes: [
      {
        role: 'Waiter / Floor Staff',
        badge: '🍽️ Dine-in Service',
        slaTarget: '100% of Branch Average per Staff',
        criteria:
          'Evaluates bills where tableDetails.tableNumber is present and non-empty. Excludes cancelled bills.',
      },
    ],
    example: (maxMarks: number) => {
      const branchTotal = 480000
      const activeStaff = 4
      const benchmark = branchTotal / activeStaff // 120,000
      const empSales = 134500
      const achievementRate = Number(((empSales / benchmark) * 100).toFixed(2)) // 112.08%
      const exactScore = Math.min(100, achievementRate)
      const marks = Number(((exactScore / 100) * maxMarks).toFixed(2))
      return {
        scenario: `Branch Table Sales = ₹4,80,000 across 4 waiters (Benchmark = ₹1,20,000). Waiter generated ₹1,34,500 across 185 tables.`,
        calculation: `Branch Benchmark = ₹4,80,000 / 4 = ₹1,20,000\nAchievement % = (₹1,34,500 / ₹1,20,000) × 100 = 112.08% → Capped at 100%\nMarks = (100 / 100) × ${maxMarks} = ${marks} Marks (🌟 Star Contributor)`,
        finalMarks: marks,
      }
    },
  },
  billing_counter: {
    key: 'billing_counter',
    icon: '🛍️',
    title: 'Counter Bill (Non-Table KOT) Revenue SLA',
    description:
      'Evaluates payment revenue collected from takeaway, parcel, and counter walk-in orders (bills without tableNumber with KOT) against Branch, Company, and Overall benchmarks.',
    formulaDisplay:
      'Branch Benchmark = Branch Total Counter Billing / Active Counter Staff\nAchievement % = (Employee Counter Billing / Branch Benchmark) × 100\nMarks = min(Max Marks, (Achievement % / 100) × Max Marks)',
    formulaExplanation:
      'Evaluates all active paid/settled counter orders (takeaway/parcel bills with kotNumber and no table assigned). Performance is benchmarked against the branch counter average per staff. Exact unrounded score is awarded.',
    metricLabel: 'Counter Sales Achievement vs Benchmark (%)',
    tiers: [
      {
        threshold: '≥ 105.0% of Benchmark',
        score: 100,
        rating: '🌟 Star Contributor',
        color: '#10b981',
        note: 'Outstanding counter sales speed and order upselling',
      },
      {
        threshold: '95.0% – 104.99% of Benchmark',
        score: 95,
        rating: '🟢 Target Met',
        color: '#22c55e',
        note: 'Solid counter billing throughput meeting branch target',
      },
      {
        threshold: '80.0% – 94.99% of Benchmark',
        score: 85,
        rating: '🟡 Fair Contribution',
        color: '#eab308',
        note: 'Moderate counter bill volume',
      },
      {
        threshold: '65.0% – 79.99% of Benchmark',
        score: 70,
        rating: '🟠 Below Counter Target',
        color: '#f97316',
        note: 'Low order volume or slow counter billing processing',
      },
      {
        threshold: '< 65.0% of Benchmark',
        score: 50,
        rating: '🔴 Critical Counter Shortfall',
        color: '#ef4444',
        note: 'Substantial shortfall in counter billing collection',
      },
    ],
    roleNotes: [
      {
        role: 'Cashier / Counter Staff',
        badge: '🛍️ Counter & Takeaway',
        slaTarget: '100% of Branch Counter Average',
        criteria:
          'Evaluates bills where tableDetails.tableNumber is empty and kotNumber is present. Excludes cancelled bills.',
      },
    ],
    example: (maxMarks: number) => {
      const branchTotal = 320000
      const activeStaff = 2
      const benchmark = branchTotal / activeStaff // 160,000
      const empSales = 142800
      const achievementRate = Number(((empSales / benchmark) * 100).toFixed(2)) // 89.25%
      const marks = Number(((achievementRate / 100) * maxMarks).toFixed(2))
      return {
        scenario: `Branch Counter Sales = ₹3,20,000 across 2 cashiers (Benchmark = ₹1,60,000). Cashier generated ₹1,42,800 across 210 counter bills.`,
        calculation: `Branch Benchmark = ₹3,20,000 / 2 = ₹1,60,000\nAchievement % = (₹1,42,800 / ₹1,60,000) × 100 = 89.25%\nMarks = (89.25 / 100) × ${maxMarks} = ${marks} Marks (⚠️ Below Branch Average -10.75%)`,
        finalMarks: marks,
      }
    },
  },
  hygiene: {
    key: 'hygiene',
    icon: '⭐',
    title: 'Grooming, Hygiene & Cleanliness',
    description:
      'Evaluates personal grooming (uniform, nails, hairnet/cap) and workstation sanitization audits.',
    formulaDisplay:
      'Hygiene Compliance = (Passed Audits / Total Audits) × 100\nMarks = (Compliance Score / 100) × Max Marks',
    formulaExplanation:
      'Supervisors conduct daily/weekly grooming inspections. High audit pass rates ensure pristine brand hygiene standards.',
    metricLabel: 'Hygiene Audit Pass Rate (%)',
    tiers: [
      {
        threshold: '≥ 95% Passed',
        score: 100,
        rating: '🟢 Pristine Hygiene & Grooming',
        color: '#10b981',
        note: 'Full compliance with dress & cleanliness code',
      },
      {
        threshold: '85% – 94% Passed',
        score: 85,
        rating: '🔵 Good Hygiene',
        color: '#3b82f6',
        note: 'Minor uniform or grooming remarks',
      },
      {
        threshold: '75% – 84% Passed',
        score: 70,
        rating: '🟡 Fair Hygiene',
        color: '#eab308',
        note: 'Multiple grooming warnings',
      },
      {
        threshold: '< 75% Passed',
        score: 50,
        rating: '🔴 Hygiene Alert',
        color: '#ef4444',
        note: 'Repeated non-compliance with hygiene SOPs',
      },
    ],
    roleNotes: [
      {
        role: 'All Roles',
        badge: '⭐ Kitchen & Service',
        slaTarget: '100% audit pass',
        criteria: 'Supervisory hygiene inspection checklist records.',
      },
    ],
    example: (maxMarks: number) => {
      const score = 100
      const marks = Math.round((score / 100) * maxMarks)
      return {
        scenario: `20 hygiene spot-checks conducted this month. 19 audits passed with 100% grooming compliance (95% pass rate).`,
        calculation: `Compliance = (19 / 20) × 100 = 95% → Falls in ≥ 95% bracket → Score = 100\nMarks = (100 / 100) × ${maxMarks} = ${marks} Marks`,
        finalMarks: marks,
      }
    },
  },
  reviews: {
    key: 'reviews',
    icon: '💬',
    title: 'Customer Feedback & Star Reviews',
    description:
      'Evaluates guest satisfaction scores, feedback comments, and star ratings collected at table or checkout.',
    formulaDisplay:
      'Review Score = round( (Average Star Rating / 5.0) × 100 )\nMarks = (Review Score / 100) × Max Marks',
    formulaExplanation:
      'Customer ratings on 1 to 5 star scale are averaged and normalized to a 100-point index.',
    metricLabel: 'Average Guest Star Rating',
    tiers: [
      {
        threshold: '4.8 – 5.0 Stars',
        score: 100,
        rating: '🌟 Guest Delight',
        color: '#10b981',
        note: 'Exceptional hospitality & compliments',
      },
      {
        threshold: '4.3 – 4.7 Stars',
        score: 90,
        rating: '🟢 Highly Recommended',
        color: '#22c55e',
        note: 'Very satisfied diners',
      },
      {
        threshold: '3.8 – 4.2 Stars',
        score: 75,
        rating: '🟡 Satisfactory',
        color: '#eab308',
        note: 'Standard service experience',
      },
      {
        threshold: '< 3.8 Stars',
        score: 50,
        rating: '🔴 Needs Customer Care Training',
        color: '#ef4444',
        note: 'Negative feedback or complaints received',
      },
    ],
    roleNotes: [
      {
        role: 'Waiter & Manager',
        badge: '💬 Front of House',
        slaTarget: '≥ 4.5 Stars',
        criteria: 'Customer review survey submitted via QR code or checkout billing screen.',
      },
    ],
    example: (maxMarks: number) => {
      const avgStars = 4.6
      const score = Math.round((avgStars / 5.0) * 100) // 92
      const marks = Math.round((score / 100) * maxMarks)
      return {
        scenario: `Employee received 45 customer ratings with an average score of 4.6 out of 5 stars.`,
        calculation: `Score Index = (4.6 / 5.0) × 100 = 92\nMarks = (92 / 100) × ${maxMarks} = ${marks} Marks`,
        finalMarks: marks,
      }
    },
  },
  general: {
    key: 'general',
    icon: 'ℹ️',
    title: 'General Guidelines & Policy Adherence',
    description:
      'Evaluates overall policy compliance, SOP execution, teamwork, and managerial discretion.',
    formulaDisplay:
      'Compliance Score = (Fulfilled Guidelines / Total Evaluated Points) × 100\nMarks = (Compliance Score / 100) × Max Marks',
    formulaExplanation:
      'General performance score based on workplace code of conduct and standard guidelines.',
    metricLabel: 'General Compliance Score',
    tiers: [
      {
        threshold: '90% – 100%',
        score: 100,
        rating: '🟢 Star Employee',
        color: '#10b981',
        note: 'Zero policy infractions',
      },
      {
        threshold: '80% – 89%',
        score: 85,
        rating: '🔵 Meets All Standards',
        color: '#3b82f6',
        note: 'Good adherence to SOP',
      },
      {
        threshold: '70% – 79%',
        score: 70,
        rating: '🟡 Acceptable',
        color: '#eab308',
        note: 'Minor guidance required',
      },
      {
        threshold: '< 70%',
        score: 50,
        rating: '🔴 Policy Review Needed',
        color: '#ef4444',
        note: 'Disciplinary review needed',
      },
    ],
    roleNotes: [
      {
        role: 'All Roles',
        badge: 'ℹ️ Organization Wide',
        slaTarget: '100% Policy Adherence',
        criteria: 'Manager appraisal and workplace guidelines assessment.',
      },
    ],
    example: (maxMarks: number) => {
      const score = 90
      const marks = Math.round((score / 100) * maxMarks)
      return {
        scenario: `Employee meets 90% of organizational SOP targets and peer guidelines.`,
        calculation: `Score = 90\nMarks = (90 / 100) × ${maxMarks} = ${marks} Marks`,
        finalMarks: marks,
      }
    },
  },
}

export const ReportCardRuleFormula: React.FC = () => {
  const { value: categoryValue } = useField<string | null>({ path: 'category' })
  const { value: rolesValue } = useField<string[] | string | null>({ path: 'roles' })
  const { value: maxMarksValue } = useField<number | string | null>({ path: 'maxMarks' })

  const categoryKey = (categoryValue || 'kot_time') as CategoryKey
  const config = CATEGORY_CONFIGS[categoryKey] || CATEGORY_CONFIGS.general

  const maxMarks = useMemo(() => {
    const parsed = Number(maxMarksValue)
    return !isNaN(parsed) && parsed > 0 ? parsed : 100
  }, [maxMarksValue])

  const selectedRoles: string[] = useMemo(() => {
    if (Array.isArray(rolesValue)) return rolesValue
    if (typeof rolesValue === 'string' && rolesValue.trim()) return [rolesValue]
    return ['all']
  }, [rolesValue])

  const exampleData = useMemo(() => {
    return config.example(maxMarks)
  }, [config, maxMarks])

  return (
    <div className="report-card-rule-formula-container">
      {/* Header Banner */}
      <div className="formula-header-card">
        <div className="formula-header-left">
          <div className="category-icon-bubble">{config.icon}</div>
          <div className="category-titles">
            <div className="formula-eyebrow">
              CALCULATION FORMULA &amp; SCORING RULES
            </div>
            <h3 className="category-main-title">{config.title}</h3>
            <p className="category-description-text">{config.description}</p>
          </div>
        </div>

        <div className="formula-header-badges">
          <div className="summary-stat-badge">
            <span className="stat-label">Max Marks</span>
            <span className="stat-value">{maxMarks} Marks</span>
          </div>
          <div className="summary-stat-badge secondary">
            <span className="stat-label">Applicable Roles</span>
            <span className="stat-value roles-list">
              {selectedRoles.join(', ')}
            </span>
          </div>
        </div>
      </div>

      {/* Mathematical Formula Box */}
      <div className="formula-math-card">
        <div className="math-card-header">
          <span className="math-icon">📐</span>
          <span className="math-title">Exact Mathematical Formula</span>
        </div>
        <pre className="math-code-box">{config.formulaDisplay}</pre>
        <p className="math-explanation-text">
          <strong>How it works: </strong>
          {config.formulaExplanation}
        </p>
      </div>

      {/* Role Nuances (if any) */}
      {config.roleNotes && config.roleNotes.length > 0 && (
        <div className="formula-roles-section">
          <div className="section-subtitle">
            <span>🎯</span> Role-Specific Benchmarks &amp; Triggers:
          </div>
          <div className="role-notes-grid">
            {config.roleNotes.map((rn, idx) => (
              <div key={idx} className="role-note-card">
                <div className="role-note-badge-row">
                  <span className="role-badge">{rn.badge}</span>
                  <span className="role-target-chip">Target: {rn.slaTarget}</span>
                </div>
                <div className="role-criteria-text">{rn.criteria}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scoring Tiers & Marks Table */}
      <div className="formula-table-section">
        <div className="section-subtitle">
          <span>📊</span> Scoring Thresholds &amp; Scaled Marks:
        </div>
        <div className="table-responsive-wrapper">
          <table className="formula-tiers-table">
            <thead>
              <tr>
                <th>{config.metricLabel}</th>
                <th>Standard Score (0–100)</th>
                <th>Calculated Marks (Out of {maxMarks})</th>
                <th>Rating Label &amp; Grade</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {config.tiers.map((tier, idx) => {
                const scaledMarks = Math.round((tier.score / 100) * maxMarks)
                return (
                  <tr key={idx}>
                    <td className="threshold-cell">
                      <span
                        className="threshold-dot"
                        style={{ backgroundColor: tier.color }}
                      />
                      <strong>{tier.threshold}</strong>
                    </td>
                    <td className="score-cell">
                      <span className="score-pill">{tier.score} / 100</span>
                    </td>
                    <td className="marks-cell">
                      <span className="marks-highlight">
                        {scaledMarks} / {maxMarks} Marks
                      </span>
                    </td>
                    <td className="rating-cell">
                      <span
                        className="rating-badge"
                        style={{
                          borderColor: tier.color,
                          color: tier.color,
                          backgroundColor: `${tier.color}15`,
                        }}
                      >
                        {tier.rating}
                      </span>
                    </td>
                    <td className="notes-cell">{tier.note}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Worked Example */}
      <div className="formula-example-card">
        <div className="example-header">
          <span className="example-icon">💡</span>
          <span className="example-title">
            Live Calculation Example (using {maxMarks} Max Marks)
          </span>
        </div>
        <div className="example-body">
          <div className="example-scenario">
            <strong>Scenario: </strong>
            {exampleData.scenario}
          </div>
          <pre className="example-math">{exampleData.calculation}</pre>
          <div className="example-result">
            👉 Result Awarded to Employee:{' '}
            <span className="final-marks-pill">
              {exampleData.finalMarks} / {maxMarks} Marks
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReportCardRuleFormula
