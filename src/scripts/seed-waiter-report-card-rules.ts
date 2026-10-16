import 'dotenv/config'
import configPromise from '../payload.config'
import { getPayload } from 'payload'

const WAITER_RULES_SEED = [
  {
    title: '🚨 Waiter Call Response Speed SLA (< 90s)',
    enabled: true,
    role: 'waiter',
    category: 'call_speed',
    maxMarks: 100,
    weightage: 30,
    order: 1,
    ruleDetails:
      'Measures average response speed when customers ring the table call buzzer or request assistance on their device. Target SLA is under 90 seconds from call signal to acknowledgment.\n\n• < 90 seconds: 100 Marks (Star Response)\n• 90s – 3 minutes: 80 Marks (Standard)\n• 3 – 5 minutes: 50 Marks (Slow Response)\n• > 5 minutes: 20 Marks (Unacceptable Delay)\n• Abandoned / Ignored Call: 0 Marks',
    deductionRules:
      'Deductions are calculated automatically from system timestamps in the waiter-calls collection. Every call delayed beyond 3 minutes reduces the daily Call Speed pillar score.',
    faqQuestion: 'How is my Waiter Call Response score calculated?',
    faqAnswer:
      'When a customer calls from a table, our system logs the exact second. When you acknowledge and attend the table on your mobile device, the response time is calculated. Reaching tables under 90 seconds keeps your score at 100/100.',
  },
  {
    title: '📋 Daily Floor Tasks & Station Checklist',
    enabled: true,
    role: 'waiter',
    category: 'tasks',
    maxMarks: 100,
    weightage: 25,
    order: 2,
    ruleDetails:
      'Measures daily operational routine checklist completion assigned to the Waiter role in the Work Tasks board.\n\n1. Morning Floor Prep: Water bottles filled, menus cleaned, condiment bottles topped up, cutlery placed.\n2. Running Duties: Continuous crumb cleaning, napkin refills, table turnover.\n3. Closing Shift: Chair alignment, station wipe-down, linen sorting.\n\nScoring = (Completed Tasks / Total Assigned Tasks) * 100.',
    deductionRules:
      'Each assigned task left unchecked or incomplete by shift end deducts proportional marks from the 100-mark task pillar.',
    faqQuestion: 'How can I get 100/100 in the Task Checklist?',
    faqAnswer:
      'Open the Work Tasks board at the start of your shift. Check off each assigned duty (morning setup, running floor duties, evening closing) as soon as you finish it before your shift ends.',
  },
  {
    title: '⏰ Shift Attendance & Punctuality',
    enabled: true,
    role: 'waiter',
    category: 'attendance',
    maxMarks: 100,
    weightage: 20,
    order: 3,
    ruleDetails:
      'Evaluates on-time punch-in and completion of full assigned shift hours via the Punch-In / Attendance module.\n\n• On-time or early arrival: 100 Marks\n• 1 – 15 minutes late: 90 Marks (-10 pts)\n• 16 – 30 minutes late: 75 Marks (-25 pts)\n• > 30 minutes late: 60 Marks (-40 pts)\n• Unapproved early shift departure: -30 pts\n• Unapproved absent: 0 Marks',
    deductionRules:
      'Late punch-in penalties apply automatically based on scheduled branch shift start time.',
    faqQuestion: 'What happens if I punch in late?',
    faqAnswer:
      'Punching in 1 to 15 minutes late deducts 10 marks (giving you 90/100). Punching in more than 30 minutes late reduces your score to 60/100. Always punch in 5 minutes before your shift starts.',
  },
  {
    title: '🍽️ Table Service & Billing Accuracy',
    enabled: true,
    role: 'waiter',
    category: 'billing',
    maxMarks: 100,
    weightage: 15,
    order: 4,
    ruleDetails:
      'Evaluates table order-taking accuracy and service delivery from Billings and Waiter-Wise reports.\n\n• Zero order errors / cancelled bills: 50/50 Base Marks\n• Table Turnover & Service Volume: Up to 30 Marks for meeting branch average customer count\n• Smooth checkout / digital payment assistance: 20 Marks',
    deductionRules:
      'A penalty of -15 marks is deducted for every bill cancelled or item returned due to waiter order-entry mistake.',
    faqQuestion: 'Will cancelled bills or food return impact my score?',
    faqAnswer:
      'Yes. If a bill is cancelled or an item is sent back because the wrong item or wrong table was entered, 15 marks are deducted from this category. Always confirm the order with the customer before punching.',
  },
  {
    title: '⭐ Grooming, Hygiene & Customer Feedback',
    enabled: true,
    role: 'waiter',
    category: 'hygiene',
    maxMarks: 100,
    weightage: 10,
    order: 5,
    ruleDetails:
      'Monitors personal grooming, uniform compliance, and guest satisfaction ratings.\n\n• Clean uniform, apron, neat hair & name badge: 30 Marks\n• Hygiene check (hand sanitization, clean serving): 20 Marks\n• Customer Reviews: 30 Marks (4-5 star reviews give full marks)\n• Guest greeting & hospitality attitude: 20 Marks',
    deductionRules:
      'Supervisor audit deduction of -15 marks for missing cap/apron or untidy uniform. Verified customer complaints deduct 20 marks.',
    faqQuestion: 'Do customer reviews affect my progress report card?',
    faqAnswer:
      'Yes. Positive 5-star customer ratings increase your score, while guest complaints about service or cleanliness lower it. Always maintain neat grooming and greet customers warmly.',
  },
]

export const seedWaiterReportCardRules = async () => {
  const payload = await getPayload({ config: configPromise })

  console.log('Seeding Waiter Report Card Rules & FAQs...')

  for (const rule of WAITER_RULES_SEED) {
    const existing = await payload.find({
      collection: 'report-card-rules' as any,
      where: {
        title: { equals: rule.title },
      },
    })

    if (existing.docs.length > 0) {
      console.log(`[EXISTS] ${rule.title}`)
    } else {
      await payload.create({
        collection: 'report-card-rules' as any,
        data: rule,
      })
      console.log(`[CREATED] ${rule.title}`)
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
