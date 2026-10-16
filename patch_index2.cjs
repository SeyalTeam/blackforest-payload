const fs = require('fs');
const file = 'src/components/AttendanceReport/index.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Update AggregatedItem type
content = content.replace(
  'employeePhotoUrl?: string',
  `employeePhotoUrl?: string\n  employeeSalary?: number\n  daysLeave: number\n  leaveDatesFormatted: string\n  salaryAmount: number\n  branchCombined: string`
);

// 2. Add AttendanceItem employeeSalary
content = content.replace(
  'employeePhotoUrl?: string\n  branchId?: string',
  `employeePhotoUrl?: string\n  employeeSalary?: number\n  branchId?: string`
);


// 3. Update useMemo inside AttendanceReport
const useMemoLogic = `
  const { displayItems, isAggregatedView, totalDaysInRange } = useMemo(() => {
    if (!data) return { displayItems: [], isAggregatedView: false, totalDaysInRange: 0 }
    const startStr = startDate ? toLocalDateStr(startDate) : ''
    const endStr = endDate ? toLocalDateStr(endDate) : ''
    const isMulti = startStr && endStr && startStr !== endStr

    if (!isMulti) {
      return { displayItems: data.items, isAggregatedView: false, totalDaysInRange: 1 }
    }

    const rangeDates = []
    if (startDate && endDate) {
      const current = new Date(startDate)
      current.setHours(0, 0, 0, 0)
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      while (current <= end) {
        rangeDates.push(toLocalDateStr(current))
        current.setDate(current.getDate() + 1)
      }
    }

    const grouped: Record<string, AggregatedItem> = {}
    data.items.forEach((item: any) => {
      const key = item.employeeId || item.userId || item.employeeName
      if (!grouped[key]) {
        grouped[key] = {
          isAggregated: true,
          id: key,
          employeeName: item.employeeName,
          employeeIdStr: item.employeeId || '',
          employeePhotoUrl: item.employeePhotoUrl,
          employeeSalary: item.employeeSalary || 0,
          userRole: item.userRole,
          employeeTeam: item.employeeTeam || '',
          branchName: item.branchName,
          daysPresent: 0,
          daysLeave: 0,
          leaveDatesFormatted: '',
          salaryAmount: 0,
          branchCombined: '',
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
      
      const presentDates = new Set(g.originalItems.map(i => i.dateString))
      const leaveDateStrings = rangeDates.filter(d => !presentDates.has(d))
      const leaveDaysNumbers = leaveDateStrings.map(d => parseInt(d.split('-')[2], 10))
      const leaveDatesFormatted = leaveDaysNumbers.length > 0 ? leaveDaysNumbers.join(',') : 'None'
      const daysLeave = leaveDateStrings.length

      const baseSalary = g.employeeSalary || 0
      // Assuming monthly salary, daily wage = salary / 30
      const salaryAmount = Math.round((baseSalary / 30) * g.daysPresent)

      const branchSet = new Set<string>()
      g.originalItems.forEach(i => {
        if (i.branchName) {
          const abbrev = i.branchName.substring(0, 3).toUpperCase()
          branchSet.add(abbrev)
        }
      })
      const branchCombined = Array.from(branchSet).join(',')

      return {
        ...g,
        daysLeave,
        leaveDatesFormatted,
        salaryAmount,
        branchCombined,
        avgFirstInFormatted: getAverageTime(firstIns),
        avgLastOutFormatted: getAverageTime(lastOuts),
        totalBreakFormatted: formatSeconds(g.totalBreakSeconds),
        totalWorkFormatted: formatSeconds(g.totalWorkSeconds),
        avgWorkSeconds: avgWork,
        avgWorkFormatted: formatSeconds(avgWork)
      }
    })

    aggregatedList.sort((a,b) => b.totalWorkSeconds - a.totalWorkSeconds)
    return { displayItems: aggregatedList, isAggregatedView: true, totalDaysInRange: rangeDates.length }
  }, [data, startDate, endDate])
`;

// Regex replace the previous useMemo
content = content.replace(
  /const \{ displayItems, isAggregatedView \} = useMemo\(\(\) => \{[\s\S]*?\}, \[data, startDate, endDate\]\)/,
  useMemoLogic.trim()
);

