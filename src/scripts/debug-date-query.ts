import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

const test = () => {
    const today = '2026-01-21' // Assuming today is 21st Jan 2026
    const start = dayjs.tz(today, 'YYYY-MM-DD', 'Asia/Kolkata').startOf('day')
    const end = dayjs.tz(today, 'YYYY-MM-DD', 'Asia/Kolkata').endOf('day')
    
    console.log('Today Input:', today)
    console.log('Start (Remote TZ):', start.format())
    console.log('Start (UTC):', start.toISOString())
    console.log('End (Remote TZ):', end.format())
    console.log('End (UTC):', end.toISOString())
}

test()
