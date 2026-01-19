import React from 'react'
import { Gutter } from '@payloadcms/ui'
import './index.scss'

const Dashboard: React.FC = () => {
  return (
    <div className="dashboard-page">
      <Gutter>
        <h1>Dashboard</h1>
        <p>Welcome to the Dashboard.</p>
      </Gutter>
    </div>
  )
}

export default Dashboard
