import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

const startOfDay = dayjs.tz('2026-09-02', 'Asia/Kolkata').startOf('day').toDate()
const endOfDay = dayjs.tz('2026-09-02', 'Asia/Kolkata').endOf('day').toDate()

const trendPeriod = 'hourly'

let granularity: 'month' | 'day' | 'hour' = 'month'
let trendStartDate = dayjs().tz('Asia/Kolkata').subtract(11, 'month').startOf('month')
let trendEndDate = dayjs().tz('Asia/Kolkata').endOf('month')
let pointsCount = 12

if (trendPeriod === 'hourly') {
  granularity = 'hour'
  trendStartDate = dayjs(startOfDay).tz('Asia/Kolkata')
  trendEndDate = dayjs(endOfDay).tz('Asia/Kolkata')
  pointsCount = trendEndDate.diff(trendStartDate, 'hour') + 1
} else if (trendPeriod === 'daily') {
  granularity = 'day'
  trendStartDate = dayjs(startOfDay).tz('Asia/Kolkata')
  trendEndDate = dayjs(endOfDay).tz('Asia/Kolkata')
  pointsCount = trendEndDate.diff(trendStartDate, 'day') + 1
}

console.log({ granularity, trendStartDate: trendStartDate.format(), pointsCount })

for (let i = 0; i < pointsCount; i += 1) {
  let d = trendStartDate
  if (granularity === 'month') d = trendStartDate.add(i, 'month')
  else if (granularity === 'day') d = trendStartDate.add(i, 'day')
  else if (granularity === 'hour') d = trendStartDate.add(i, 'hour')
  
  const year = d.year()
  const month = d.month() + 1
  const day = (granularity === 'day' || granularity === 'hour') ? d.date() : null
  const hour = granularity === 'hour' ? d.hour() : null

  // console.log({ year, month, day, hour })
}
