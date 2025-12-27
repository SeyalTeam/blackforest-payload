const run = async () => {
  try {
    const res = await fetch(
      'http://localhost:3000/api/reports/closing-entry?startDate=2025-12-26&endDate=2025-12-26',
    )
    const json = await res.json()
    console.log('Response Status:', res.status)
    if (json.stats) {
      console.log('Stats Length:', json.stats.length)
      console.log('Stats:', JSON.stringify(json.stats[0], null, 2))
    } else {
      console.log('No stats found', json)
    }
  } catch (err) {
    console.error(err)
  }
}

run()
