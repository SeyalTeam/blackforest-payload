import React from 'react'

export const DateRangeInput = React.forwardRef<HTMLButtonElement, { value?: string; onClick?: () => void }>(
  ({ value, onClick }, ref) => {
    const [start, end] = value ? value.split(' - ') : ['', '']

    return (
      <button className="custom-date-input" onClick={onClick} ref={ref} type="button">
        <span className="date-text">{start || '--'}</span>
        <span className="separator">→</span>
        <span className="date-text">{end || start || '--'}</span>
        <span className="calendar-icon" aria-hidden="true">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
        </span>
      </button>
    )
  },
)

DateRangeInput.displayName = 'DateRangeInput'
