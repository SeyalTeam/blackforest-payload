with open('src/app/(frontend)/report-graph/page.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "<tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>",
    "<tr key={i} onClick={() => setExpandedCategorySelectedDealer(dealer.dealerName)} style={{ borderBottom: '1px solid #e5e7eb', cursor: 'pointer', backgroundColor: expandedCategorySelectedDealer === dealer.dealerName ? '#eef2ff' : 'transparent', outline: expandedCategorySelectedDealer === dealer.dealerName ? '2px solid #6366f1' : 'none', outlineOffset: '-2px' }}>",
    1
)

content = content.replace(
    "<td style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#ffffff', textAlign: 'center', padding: '12px 8px', color: '#6b7280', fontSize: '12px', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>{i + 1}</td>",
    "<td style={{ backgroundColor: expandedCategorySelectedDealer === dealer.dealerName ? 'transparent' : i % 2 === 0 ? '#f9fafb' : '#ffffff', textAlign: 'center', padding: '12px 8px', color: '#6b7280', fontSize: '12px', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>{i + 1}</td>",
    1
)

content = content.replace(
    "<td style={{ backgroundColor: i % 2 === 0 ? '#f3f4f6' : '#f9fafb', padding: '12px 8px', color: '#374151', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dealer.dealerName || 'Unknown'}</td>",
    "<td style={{ backgroundColor: expandedCategorySelectedDealer === dealer.dealerName ? 'transparent' : i % 2 === 0 ? '#f3f4f6' : '#f9fafb', padding: '12px 8px', color: '#374151', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dealer.dealerName || 'Unknown'}</td>",
    1
)

content = content.replace(
    "<td style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#ffffff', padding: '12px 8px', color: '#111827', fontWeight: 700, fontSize: '14.5px', textAlign: 'right', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>₹{Math.round(dealer.amount).toLocaleString('en-IN')}</td>",
    "<td style={{ backgroundColor: expandedCategorySelectedDealer === dealer.dealerName ? 'transparent' : i % 2 === 0 ? '#f9fafb' : '#ffffff', padding: '12px 8px', color: '#111827', fontWeight: 700, fontSize: '14.5px', textAlign: 'right', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>₹{Math.round(dealer.amount).toLocaleString('en-IN')}</td>",
    1
)

with open('src/app/(frontend)/report-graph/page.tsx', 'w') as f:
    f.write(content)

