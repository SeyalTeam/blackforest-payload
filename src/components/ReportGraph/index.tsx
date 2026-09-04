'use client'

import React, { useEffect } from 'react'
import { Gutter } from '@payloadcms/ui'

const ReportGraph: React.FC = () => {
  useEffect(() => {
    window.open('/report-graph', '_blank')
  }, [])

  return (
    <Gutter style={{ paddingTop: '50px' }}>
      <h1>Report Graph</h1>
      <p>The Report Graph has been opened in a new tab.</p>
      <p>If your browser blocked the popup, please click the button below:</p>
      <button 
        style={{ padding: '10px 20px', backgroundColor: 'var(--theme-elevation-800)', color: 'var(--theme-elevation-0)', cursor: 'pointer', border: 'none', borderRadius: '4px', marginTop: '20px' }} 
        onClick={() => window.open('/report-graph', '_blank')}
      >
        Open Report Graph
      </button>
    </Gutter>
  )
}

export default ReportGraph
