const fs = require('fs');
const file = 'src/components/AttendanceReport/index.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add AggregatedItem type
if (!content.includes('export type AggregatedItem')) {
  content = content.replace(
    'export type AttendanceItem = {',
    `export type AggregatedItem = {
  isAggregated: true
  id: string
  employeeName: string
  employeeIdStr: string
  employeePhotoUrl?: string
  userRole: string
  employeeTeam: string
  branchName: string
  daysPresent: number
  avgFirstInFormatted: string
  avgLastOutFormatted: string
  totalSessions: number
  totalBreakSeconds: number
  totalBreakFormatted: string
  totalWorkSeconds: number
  totalWorkFormatted: string
  avgWorkSeconds: number
  avgWorkFormatted: string
  originalItems: AttendanceItem[]
}

export type AttendanceItem = {`
  );
}

// 2. Add formatSeconds and getAverageTime
if (!content.includes('const formatSeconds = (')) {
  content = content.replace(
    'const AttendanceReport: React.FC = () => {',
    `const formatSeconds = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const remainingSecs = safeSeconds % 60
  if (hours > 0) return minutes > 0 ? \`\${hours}h \${minutes}m\` : \`\${hours}h\`
  if (minutes > 0) return \`\${minutes}m \${remainingSecs}s\`
  return \`\${remainingSecs}s\`
}

const getAverageTime = (isoStrings: string[]) => {
  if (isoStrings.length === 0) return '--'
  let totalMinutes = 0
  let count = 0
  for (const iso of isoStrings) {
    if (iso) {
      const d = dayjs.utc(iso).tz('Asia/Kolkata')
      totalMinutes += d.hour() * 60 + d.minute()
      count++
    }
  }
  if (count === 0) return '--'
  const avg = Math.floor(totalMinutes / count)
  const h = Math.floor(avg / 60)
  const m = avg % 60
  const period = h >= 12 ? 'PM' : 'AM'
  const displayH = h % 12 || 12
  return \`\${displayH.toString().padStart(2, '0')}:\${m.toString().padStart(2, '0')} \${period}\`
}

const AttendanceReport: React.FC = () => {`
  );
}

// 3. Add useMemo for displayItems
if (!content.includes('const { displayItems, isAggregatedView } = useMemo(')) {
  content = content.replace(
    'const [error, setError] = useState(\'\')',
    `const [error, setError] = useState('')

  const { displayItems, isAggregatedView } = useMemo(() => {
    if (!data) return { displayItems: [], isAggregatedView: false }
    const startStr = startDate ? toLocalDateStr(startDate) : ''
    const endStr = endDate ? toLocalDateStr(endDate) : ''
    const isMulti = startStr && endStr && startStr !== endStr

    if (!isMulti) {
      return { displayItems: data.items, isAggregatedView: false }
    }

    const grouped: Record<string, AggregatedItem> = {}
    data.items.forEach(item => {
      const key = item.employeeId || item.userId || item.employeeName
      if (!grouped[key]) {
        grouped[key] = {
          isAggregated: true,
          id: key,
          employeeName: item.employeeName,
          employeeIdStr: item.employeeId || '',
          employeePhotoUrl: item.employeePhotoUrl,
          userRole: item.userRole,
          employeeTeam: item.employeeTeam || '',
          branchName: item.branchName,
          daysPresent: 0,
          avgFirstInFormatted: '',
          avgLastOutFormatted: '',
          totalSessions: 0,
          totalBreakSeconds: 0,
          totalBreakFormatted: '',
          totalWorkSeconds: 0,
          totalWorkFormatted: '',
          avgWorkSeconds: 0,
          avgWorkFormatted: '',
          originalItems: [],
        }
      }
      const g = grouped[key]
      g.daysPresent++
      g.totalSessions += item.sessionCount
      g.totalBreakSeconds += item.totalBreakSeconds || 0
      g.totalWorkSeconds += item.totalWorkSeconds || 0
      g.originalItems.push(item)
    })

    const aggregatedList = Object.values(grouped).map(g => {
      const firstIns = g.originalItems.map(i => i.firstPunchIn).filter(Boolean) as string[]
      const lastOuts = g.originalItems.map(i => i.lastPunchOut).filter(Boolean) as string[]
      const avgWork = g.daysPresent > 0 ? g.totalWorkSeconds / g.daysPresent : 0
      return {
        ...g,
        avgFirstInFormatted: getAverageTime(firstIns),
        avgLastOutFormatted: getAverageTime(lastOuts),
        totalBreakFormatted: formatSeconds(g.totalBreakSeconds),
        totalWorkFormatted: formatSeconds(g.totalWorkSeconds),
        avgWorkSeconds: avgWork,
        avgWorkFormatted: formatSeconds(avgWork)
      }
    })

    aggregatedList.sort((a,b) => b.totalWorkSeconds - a.totalWorkSeconds)
    return { displayItems: aggregatedList, isAggregatedView: true }
  }, [data, startDate, endDate])`
  );
}