// 4. Update Exports
const exportHeadersMulti = `[
      'S.NO', 'EMPLOYEE NAME (ID)', 'DAYS PRESENT', 'DAYS LEAVE (DATES)', 'SALARY AMOUNT', 'BRANCH', 
      'AVG FIRST IN', 'AVG LAST OUT', 'TOTAL SESSIONS', 'TOTAL BREAK TIME', 'TOTAL WORK HOURS', 'AVG WORK/DAY'
    ]`;
const exportHeadersSingle = `[
      'S.NO', 'DATE', 'EMPLOYEE NAME (ID)', 'ROLE', 'BRANCH',
      'FIRST IN', 'LAST OUT', 'SESSIONS', 'BREAK TIME', 'TOTAL WORK HOURS', 'STATUS'
    ]`;

// Update handleExportCsv
const handleExportCsvContent = `
  const handleExportCsv = () => {
    if (!displayItems || displayItems.length === 0) return

    const csvRows: string[] = []
    const headers = isAggregatedView ? ${exportHeadersMulti} : ${exportHeadersSingle}
    csvRows.push(headers.join(','))

    displayItems.forEach((item: any, index: number) => {
      const empNameId = item.employeeIdStr || item.employeeId ? \`\${item.employeeName} (\${item.employeeIdStr || item.employeeId})\` : item.employeeName
      if (isAggregatedView) {
        csvRows.push(
          [
            index + 1,
            \`"\${empNameId.replace(/"/g, '""')}"\`,
            \`"\${item.daysPresent} Days"\`,
            \`"\${item.daysLeave} Days (\${item.leaveDatesFormatted})"\`,
            item.salaryAmount,
            \`"\${item.branchCombined}"\`,
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
            \`"\${empNameId.replace(/"/g, '""')}"\`,
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

    // Totals row
    csvRows.push(
      [
        '',
        '"TOTAL"',
        '',
        \`"\${data?.totals.uniqueEmployees || 0} Unique Staff"\`,
        '',
        '',
        '',
        '',
        '',
        \`"\${data?.totals.totalBreakFormatted || ''}"\`,
        \`"\${data?.totals.totalWorkFormatted || ''}"\`,
        \`"\${data?.totals.currentlyActive || 0} Active Now"\`,
      ].join(',')
    )

    const blob = new Blob([csvRows.join('\\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = \`attendance_report_\${startDate ? toLocalDateStr(startDate) : ''}_to_\${
      endDate ? toLocalDateStr(endDate) : ''
    }.csv\`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setShowExportMenu(false)
  }
`;
content = content.replace(/const handleExportCsv = \(\) => \{[\s\S]*?setShowExportMenu\(false\)\n  \}/, handleExportCsvContent.trim());


// Update handleExportRoleBasedCsv
const handleExportRoleBasedCsvContent = `
  const handleExportRoleBasedCsv = () => {
    if (!displayItems || displayItems.length === 0) return

    const csvRows: string[] = []
    const headers = isAggregatedView ? ${exportHeadersMulti} : ${exportHeadersSingle}

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
        const empNameId = item.employeeIdStr || item.employeeId ? \`\${item.employeeName} (\${item.employeeIdStr || item.employeeId})\` : item.employeeName
        if (isAggregatedView) {
          csvRows.push(
            [
              index + 1,
              \`"\${empNameId.replace(/"/g, '""')}"\`,
              \`"\${item.daysPresent} Days"\`,
              \`"\${item.daysLeave} Days (\${item.leaveDatesFormatted})"\`,
              item.salaryAmount,
              \`"\${item.branchCombined}"\`,
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
              \`"\${empNameId.replace(/"/g, '""')}"\`,
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

    // Totals row
    csvRows.push(
      [
        '',
        '"OVERALL TOTAL"',
        '',
        \`"\${data?.totals.uniqueEmployees || 0} Unique Staff"\`,
        '',
        '',
        '',
        '',
        '',
        \`"\${data?.totals.totalBreakFormatted || ''}"\`,
        \`"\${data?.totals.totalWorkFormatted || ''}"\`,
        \`"\${data?.totals.currentlyActive || 0} Active Now"\`,
      ].join(',')
    )

    const blob = new Blob([csvRows.join('\\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = \`attendance_report_role_based_\${startDate ? toLocalDateStr(startDate) : ''}_to_\${
      endDate ? toLocalDateStr(endDate) : ''
    }.csv\`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setShowExportMenu(false)
  }
`;
content = content.replace(/const handleExportRoleBasedCsv = \(\) => \{[\s\S]*?setShowExportMenu\(false\)\n  \}/, handleExportRoleBasedCsvContent.trim());

