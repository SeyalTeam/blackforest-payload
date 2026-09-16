with open('src/app/(frontend)/report-graph/page.tsx', 'r') as f:
    content = f.read()

target = """                        {graphType === 'bar' ? (
                          <>
                            {visibleLines.total && <Bar dataKey="totalPaid" fill="#9333ea" radius={[4, 4, 0, 0]} maxBarSize={30} name="Total Bill" />}
                            {visibleLines.paid && <Bar dataKey="paidTotal" fill="#16a34a" radius={[4, 4, 0, 0]} maxBarSize={30} name="Paid" />}
                            {visibleLines.pending && <Bar dataKey="pendingTotal" fill="#ca8a04" radius={[4, 4, 0, 0]} maxBarSize={30} name="Pending" />}
                            {visibleLines.cancelled && <Bar dataKey="cancelledTotal" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={30} name="Cancelled" />}
                          </>
                        ) : (
                          <>
                            {(expandedSummaryView === 'categories' && expandedSelectedCategory && !expandedCategorySelectedDealer) ? (
                               expandedCategoryDealers.map((d, index) => {
                                 const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6'];
                                 const color = colors[index % colors.length];
                                 return <Line key={d.dealerName} type="monotone" dataKey={d.dealerName} stroke={color} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name={d.dealerName} />
                               })
                            ) : ("""

replace = """                        {(expandedSummaryView === 'categories' && expandedSelectedCategory && !expandedCategorySelectedDealer) ? (
                             expandedCategoryDealers.map((d, index) => {
                               const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6'];
                               const color = colors[index % colors.length];
                               // If user wants lines even in bar mode:
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
                            (
"""

# Wait, the structure in the file currently is:
#                         {graphType === 'bar' ? (
#                           <>
#                             {visibleLines.total && <Bar dataKey="totalPaid" fill="#9333ea" radius={[4, 4, 0, 0]} maxBarSize={30} name="Total Bill" />}
#                             ...
#                           </>
#                         ) : (
#                           <>
#                             {(expandedSummaryView === 'categories' && expandedSelectedCategory && !expandedCategorySelectedDealer) ? (
#                                ...
#                             ) : (
#                                <>
#                                  {visibleLines.total && (
#                                    <Bar dataKey="totalPaid" fill="#9333ea" fillOpacity={(visibleLines.paid || visibleLines.pending || visibleLines.cancelled) ? 0.2 : 1} radius={[4, 4, 0, 0]} barSize={16} name="Total Bill" />
#                                  )}

