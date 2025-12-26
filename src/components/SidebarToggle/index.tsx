'use client'
import React, { useEffect, useState } from 'react'

// Simple Hamburger / Close Icon
const MenuIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="3" y1="12" x2="21" y2="12"></line>
    <line x1="3" y1="6" x2="21" y2="6"></line>
    <line x1="3" y1="18" x2="21" y2="18"></line>
  </svg>
)

export const SidebarToggle = () => {
  // Initialize state based on body class if present (e.g. from persisted storage/cookie in future)
  const [collapsed, setCollapsed] = useState(false)

  const toggle = () => {
    const newVal = !collapsed
    setCollapsed(newVal)
    if (newVal) {
      document.body.classList.add('sidebar-collapsed')
    } else {
      document.body.classList.remove('sidebar-collapsed')
    }
  }

  return (
    <div
      className="sidebar-toggle-wrapper"
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        paddingRight: '10px',
        marginBottom: '10px',
      }}
    >
      <button
        onClick={toggle}
        className="sidebar-toggle-btn"
        type="button"
        title="Toggle Sidebar"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          color: 'var(--theme-elevation-800)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.7,
        }}
      >
        <MenuIcon />
      </button>
    </div>
  )
}