// 4. Modify exports
// handleExportCsv
content = content.replace(
  'const handleExportCsv = () => {',
  `const handleExportCsv = () => {`
).replace(
  `if (!data || data.items.length === 0) return`,
  `if (!displayItems || displayItems.length === 0) return`
);

let exportCsvRows = `
    const csvRows: string[] = []
    const headers = isAggregatedView ? [
      'S.NO', 'DAYS PRESENT', 'EMPLOYEE ID', 'EMPLOYEE NAME', 'ROLE', 'BRANCH', 
      'AVG FIRST IN', 'AVG LAST OUT', 'TOTAL SESSIONS', 'TOTAL BREAK TIME', 'TOTAL WORK HOURS', 'AVG WORK/DAY'
    ] : [
      'S.NO', 'DATE', 'EMPLOYEE ID', 'EMPLOYEE NAME', 'ROLE', 'BRANCH',
      'FIRST IN', 'LAST OUT', 'SESSIONS', 'BREAK TIME', 'TOTAL WORK HOURS', 'STATUS'
    ]
    csvRows.push(headers.join(','))

    displayItems.forEach((item: any, index: number) => {
      if (isAggregatedView) {
        csvRows.push(
          [
            index + 1,
            \`"\${item.daysPresent} Days"\`,
            \`"\${item.employeeIdStr || ''}"\`,
            \`"\${item.employeeName.replace(/"/g, '""')}"\`,
            \`"\${(item.employeeTeam || item.userRole || '').toUpperCase()}"\`,
            \`"\${item.branchName.replace(/"/g, '""')}"\`,
            \`"\${item.avgFirstInFormatted}"\`,
            \`"\${item.avgLastOutFormatted}"\`,
            item.totalSessions,
            \`"\${item.totalBreakFormatted}"\`,
            \`"\${item.totalWorkFormatted}"\`,
            \`"\${item.avgWorkFormatted}"\`,
          ].join(',')
        )
      } else {
        csvRows.push(
          [
            index + 1,
            \`"\${item.dateString}"\`,
            \`"\${item.employeeId || ''}"\`,
            \`"\${item.employeeName.replace(/"/g, '""')}"\`,
            \`"\${(item.employeeTeam || item.userRole || '').toUpperCase()}"\`,
            \`"\${item.branchName.replace(/"/g, '""')}"\`,
            \`"\${formatTime(item.firstPunchIn)}"\`,
            \`"\${formatTime(item.lastPunchOut)}"\`,
            item.sessionCount,
            \`"\${item.totalBreakFormatted}"\`,
            \`"\${item.totalWorkFormatted}"\`,
            \`"\${item.status.toUpperCase()}"\`,
          ].join(',')
        )
      }
    })
`;

