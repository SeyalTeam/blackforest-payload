import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

// The confusing date
const rawDate = '2026-01-20T18:14:02.391Z'

console.log('--- Diagnosis of 2026-01-20T18:14:02.391Z ---')
console.log('UTC String:', rawDate)
console.log('dayjs(rawDate).format():', dayjs(rawDate).format('YYYY-MM-DD HH:mm:ss'))
console.log('dayjs(rawDate).utc().format():', dayjs(rawDate).utc().format('YYYY-MM-DD HH:mm:ss'))
console.log('dayjs(rawDate).tz("Asia/Kolkata").format():', dayjs(rawDate).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss'))

// Query Range for Today (Jan 21st)
const todayStart = dayjs.tz('2026-01-21', 'Asia/Kolkata').startOf('day')
const todayEnd = dayjs.tz('2026-01-21', 'Asia/Kolkata').endOf('day')

console.log('\n--- Query Range (Today: Jan 21st) ---')
console.log('Start (Remote TZ):', todayStart.format())
console.log('Start (UTC):', todayStart.toISOString())
console.log('End (Remote TZ):', todayEnd.format())
console.log('End (UTC):', todayEnd.toISOString())

// Check if rawDate falls in today's query range
const dateObj = dayjs(rawDate)
const isInRange = dateObj.isAfter(todayStart) && dateObj.isBefore(todayEnd)
console.log('\nIs the expense in todays range?', isInRange)

// Explanation
// 18:14 UTC on Jan 20th is 23:44 IST on Jan 20th.
// So it belongs to Jan 20th.
// If the user selects Jan 21st, this should NOT appear.
// If the user selects Jan 20th, it SHOULD appear.

// User says: "when choosing today (21st) it showing yesterday expense (20th)"
// This implies our query logic currently includes it.

// Let's re-verify the query logic I just wrote:
//   const startOfDay = dayjs.tz(startDateParam, 'Asia/Kolkata').startOf('day').toDate()
//   const endOfDay = dayjs.tz(endDateParam, 'Asia/Kolkata').endOf('day').toDate()

// If startDateParam is '2026-01-21', startOfDay is 2026-01-20T18:30:00.000Z
// The expense 2026-01-20T18:14:02.391Z is BEFORE startOfDay (18:14 < 18:30)
// So it should correctly be EXCLUDED.

// Wait... User says "showing yesterday expense".
// If the expense is at 18:14 UTC (23:44 IST Jan 20), and we query for Jan 21 (starts 18:30 UTC Jan 20),
// then 18:14 is indeed strictly before 18:30.
// So it SHOULD NOT show up.

// BUT... if the frontend or something else is somehow sending 'YYYY-MM-DD' that is interpreted as UTC?
// If we just do dayjs('2026-01-21').startOf('day') in UTC mode...
// Start: 2026-01-21T00:00:00Z
// Expense: 2026-01-20T18:14:00Z -> Clearly before.

// What if... the expense date is actually different?
// The user provided screenshot shows "05:14 AM" visible in the dashboard.
// And raw timestamp from user's claim: "January 20th 2026, 11:44 PM" -> 23:44.
// 23:44 IST = 18:14 UTC. Correct.

// Wait, the screenshot shows "05:14 AM".
// 05:14 AM IST = 23:44 UTC (previous day).
// 05:14 AM UTC = 10:44 AM IST.

// If the screenshot says 05:14 AM, and we used .utc() formatting...
// Then the stored time must be 05:14 AM UTC.
// 05:14 AM UTC on Jan 21st is 10:44 AM IST on Jan 21st.
// This would be inside the Today range (18:30 Jan 20 to 18:29 Jan 21).
// AND it would show as "05:14 AM" if we force UTC display.
// This matches the screenshot!

// So the stored date is likely around 2026-01-21T05:14:00Z.
// User claims it was done "yesterday 11:44 PM".
// Yesterday 11:44 PM IST (Jan 20) = 18:14 UTC Jan 20.
// BUT stored seems to be 05:14 UTC Jan 21??
// Difference: 18:14 vs 05:14 -> 11 hours difference.
// 5.5 hours x 2 = 11 hours. Double conversion error?

// If user entered 23:44 (11:44 PM) locally.
// If it was treated as UTC 23:44... that is 05:14 AM IST next day.
// Then converted to UTC again?
// Or maybe 18:14 + 5.5 = 23:44. + 5.5 = 05:14 next day.
// Yes, a double addition of +5:30 would result in 05:14 AM next day.

// Original Time (IST): Jan 20, 23:44
// Expected UTC: Jan 20, 18:14
// Actual Stored UTC (Suspected): Jan 21, 05:14

// Math:
// 18:14 + 5:30 = 23:44 (Local Face Value)
// 23:44 + 5:30 = 05:14 (Next Day)

// Conclusion: The backend (or whoever saves the expense) is incorrectly adding +5:30 to the already local time when saving it as UTC.
// OR it is taking the local time, calling it UTC, and then something else complicates it.
// Essentially: Stored Time = Local Time + 5:30.
// Instead of Stored Time = Local Time - 5:30.

