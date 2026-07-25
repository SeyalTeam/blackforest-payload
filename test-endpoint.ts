import 'dotenv/config'
import { getPayload } from 'payload'
import config from './src/payload.config'
import { getAccountsBillsReportHandler } from './src/endpoints/getAccountsBillsReport'

async function run() {
  const payload = await getPayload({ config })
  
  const mockReq: any = {
    payload,
    query: {
      startDate: '2026-07-24',
      endDate: '2026-07-24',
      branch: '68fcf95338714903fbd03e27', // VVD
      verificationStatus: 'missed'
    }
  }

  console.log('Calling getAccountsBillsReportHandler...')
  const response = await getAccountsBillsReportHandler(mockReq)
  const data = await response.json()
  
  console.log('=== RESPONSE ===')
  console.log(JSON.stringify(data, null, 2))
  
  process.exit(0)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
