import re
with open('src/app/(frontend)/report-graph/page.tsx', 'r') as f:
    content = f.read()

# Update filteredGraphData to include dealer amounts
target1 = """      let paidTotal = 0;
      let pendingTotal = 0;
      let cancelledTotal = 0;

      const adjustedItems = filteredItems.map((item: any) => {"""

replace1 = """      let paidTotal = 0;
      let pendingTotal = 0;
      let cancelledTotal = 0;
      const dealerAmounts: Record<string, number> = {};

      const adjustedItems = filteredItems.map((item: any) => {"""

content = content.replace(target1, replace1)

target2 = """         if (item.matchedReason === 'payment') {
            paidTotal += amountToAdd;
         }

         return { ...item, matchedAmount: amountToAdd };"""

replace2 = """         if (item.matchedReason === 'payment') {
            paidTotal += amountToAdd;
         }
         
         if (expandedSummaryView === 'categories' && expandedSelectedCategory && !expandedCategorySelectedDealer && item.matchedReason === 'creation') {
            const dealerName = item.dealerName || 'Unknown';
            dealerAmounts[dealerName] = (dealerAmounts[dealerName] || 0) + amountToAdd;
         }

         return { ...item, matchedAmount: amountToAdd };"""

content = content.replace(target2, replace2)

target3 = """      return {
        ...bin,
        totalPaid,
        paidTotal,
        pendingTotal,
        cancelledTotal,
        rawItems: adjustedItems
      };"""

replace3 = """      return {
        ...bin,
        totalPaid,
        paidTotal,
        pendingTotal,
        cancelledTotal,
        ...dealerAmounts,
        rawItems: adjustedItems
      };"""

content = content.replace(target3, replace3)


# Update the JSX rendering the lines
jsx_target = """                          <>
                            {visibleLines.paid && visibleLines.total && filteredGraphData.some(d => d.paidTotal > 0) && <Line type="monotone" dataKey="paidTotal" stroke="#16a34a" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Paid" />}
                            {visibleLines.pending && (visibleLines.total || visibleLines.paid) && filteredGraphData.some(d => d.pendingTotal > 0) && <Line type="monotone" dataKey="pendingTotal" stroke="#ca8a04" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Pending" />}
                            {visibleLines.cancelled && (visibleLines.total || visibleLines.paid || visibleLines.pending) && filteredGraphData.some(d => d.cancelledTotal > 0) && <Line type="monotone" dataKey="cancelledTotal" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Cancelled" />}
                          </>"""

jsx_replace = """                          <>
                            {(expandedSummaryView === 'categories' && expandedSelectedCategory && !expandedCategorySelectedDealer) ? (
                               expandedCategoryDealers.map((d, index) => {
                                 const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6'];
                                 const color = colors[index % colors.length];
                                 return <Line key={d.dealerName} type="monotone" dataKey={d.dealerName} stroke={color} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name={d.dealerName} />
                               })
                            ) : (
                               <>
                                 {visibleLines.paid && visibleLines.total && filteredGraphData.some(d => d.paidTotal > 0) && <Line type="monotone" dataKey="paidTotal" stroke="#16a34a" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Paid" />}
                                 {visibleLines.pending && (visibleLines.total || visibleLines.paid) && filteredGraphData.some(d => d.pendingTotal > 0) && <Line type="monotone" dataKey="pendingTotal" stroke="#ca8a04" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Pending" />}
                                 {visibleLines.cancelled && (visibleLines.total || visibleLines.paid || visibleLines.pending) && filteredGraphData.some(d => d.cancelledTotal > 0) && <Line type="monotone" dataKey="cancelledTotal" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Cancelled" />}
                               </>
                            )}
                          </>"""

content = content.replace(jsx_target, jsx_replace)

with open('src/app/(frontend)/report-graph/page.tsx', 'w') as f:
    f.write(content)
