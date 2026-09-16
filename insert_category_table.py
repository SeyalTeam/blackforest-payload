with open('src/app/(frontend)/report-graph/page.tsx', 'r') as f:
    content = f.read()

target = """                </div>
              )}"""

insertion = """                </div>
              )}
              
              {expandedSummaryView === 'categories' && expandedSelectedCategory && (
                <div style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
                  padding: '20px 16px',
                  flex: 1,
                  minWidth: 0,
                  overflowX: 'auto'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#374151' }}>
                      {expandedSelectedCategory} - Dealers
                    </h3>
                    <button onClick={() => setExpandedSelectedCategory(null)} style={{ padding: '4px', cursor: 'pointer', background: 'transparent', border: 'none' }}>
                      <X size={16} className="text-gray-500 hover:text-gray-800" />
                    </button>
                  </div>
                  <div style={{ width: '100%', overflowX: 'auto' }}>
                    <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: '0', fontSize: '13px' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '10%', textAlign: 'center', padding: '12px 8px', color: '#6b7280', fontWeight: 600, borderBottom: '2px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>S.NO</th>
                          <th style={{ backgroundColor: '#f9fafb', width: '45%', textAlign: 'left', padding: '12px 8px', color: '#6b7280', fontWeight: 600, borderBottom: '2px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>Dealer Name</th>
                          <th style={{ width: '30%', textAlign: 'right', padding: '12px 8px', color: '#6b7280', fontWeight: 600, borderBottom: '2px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>Amount</th>
                          <th style={{ backgroundColor: '#f9fafb', width: '15%', textAlign: 'center', padding: '12px 8px', color: '#6b7280', fontWeight: 600, borderBottom: '2px solid #f3f4f6' }}>Bills</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expandedCategoryDealers.length > 0 ? expandedCategoryDealers.map((dealer, i) => (
                           <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                             <td style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#ffffff', textAlign: 'center', padding: '12px 8px', color: '#6b7280', fontSize: '12px', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>{i + 1}</td>
                             <td style={{ backgroundColor: i % 2 === 0 ? '#f3f4f6' : '#f9fafb', padding: '12px 8px', color: '#374151', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dealer.dealerName || 'Unknown'}</td>
                             <td style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#ffffff', padding: '12px 8px', color: '#111827', fontWeight: 700, fontSize: '14.5px', textAlign: 'right', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>₹{Math.round(dealer.amount).toLocaleString('en-IN')}</td>
                             <td style={{ backgroundColor: i % 2 === 0 ? '#f3f4f6' : '#f9fafb', padding: '12px 8px', color: '#4b5563', fontWeight: 600, textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>
                               <span style={{ backgroundColor: '#e5e7eb', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>{dealer.count}</span>
                             </td>
                           </tr>
                        )) : (
                          <tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px' }}>No dealers found</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}"""

content = content.replace(target, insertion, 1)

with open('src/app/(frontend)/report-graph/page.tsx', 'w') as f:
    f.write(content)
