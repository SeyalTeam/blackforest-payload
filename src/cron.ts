import type { Payload } from 'payload'

export function startCronJobs(payload: Payload) {
  // Run a cleanup immediately on server boot to catch any missed jobs
  runNightlyJob(payload).catch(console.error)
  
  scheduleNextNightlyJob(payload)
}

function scheduleNextNightlyJob(payload: Payload) {
  const now = new Date()
  const nextMidnight = new Date()
  nextMidnight.setHours(0, 1, 0, 0) // 12:01 AM
  if (now.getTime() >= nextMidnight.getTime()) {
    nextMidnight.setDate(nextMidnight.getDate() + 1)
  }
  const delay = nextMidnight.getTime() - now.getTime()
  
  setTimeout(async () => {
    await runNightlyJob(payload)
    scheduleNextNightlyJob(payload)
  }, delay)
}

async function runNightlyJob(payload: Payload) {
  console.log('[cron] Running nightly attendance cleanup...')
  try {
    const d = new Date()
    const utcOffset = d.getTime() + (5.5 * 60 * 60 * 1000)
    const localDate = new Date(utcOffset)
    localDate.setUTCHours(0, 0, 0, 0)
    const today = new Date(localDate.getTime() - (5.5 * 60 * 60 * 1000))
    
    let hasMore = true
    let page = 1
    
    while (hasMore) {
      const result = await payload.find({
        collection: 'attendance',
        where: {
          date: { less_than: today.toISOString() },
        },
        limit: 100,
        page,
      })
      
      for (const doc of result.docs) {
        let needsUpdate = false
        const updateData: any = {}
        
        // Handle modern activities array
        if (doc.activities && doc.activities.length > 0) {
          const updatedActivities = doc.activities.map((act: any) => {
            if (act.status === 'active') {
              needsUpdate = true
              const punchOut = new Date(new Date(doc.date).getTime() + 24 * 60 * 60 * 1000 - 1)
              
              let durationSeconds = 0
              if (act.punchIn) {
                 durationSeconds = Math.floor((punchOut.getTime() - new Date(act.punchIn).getTime()) / 1000)
              }
              
              return {
                ...act,
                status: 'closed',
                punchOut: punchOut.toISOString(),
                durationSeconds: durationSeconds > 0 ? durationSeconds : 0,
                punchOutType: 'auto',
              }
            }
            return act
          })
          if (needsUpdate) updateData.activities = updatedActivities
        }
        
        // Handle legacy root fields
        if (doc.status === 'active' && !doc.punchOut) {
          needsUpdate = true
          const punchOut = new Date(new Date(doc.date).getTime() + 24 * 60 * 60 * 1000 - 1)
          updateData.status = 'closed'
          updateData.punchOut = punchOut.toISOString()
          updateData.punchOutType = 'auto'
        }
        
        if (needsUpdate) {
          await payload.update({
            collection: 'attendance',
            id: doc.id,
            data: updateData,
          })
          console.log(`[cron] Auto-closed sessions for attendance doc ${doc.id}`)
        }
      }
      
      hasMore = result.hasNextPage
      page++
    }
    console.log('[cron] Nightly attendance cleanup finished.')
  } catch (err) {
    console.error('[cron] Error in nightly attendance cleanup:', err)
  }
}
