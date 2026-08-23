import type { Payload } from 'payload'

export function startCronJobs(payload: Payload) {
  scheduleNextNightlyJob(payload)
}

function scheduleNextNightlyJob(payload: Payload) {
  const now = new Date()
  const next2AM = new Date()
  next2AM.setHours(2, 0, 0, 0)
  if (now.getTime() >= next2AM.getTime()) {
    next2AM.setDate(next2AM.getDate() + 1)
  }
  const delay = next2AM.getTime() - now.getTime()
  
  setTimeout(async () => {
    await runNightlyJob(payload)
    scheduleNextNightlyJob(payload)
  }, delay)
}

async function runNightlyJob(payload: Payload) {
  console.log('[cron] Running nightly attendance cleanup...')
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
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
        const updatedActivities = (doc.activities || []).map((act: any) => {
          if (act.status === 'active') {
            needsUpdate = true
            const punchOut = new Date(doc.date)
            punchOut.setHours(23, 59, 59, 999)
            
            let durationSeconds = 0
            if (act.punchIn) {
               durationSeconds = Math.floor((punchOut.getTime() - new Date(act.punchIn).getTime()) / 1000)
            }
            
            return {
              ...act,
              status: 'closed',
              punchOut: punchOut.toISOString(),
              durationSeconds: durationSeconds > 0 ? durationSeconds : 0
            }
          }
          return act
        })
        
        if (needsUpdate) {
          await payload.update({
            collection: 'attendance',
            id: doc.id,
            data: { activities: updatedActivities },
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
