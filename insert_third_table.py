with open('src/app/(frontend)/report-graph/page.tsx', 'r') as f:
    content = f.read()

target = """                          <tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px' }}>No dealers found</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}"""

insertion = """                          <tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px' }}>No dealers found</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {expandedSummaryView === 'categories' && expandedSelectedCategory && expandedCategorySelectedDealer && (
                <div style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
                  padding: '20px 16px',
                  flex: 1.2,
                  minWidth: 0,
                  overflowX: 'auto'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#374151' }}>
                      {expandedCategorySelectedDealer} - Bills
                    </h3>
                    <button onClick={() => setExpandedCategorySelectedDealer(null)} style={{ padding: '4px', cursor: 'pointer', background: 'transparent', border: 'none' }}>
                      <X size={16} className="text-gray-500 hover:text-gray-800" />
                    </button>
                  </div>
                  <div style={{ width: '100%', overflowX: 'auto' }}>
                    <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: '0', fontSize: '13px' }}>
                      <thead>
                        <tr>
                          <th style={{ backgroundColor: '#f9fafb', width: '25%', textAlign: 'left', padding: '12px 8px', color: '#6b7280', fontWeight: 600, borderBottom: '2px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>Company Name</th>
                          <th style={{ width: '20%', textAlign: 'left', padding: '12px 8px', color: '#6b7280', fontWeight: 600, borderBottom: '2px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>Amount</th>
                          <th style={{ backgroundColor: '#f9fafb', width: '15%', textAlign: 'center', padding: '12px 8px', color: '#6b7280', fontWeight: 600, borderBottom: '2px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>Status</th>
                          <th style={{ width: '20%', textAlign: 'center', padding: '12px 8px', color: '#6b7280', fontWeight: 600, borderBottom: '2px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>Created Time</th>
                          <th style={{ backgroundColor: '#f9fafb', width: '20%', textAlign: 'center', padding: '12px 8px', color: '#6b7280', fontWeight: 600, borderBottom: '2px solid #f3f4f6' }}>Paid Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expandedCategoryDealerBills.length > 0 ? expandedCategoryDealerBills.map((bill, i) => {
                           const paidTimeStr = bill.payments && bill.payments.length > 0 ? bill.payments.map((p: any) => p.date ? dayjs(p.date).format('MMM DD, YYYY HH:mm') : '').filter(Boolean).join(', ') : (bill.status === 'paid' && bill.updatedAt ? dayjs(bill.updatedAt).format('MMM DD, YYYY HH:mm') : '');
                           
                           return (
                            <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                              <td style={{ backgroundColor: i % 2 === 0 ? '#f3f4f6' : '#f9fafb', padding: '12px 8px', color: '#374151', fontWeight: 500, textTransform: 'uppercase', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bill.companyName || '-'}</td>
                              <td style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#ffffff', padding: '12px 8px', color: '#111827', fontWeight: 700, fontSize: '14.5px', textAlign: 'left', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>₹{Math.round(bill.amountForCategory || 0).toLocaleString('en-IN')}</td>
                              <td style={{ backgroundColor: i % 2 === 0 ? '#f3f4f6' : '#f9fafb', textAlign: 'center', padding: '12px 8px', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>
                                <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '12px', backgroundColor: bill.status === 'paid' ? '#dcfce7' : bill.status === 'pending' ? '#fef9c3' : '#fee2e2', color: bill.status === 'paid' ? '#166534' : bill.status === 'pending' ? '#854d0e' : '#991b1b', textTransform: 'capitalize', fontWeight: 500 }}>{bill.status}</span>
                              </td>
                              <td style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#ffffff', textAlign: 'center', padding: '12px 8px', color: '#374151', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>{bill.time ? dayjs(bill.time).format('MMM DD, YYYY HH:mm') : '-'}</td>
                              <td style={{ backgroundColor: i % 2 === 0 ? '#f3f4f6' : '#f9fafb', textAlign: 'center', padding: '12px 8px', color: '#374151', borderBottom: '1px solid #f3f4f6', overflow: 'hidden', textOverflow: 'ellipsis' }}>{paidTimeStr || '-'}</td>
                            </tr>
                           )
                        }) : (
                          <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>No bills found</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}"""

content = content.replace(target, insertion)

with open('src/app/(frontend)/report-graph/page.tsx', 'w') as f:
    f.write(content)
