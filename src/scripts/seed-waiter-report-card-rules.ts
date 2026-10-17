import 'dotenv/config'
import configPromise from '../payload.config'
import { getPayload } from 'payload'

const WAITER_RULES_SEED = [
  {
    title: '🚨 Waiter Call Response Speed SLA (< 30s)',
    enabled: true,
    roles: ['waiter'],
    role: 'waiter',
    category: 'call_speed',
    maxMarks: 100,
  },
  {
    title: '⏰ Shift Attendance & Punctuality',
    enabled: true,
    roles: ['all'],
    role: 'all', // Universal rule for ALL roles
    category: 'attendance',
    maxMarks: 100,
  },
  {
    title: '📋 Daily Tasks & Routine Checklist',
    enabled: true,
    roles: ['all'],
    role: 'all', // Universal rule for ALL roles
    category: 'tasks',
    maxMarks: 100,
  },
  {
    title: '🍽️ Table Service & Billing Accuracy',
    enabled: true,
    roles: ['waiter'],
    role: 'waiter',
    category: 'billing',
    maxMarks: 100,
  },
  {
    title: '⏱️ KOT Timing SLA (Prep / Deliver / Confirm)',
    enabled: true,
    roles: ['chef', 'supervisor', 'waiter'],
    role: 'chef',
    category: 'kot_time',
    maxMarks: 100,
  },
  {
    title: '🍽️ Table Order Billing & Revenue SLA',
    enabled: true,
    roles: ['waiter'],
    role: 'waiter',
    category: 'billing_table',
    maxMarks: 100,
  },
  {
    title: '🛍️ Counter Bill (Non-Table KOT) Revenue SLA',
    enabled: true,
    roles: ['cashier', 'waiter'],
    role: 'cashier',
    category: 'billing_counter',
    maxMarks: 100,
  },
]

export const seedWaiterReportCardRules = async () => {
  const payload = await getPayload({ config: configPromise })

  console.log('Seeding Report Card Rules (Universal + Role-Specific)...')

  for (const rule of WAITER_RULES_SEED) {
    const existing = await payload.find({
      collection: 'report-card-rules' as any,
      where: {
        or: [
          { title: { equals: rule.title } },
          { category: { equals: rule.category } },
        ],
      },
    })

    if (existing.docs.length > 0) {
      const doc = existing.docs[0]
      await payload.update({
        collection: 'report-card-rules' as any,
        id: doc.id,
        data: {
          title: rule.title,
          roles: rule.roles,
          role: rule.role,
          category: rule.category,
          maxMarks: rule.maxMarks,
          enabled: true,
        },
      })
      console.log(`[UPDATED] ${rule.title} (Roles: ${rule.roles.join(', ')})`)
    } else {
      await payload.create({
        collection: 'report-card-rules' as any,
        data: rule,
      })
      console.log(`[CREATED] ${rule.title} (Roles: ${rule.roles.join(', ')})`)
    }
  }

  console.log('Finished seeding Report Card Rules!')
}

// If run directly via node/tsx
if (process.argv[1]?.includes('seed-waiter-report-card-rules')) {
  seedWaiterReportCardRules()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error seeding rules:', err)
      process.exit(1)
    })
}