// 5. Update Table Rendering
const tableHeaders = `
            <thead>
              <tr>
                <th style={{ width: '50px' }}>S.NO</th>
                {isAggregatedView ? (
                  <>
                    <th>EMPLOYEE (ID)</th>
                    <th>DAYS PRESENT</th>
                    <th>DAYS LEAVE</th>
                    <th>SALARY</th>
                    <th>BRANCH</th>
                    <th className="text-center">AVG FIRST IN</th>
                    <th className="text-center">AVG LAST OUT</th>
                    <th className="text-center">TOTAL SESSIONS</th>
                    <th className="text-center">TOTAL BREAK</th>
                    <th className="text-center">TOTAL WORK</th>
                    <th className="text-center">AVG WORK/DAY</th>
                  </>
                ) : (
                  <>
                    <th>DATE</th>
                    <th>EMPLOYEE (ID)</th>
                    <th>ROLE</th>
                    <th>BRANCH</th>
                    <th className="text-center">FIRST IN</th>
                    <th className="text-center">LAST OUT</th>
                    <th className="text-center">BREAKS</th>
                    <th className="text-center">WORK HOURS</th>
                    <th className="text-center">STATUS</th>
                    <th className="text-center">ACTIONS</th>
                  </>
                )}
              </tr>
            </thead>
`;
content = content.replace(/<thead>[\s\S]*?<\/thead>/, tableHeaders.trim());

const tableBody = `
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
                      {isAggregatedView ? (
                        <>
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
                            <strong style={{ color: 'var(--theme-success-600)' }}>{item.daysPresent} Days</strong>
                          </td>
                          <td>
                            <strong style={{ color: 'var(--theme-danger-600)' }}>{item.daysLeave} Days</strong>
                            {item.daysLeave > 0 && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--theme-text-secondary)', marginTop: '2px' }}>
                                ({item.leaveDatesFormatted})
                              </div>
                            )}
                          </td>
                          <td>
                            <strong style={{ color: 'var(--theme-text-primary)' }}>₹{item.salaryAmount}</strong>
                          </td>
                          <td>
                            <strong style={{ color: 'var(--theme-text-secondary)', display: 'block' }}>
                              {item.branchCombined}
                            </strong>
                          </td>
                          <td className="text-center">{item.avgFirstInFormatted}</td>
                          <td className="text-center">{item.avgLastOutFormatted}</td>
                          <td className="text-center">{item.totalSessions}</td>
                          <td className="text-center work-hours-cell" style={{ color: 'var(--theme-warning-700)' }}>
                            {item.totalBreakFormatted}
                          </td>
                          <td className="text-center work-hours-cell">
                            <strong style={{ color: 'var(--theme-success-600)' }}>
                              {item.totalWorkFormatted}
                            </strong>
                          </td>
                          <td className="text-center">
                            <span style={{ fontWeight: 600, color: 'var(--theme-primary-600)' }}>
                              {item.avgWorkFormatted}
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{formatDate(item.date)}</td>
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
                          <td className="text-center">{formatTime(item.firstPunchIn)}</td>
                          <td className="text-center">
                            {item.status === 'active' ? (
                              <span style={{ color: '#10b981', fontWeight: 600 }}>Active Now</span>
                            ) : (
                              formatTime(item.lastPunchOut)
                            )}
                          </td>
                          <td className="text-center" style={{ color: 'var(--theme-text-secondary)' }}>
                            {item.totalBreakFormatted}
                          </td>
                          <td className="text-center work-hours-cell">{item.totalWorkFormatted}</td>
                          <td className="text-center">
                            <span className={\`status-pill \${item.status}\`}>
                              <span className="dot" />
                              {item.status === 'active'
                                ? 'Clocked In'
                                : item.status === 'on_break'
                                  ? 'On Break'
                                  : 'Clocked Out'}
                            </span>
                          </td>
                          <td className="text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="view-btn"
                              onClick={() => setSelectedItemForModal(item)}
                              title="View Attendance Timeline"
                              type="button"
                            >
                              <span>Timeline</span>
                              <span>→</span>
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={11} className="no-data">
                    No attendance records found for the selected criteria.
                  </td>
                </tr>
              )}
            </tbody>
`;
content = content.replace(/<tbody>[\s\S]*?<\/tbody>/, tableBody.trim());

fs.writeFileSync(file, content, 'utf8');
console.log('Patched index.tsx successfully.');
