'use client'

import React from 'react'
import WorkTasksBoard from '../../../components/WorkTasksBoard'

export default function WorkTasksPage() {
  return (
    <div style={{ width: '100%', height: '100vh', margin: 0, padding: 0 }}>
      <WorkTasksBoard isStandalone={true} />
    </div>
  )
}
