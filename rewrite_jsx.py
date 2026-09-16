import re

with open('src/app/(frontend)/report-graph/page.tsx', 'r') as f:
    content = f.read()

# I will find `<ComposedChart data={filteredGraphData} margin={{ top: 85, right: 0, left: 0, bottom: 0 }}>`
# and replace everything up to `</ComposedChart>`

start_marker = "<ComposedChart data={filteredGraphData} margin={{ top: 85, right: 0, left: 0, bottom: 0 }}>"
end_marker = "</ComposedChart>"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx) + len(end_marker)

if start_idx != -1 and end_idx != -1:
    old_block = content[start_idx:end_idx]
    
    new_block = """<ComposedChart data={filteredGraphData} margin={{ top: 85, right: 0, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} dy={10} interval={0} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} dx={-10} tickFormatter={(val) => val >= 1000 ? `₹${(val / 1000).toFixed(1)}K` : `₹${val}`} orientation="left" />
                        <Tooltip 
                          cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                          position={{ y: 0 }}
                          allowEscapeViewBox={{ x: true, y: true }}
                          wrapperStyle={{ zIndex: 100 }}
                          content={(props: any) => {
                            const { active, payload } = props;
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              const label = data.label;
                              
                              let filteredItems = [];
                              if (data.rawItems && data.rawItems.length > 0) {
                                filteredItems = data.rawItems.filter((item: any) => {
                                  if (visibleLines.total && item.matchedReason === 'creation') return true;
                                  if (visibleLines.paid && item.matchedReason === 'payment') return true;
                                  if (visibleLines.pending && item.matchedReason === 'creation' && item.status === 'pending') return true;
                                  if (visibleLines.cancelled && item.matchedReason === 'creation' && item.status === 'cancelled') return true;
                                  return false;
                                });
                              }
                              const tooltipTotal = filteredItems.reduce((acc: number, item: any) => acc + (item.matchedAmount || 0), 0);

                              return (
                                <div style={{ backgroundColor: '#fff', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', minWidth: '150px' }}>
                                  {filteredItems.length > 0 ? (
                                    <>
                                      <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '8px', borderBottom: '1px solid #f3f4f6', paddingBottom: '6px' }}>
                                        {data.timeStr ? 'Time: ' : 'Date: '}
                                        <span style={{ color: '#111827', fontWeight: 600 }}>{data.timeRangeStr || data.timeStr || data.fullDate || label}</span>
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px', maxHeight: '250px', overflowY: 'scroll', paddingRight: '8px' }}>
                                        {/* Force scrollbar to be visible so Mac users know there are more items */}
                                        {filteredItems.map((item: any, i: number) => (
                                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                                            <div>
                                              <div style={{ color: '#111827', fontWeight: 600, fontSize: '13px' }}>{item.dealerName || 'Unknown'}</div>
                                              <div style={{ color: '#9ca3af', fontSize: '11px' }}>
                                                {item.companyName && <span style={{ marginRight: '4px' }}>{item.companyName} •</span>}
                                                {(() => {
                                                  if (item.matchedReason === 'payment') return item.matchedDate ? dayjs(item.matchedDate).format('HH:mm') : '';
                                                  if (item.status === 'cancelled' || item.status === 'paid') return dayjs(item.updatedAt || item.time).format('HH:mm');
                                                  return item.time ? dayjs(item.time).format('HH:mm') : '';
                                                })()}
                                              </div>
                                            </div>
                                            <div style={{ color: '#111827', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: item.status === 'paid' ? '#16a34a' : item.status === 'pending' ? '#ca8a04' : item.status === 'cancelled' ? '#ef4444' : '#60a5fa' }}></div>
                                              ₹{(item.matchedAmount || 0).toLocaleString('en-IN')}
                                              {item.status && (
                                                <span style={{ 
                                                  fontSize: '10px', 
                                                  padding: '2px 6px', 
                                                  borderRadius: '12px', 
                                                  backgroundColor: item.status === 'paid' ? '#dcfce7' : item.status === 'pending' ? '#fef9c3' : '#fee2e2', 
                                                  color: item.status === 'paid' ? '#166534' : item.status === 'pending' ? '#854d0e' : '#991b1b',
                                                  marginLeft: '4px',
                                                  textTransform: 'capitalize',
                                                  fontWeight: 500
                                                }}>
                                                  {item.matchedReason === 'payment' ? 'Paid' : 'New'}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                      {filteredItems.length > 5 && (
                                        <div style={{ textAlign: 'center', fontSize: '11px', color: '#9ca3af', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px dashed #e5e7eb' }}>
                                          ↓ Scroll down inside popup to see all {filteredItems.length} bills ↓
                                        </div>
                                      )}
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid #f3f4f6', paddingTop: '6px' }}>
                                        {visibleLines.total && (
                                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#6b7280', fontSize: '12px', fontWeight: 500 }}>Total Bill:</span>
                                            <span style={{ color: '#9333ea', fontWeight: 700, fontSize: '13px' }}>₹{(data.totalPaid || 0).toLocaleString('en-IN')}</span>
                                          </div>
                                        )}
                                        {visibleLines.paid && (
                                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#6b7280', fontSize: '12px', fontWeight: 500 }}>Paid:</span>
                                            <span style={{ color: '#16a34a', fontWeight: 700, fontSize: '13px' }}>₹{(data.paidTotal || 0).toLocaleString('en-IN')}</span>
                                          </div>
                                        )}
                                        {visibleLines.pending && (
                                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#6b7280', fontSize: '12px', fontWeight: 500 }}>Pending:</span>
                                            <span style={{ color: '#ca8a04', fontWeight: 700, fontSize: '13px' }}>₹{(data.pendingTotal || 0).toLocaleString('en-IN')}</span>
                                          </div>
                                        )}
                                        {visibleLines.cancelled && (
                                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#6b7280', fontSize: '12px', fontWeight: 500 }}>Cancelled:</span>
                                            <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '13px' }}>₹{(data.cancelledTotal || 0).toLocaleString('en-IN')}</span>
                                          </div>
                                        )}
                                      </div>
                                    </>
                                  ) : (
                                    <div style={{ color: '#6b7280', fontSize: '12px' }}>No bills matched</div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        
                        {(expandedSummaryView === 'categories' && expandedSelectedCategory && !expandedCategorySelectedDealer) ? (
                           expandedCategoryDealers.map((d, index) => {
                             const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6'];
                             const color = colors[index % colors.length];
                             return <Line key={d.dealerName} type="monotone" dataKey={d.dealerName} stroke={color} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name={d.dealerName} />
                           })
                        ) : graphType === 'bar' ? (
                          <>
                            {visibleLines.total && <Bar dataKey="totalPaid" fill="#9333ea" radius={[4, 4, 0, 0]} maxBarSize={30} name="Total Bill" />}
                            {visibleLines.paid && <Bar dataKey="paidTotal" fill="#16a34a" radius={[4, 4, 0, 0]} maxBarSize={30} name="Paid" />}
                            {visibleLines.pending && <Bar dataKey="pendingTotal" fill="#ca8a04" radius={[4, 4, 0, 0]} maxBarSize={30} name="Pending" />}
                            {visibleLines.cancelled && <Bar dataKey="cancelledTotal" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={30} name="Cancelled" />}
                          </>
                        ) : (
                          <>
                            {visibleLines.total && (
                              <Bar dataKey="totalPaid" fill="#9333ea" fillOpacity={(visibleLines.paid || visibleLines.pending || visibleLines.cancelled) ? 0.2 : 1} radius={[4, 4, 0, 0]} barSize={16} name="Total Bill" />
                            )}
                            {!visibleLines.total && visibleLines.paid && (
                              <Bar dataKey="paidTotal" fill="#16a34a" fillOpacity={(visibleLines.pending || visibleLines.cancelled) ? 0.2 : 1} radius={[4, 4, 0, 0]} barSize={16} name="Paid" />
                            )}
                            {!visibleLines.total && !visibleLines.paid && visibleLines.pending && (
                              <Bar dataKey="pendingTotal" fill="#ca8a04" fillOpacity={(visibleLines.cancelled) ? 0.2 : 1} radius={[4, 4, 0, 0]} barSize={16} name="Pending" />
                            )}
                            {!visibleLines.total && !visibleLines.paid && !visibleLines.pending && visibleLines.cancelled && (
                              <Bar dataKey="cancelledTotal" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={16} name="Cancelled" />
                            )}
                            
                            {visibleLines.paid && visibleLines.total && filteredGraphData.some(d => d.paidTotal > 0) && <Line type="monotone" dataKey="paidTotal" stroke="#16a34a" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Paid" />}
                            {visibleLines.pending && (visibleLines.total || visibleLines.paid) && filteredGraphData.some(d => d.pendingTotal > 0) && <Line type="monotone" dataKey="pendingTotal" stroke="#ca8a04" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Pending" />}
                            {visibleLines.cancelled && (visibleLines.total || visibleLines.paid || visibleLines.pending) && filteredGraphData.some(d => d.cancelledTotal > 0) && <Line type="monotone" dataKey="cancelledTotal" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Cancelled" />}
                          </>
                        )}
                      </ComposedChart>"""

    content = content[:start_idx] + new_block + content[end_idx:]
    with open('src/app/(frontend)/report-graph/page.tsx', 'w') as f:
        f.write(content)
    print("Done")
else:
    print("Not found")

