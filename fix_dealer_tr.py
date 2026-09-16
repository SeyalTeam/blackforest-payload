with open('src/app/(frontend)/report-graph/page.tsx', 'r') as f:
    content = f.read()

target = """                           <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                             <td style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#ffffff', textAlign: 'center', padding: '12px 8px', color: '#6b7280', fontSize: '12px', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>{i + 1}</td>
                             <td style={{ backgroundColor: i % 2 === 0 ? '#f3f4f6' : '#f9fafb', padding: '12px 8px', color: '#374151', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dealer.dealerName || 'Unknown'}</td>
                             <td style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#ffffff', padding: '12px 8px', color: '#111827', fontWeight: 700, fontSize: '14.5px', textAlign: 'right', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>₹{Math.round(dealer.amount).toLocaleString('en-IN')}</td>
                             <td style={{ backgroundColor: i % 2 === 0 ? '#f3f4f6' : '#f9fafb', padding: '12px 8px', color: '#4b5563', fontWeight: 600, textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>
                               <span style={{ backgroundColor: '#e5e7eb', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>{dealer.count}</span>
                             </td>
                           </tr>"""

replacement = """                           <tr key={i} onClick={() => setExpandedCategorySelectedDealer(dealer.dealerName)} style={{ borderBottom: '1px solid #e5e7eb', cursor: 'pointer', backgroundColor: expandedCategorySelectedDealer === dealer.dealerName ? '#eef2ff' : 'transparent', outline: expandedCategorySelectedDealer === dealer.dealerName ? '2px solid #6366f1' : 'none', outlineOffset: '-2px' }}>
                             <td style={{ backgroundColor: expandedCategorySelectedDealer === dealer.dealerName ? 'transparent' : i % 2 === 0 ? '#f9fafb' : '#ffffff', textAlign: 'center', padding: '12px 8px', color: '#6b7280', fontSize: '12px', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>{i + 1}</td>
                             <td style={{ backgroundColor: expandedCategorySelectedDealer === dealer.dealerName ? 'transparent' : i % 2 === 0 ? '#f3f4f6' : '#f9fafb', padding: '12px 8px', color: '#374151', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dealer.dealerName || 'Unknown'}</td>
                             <td style={{ backgroundColor: expandedCategorySelectedDealer === dealer.dealerName ? 'transparent' : i % 2 === 0 ? '#f9fafb' : '#ffffff', padding: '12px 8px', color: '#111827', fontWeight: 700, fontSize: '14.5px', textAlign: 'right', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>₹{Math.round(dealer.amount).toLocaleString('en-IN')}</td>
                             <td style={{ backgroundColor: expandedCategorySelectedDealer === dealer.dealerName ? 'transparent' : i % 2 === 0 ? '#f3f4f6' : '#f9fafb', padding: '12px 8px', color: '#4b5563', fontWeight: 600, textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>
                               <span style={{ backgroundColor: expandedCategorySelectedDealer === dealer.dealerName ? '#c7d2fe' : '#e5e7eb', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', color: expandedCategorySelectedDealer === dealer.dealerName ? '#3730a3' : 'inherit' }}>{dealer.count}</span>
                             </td>
                           </tr>"""

content = content.replace(target, replacement)

with open('src/app/(frontend)/report-graph/page.tsx', 'w') as f:
    f.write(content)