// Replace handleExportCsv internals
content = content.replace(
  /const csvRows: string\[\] = \[\]\s+const headers = \[\s+[\s\S]*?csvRows\.push\(headers\.join\(\',\'\)\)\s+data\.items\.forEach\(\(item, index\) => \{\s+csvRows\.push\([\s\S]*?\]\.join\(\',\'\),\s+\)\s+\}\)/,
  exportCsvRows.trim()
);

// Replace handleExportRoleBasedCsv internals
let roleExportCsvRows = `
    const csvRows: string[] = []
    const headers = isAggregatedView ? [
      'S.NO', 'DAYS PRESENT', 'EMPLOYEE ID', 'EMPLOYEE NAME', 'ROLE', 'BRANCH', 
      'AVG FIRST IN', 'AVG LAST OUT', 'TOTAL SESSIONS', 'TOTAL BREAK TIME', 'TOTAL WORK HOURS', 'AVG WORK/DAY'
    ] : [
      'S.NO', 'DATE', 'EMPLOYEE ID', 'EMPLOYEE NAME', 'ROLE', 'BRANCH',
      'FIRST IN', 'LAST OUT', 'SESSIONS', 'BREAK TIME', 'TOTAL WORK HOURS', 'STATUS'
    ]

    // Group items by role
    const itemsByRole: Record<string, any[]> = {}
    displayItems.forEach((item: any) => {
      const role = (item.employeeTeam || item.userRole || 'Unknown').toUpperCase()
      if (!itemsByRole[role]) {
        itemsByRole[role] = []
      }
      itemsByRole[role].push(item)
    })

    Object.keys(itemsByRole).sort().forEach((role) => {
      csvRows.push(\`"ROLE: \${role}"\`)
      csvRows.push(headers.join(','))
      
      itemsByRole[role].forEach((item: any, index: number) => {
        if (isAggregatedView) {
          csvRows.push(
            [
              index + 1,
              \`"\${item.daysPresent} Days"\`,
              \`"\${item.employeeIdStr || ''}"\`,
              \`"\${item.employeeName.replace(/"/g, '""')}"\`,
              \`"\${role}"\`,
              \`"\${item.branchName.replace(/"/g, '""')}"\`,
              \`"\${item.avgFirstInFormatted}"\`,
              \`"\${item.avgLastOutFormatted}"\`,
              item.totalSessions,
              \`"\${item.totalBreakFormatted}"\`,
              \`"\${item.totalWorkFormatted}"\`,
              \`"\${item.avgWorkFormatted}"\`,
            ].join(',')
          )
        } else {
          csvRows.push(
            [
              index + 1,
              \`"\${item.dateString}"\`,
              \`"\${item.employeeId || ''}"\`,
              \`"\${item.employeeName.replace(/"/g, '""')}"\`,
              \`"\${role}"\`,
              \`"\${item.branchName.replace(/"/g, '""')}"\`,
              \`"\${formatTime(item.firstPunchIn)}"\`,
              \`"\${formatTime(item.lastPunchOut)}"\`,
              item.sessionCount,
              \`"\${item.totalBreakFormatted}"\`,
              \`"\${item.totalWorkFormatted}"\`,
              \`"\${item.status.toUpperCase()}"\`,
            ].join(',')
          )
        }
      })
      csvRows.push('')
    })
`;
content = content.replace(
  /const csvRows: string\[\] = \[\]\s+const headers = \[\s+[\s\S]*?csvRows\.push\(\'\'\)\s+\}\)/,
  roleExportCsvRows.trim()
);
content = content.replace(
  `if (!data || data.items.length === 0) return`,
  `if (!displayItems || displayItems.length === 0) return`
);


// 5. Replace table rendering
const newTable = `
            <thead>
              <tr>
                <th style={{ width: '50px' }}>S.NO</th>
                <th>{isAggregatedView ? 'DAYS PRESENT' : 'DATE'}</th>
                <th>EMPLOYEE</th>
                <th>ROLE</th>
                <th>BRANCH</th>
                <th className="text-center">{isAggregatedView ? 'AVG FIRST IN' : 'FIRST IN'}</th>
                <th className="text-center">{isAggregatedView ? 'AVG LAST OUT' : 'LAST OUT'}</th>
                <th className="text-center">{isAggregatedView ? 'TOTAL SESSIONS' : 'BREAKS'}</th>
                <th className="text-center">{isAggregatedView ? 'TOTAL BREAK' : 'WORK HOURS'}</th>
                <th className="text-center">{isAggregatedView ? 'TOTAL WORK' : 'STATUS'}</th>
                <th className="text-center">{isAggregatedView ? 'AVG WORK/DAY' : 'ACTIONS'}</th>
              </tr>
            </thead>
            <tbody>
              {displayItems.length > 0 ? (
                displayItems.map((item: any, idx: number) => {
                  const roleClass = \`role-\${(item.employeeTeam || item.userRole || 'other').toLowerCase()}\`
                  const initials = item.employeeName
                    .split(' ')
                    .map((n: string) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()

                  return (
                    <tr
                      key={item.id || idx}
                      className={!isAggregatedView ? "clickable-row" : ""}
                      onClick={() => !isAggregatedView && setSelectedItemForModal(item)}
                    >
                      <td>{idx + 1}</td>
                      <td>{isAggregatedView ? \`\${item.daysPresent} Days\` : formatDate(item.date)}</td>
                      <td>
                        <div className="employee-cell">
                          {item.employeePhotoUrl ? (
                            <img src={item.employeePhotoUrl} alt={item.employeeName} className="avatar-thumb" />
                          ) : (
                            <div className="avatar-thumb">{initials}</div>
                          )}
                          <div className="employee-meta">
                            <span className="emp-name">{item.employeeName}</span>
                            {(item.employeeId || item.employeeIdStr) && <span className="emp-id">{item.employeeId || item.employeeIdStr}</span>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={\`role-badge \${roleClass}\`}>
                          {item.employeeTeam || item.userRole || 'STAFF'}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: 'var(--theme-text-secondary)', display: 'block' }}>
                          {item.branchName}
                        </strong>
                      </td>
                      <td className="text-center">
                        {isAggregatedView ? item.avgFirstInFormatted : formatTime(item.firstPunchIn)}
                      </td>
                      <td className="text-center">
                        {isAggregatedView ? item.avgLastOutFormatted : formatTime(item.lastPunchOut)}
                      </td>
                      <td className="text-center">
                        {isAggregatedView ? item.totalSessions : (
                          <div className="session-count">
                            <span className="count">{item.sessionCount}</span>
                          </div>
                        )}
                      </td>
                      <td className="text-center">
                        {isAggregatedView ? item.totalBreakFormatted : (
                          <strong style={{ color: 'var(--theme-warning-700)' }}>
                            {item.totalBreakFormatted}
                          </strong>
                        )}
                      </td>
                      <td className="text-center">
                        {isAggregatedView ? (
                          <strong style={{ color: 'var(--theme-success-600)' }}>
                            {item.totalWorkFormatted}
                          </strong>
                        ) : (
                          <span className={\`status-badge status-\${item.status}\`}>
                            {item.status.replace('_', ' ').toUpperCase()}
                          </span>
                        )}
                      </td>
                      <td className="text-center">
                        {isAggregatedView ? (
                          <span style={{ fontWeight: 600, color: 'var(--theme-primary-600)' }}>
                            {item.avgWorkFormatted}
                          </span>
                        ) : (
                          <button
                            className="view-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedItemForModal(item)
                            }}
                          >
                            View
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={11} className="no-data">
                    No attendance records found for this date range.
                  </td>
                </tr>
              )}
            </tbody>
`;

content = content.replace(
  /<thead>[\s\S]*?<\/tbody>/,
  newTable.trim()
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched index.tsx successfully.');
