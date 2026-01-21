import config from '@payload-config'
import { getPayload } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from local .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

const debugQuery = async () => {
    // Manually ensure PAYLOAD_SECRET is set
    if (!process.env.PAYLOAD_SECRET) {
         process.env.PAYLOAD_SECRET = 'your-secret-key-that-is-at-least-32-chars-long'
    }
    // Also set MONGODB_URI if missing
    if (!process.env.MONGODB_URI) {
        process.env.MONGODB_URI = 'mongodb://127.0.0.1/blackforest-payload'
    }

  try {
    const payload = await getPayload({ config })
    const today = '2026-01-21'
    
    // Simulate what we do in the endpoint currently (UTC conversion)
    const startOfDay = dayjs.tz(today, 'Asia/Kolkata').startOf('day').toDate()
    const endOfDay = dayjs.tz(today, 'Asia/Kolkata').endOf('day').toDate()
    
    console.log('Querying for:', today)
    console.log('Start (JS Date):', startOfDay.toISOString())
    console.log('End (JS Date):', endOfDay.toISOString())

    // Check specific doc from user by filtering by known details because ID seems to be wrong or not found in local db
    const expenses = await payload.find({
        collection: 'expenses',
        where: {
            'details.amount': { equals: 3520 },
            'details.source': { equals: 'OC PRODUCTS' }
        }
    })
    
    if(expenses.docs.length > 0) {
        console.log(`Found ${expenses.docs.length} candidate docs via content match`)
        const doc = expenses.docs[0]
        const docDate = new Date(doc.date)
        console.log('Candidate Doc Date (Raw):', doc.date)
        console.log('Candidate Doc Date (ISO):', docDate.toISOString())
        
        // Manual range check
        if (docDate >= startOfDay && docDate <= endOfDay) {
            console.log('Problematic doc IS caught in TODAYS query range!')
        } else {
             console.log('Problematic doc is NOT in TODAYS range.')
             if (docDate < startOfDay) console.log('Doc is BEFORE start of today')
             if (docDate > endOfDay) console.log('Doc is AFTER end of today')
        }
    } else {
        console.log('Could not find problematic doc via content match either')
    }
  } catch (e) {
    console.error(e)
  }
  process.exit(0)
}

debugQuery()
