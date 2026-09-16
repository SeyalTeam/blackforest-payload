import re

with open('src/app/(frontend)/report-graph/page.tsx', 'r') as f:
    content = f.read()

# 1. States
state_target = "const [expandedSummaryView, setExpandedSummaryView] = useState<'none' | 'dealers' | 'categories'>('none')"
state_replacement = """const [expandedSummaryView, setExpandedSummaryView] = useState<'none' | 'dealers' | 'categories'>('none')
  const [expandedSelectedDealer, setExpandedSelectedDealer] = useState<string | null>(null)
  const [expandedSelectedCategory, setExpandedSelectedCategory] = useState<string | null>(null)
  const [expandedSelectedCategoryDealer, setExpandedSelectedCategoryDealer] = useState<string | null>(null)"""
content = content.replace(state_target, state_replacement, 1)

# 2. useMemo for expandedCategoryDealers and expandedCategoryDealerBills
# Let's find a good place. After `totalCategoryAmount` which might exist.
memo_target = """  const totalCategoryAmount = useMemo(() => {
    return categorySummary.reduce((acc, c) => acc + c.amount, 0);
  }, [categorySummary]);"""

memo_replacement = """  const expandedCategoryDealers = useMemo(() => {
    if (!expandedSelectedCategory || !rawMaterialData.length) return [];

    const map: Record<string, { amount: number; count: number }> = {};
    const processedBills = new Set<string>();

    rawMaterialData.forEach(d => {
      if (d.rawItems) {
        d.rawItems.forEach((item: any) => {
          let shouldInclude = false;
          if (visibleLines.total && item.matchedReason === 'creation') shouldInclude = true;
          if (visibleLines.paid && item.matchedReason === 'payment') shouldInclude = true;
          if (visibleLines.pending && item.matchedReason === 'creation' && item.status === 'pending') shouldInclude = true;
          if (visibleLines.cancelled && item.matchedReason === 'creation' && item.status === 'cancelled') shouldInclude = true;

          if (shouldInclude && !processedBills.has(item.id)) {
             let catAmountInBill = 0;
             if (item.rawMaterials) {
               item.rawMaterials.forEach((rm: any) => {
                 if (!rm.category) return;
                 const catName = categories.find((c: any) => c.id === rm.category)?.name || 'Unknown Category';
                 if (catName === expandedSelectedCategory) {
                   const amt = rm.totalAmount || 0;
                   const billTotal = item.amount || 1;
                   const factor = item.matchedAmount / billTotal;
                   catAmountInBill += (amt * factor);
                 }
               });
             }

             if (catAmountInBill > 0) {
                processedBills.add(item.id);
                const dealerName = item.dealerName || 'Unknown';
                if (!map[dealerName]) map[dealerName] = { amount: 0, count: 0 };
                map[dealerName].amount += catAmountInBill;
                map[dealerName].count += 1;
             }
          }
        });
      }
    });

    return Object.entries(map)
      .map(([dealerName, data]) => ({ dealerName, amount: data.amount, count: data.count }))
      .sort((a, b) => b.amount - a.amount);
  }, [rawMaterialData, expandedSelectedCategory, visibleLines, categories]);

  const expandedCategoryDealerBills = useMemo(() => {
    if (!expandedSelectedCategory || !expandedSelectedCategoryDealer || !rawMaterialData.length) return [];

    const bills: any[] = [];
    const processedBills = new Set<string>();

    rawMaterialData.forEach(d => {
      if (d.rawItems) {
        d.rawItems.forEach((item: any) => {
          const dealerName = item.dealerName || 'Unknown';
          if (dealerName !== expandedSelectedCategoryDealer) return;

          let shouldInclude = false;
          if (visibleLines.total && item.matchedReason === 'creation') shouldInclude = true;
          if (visibleLines.paid && item.matchedReason === 'payment') shouldInclude = true;
          if (visibleLines.pending && item.matchedReason === 'creation' && item.status === 'pending') shouldInclude = true;
          if (visibleLines.cancelled && item.matchedReason === 'creation' && item.status === 'cancelled') shouldInclude = true;

          if (shouldInclude && !processedBills.has(item.id)) {
            let catAmountInBill = 0;
            if (item.rawMaterials) {
              item.rawMaterials.forEach((rm: any) => {
                if (!rm.category) return;
                const catName = categories.find((c: any) => c.id === rm.category)?.name || 'Unknown Category';
                if (catName === expandedSelectedCategory) {
                  const amt = rm.totalAmount || 0;
                  const billTotal = item.amount || 1;
                  const factor = item.matchedAmount / billTotal;
                  catAmountInBill += (amt * factor);
                }
              });
            }

            if (catAmountInBill > 0) {
               processedBills.add(item.id);
               bills.push({
                  ...item,
                  displayAmount: catAmountInBill
               });
            }
          }
        });
      }
    });

    return bills.sort((a, b) => new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime());
  }, [rawMaterialData, expandedSelectedCategory, expandedSelectedCategoryDealer, visibleLines, categories]);

  const totalCategoryAmount = useMemo(() => {
    return categorySummary.reduce((acc, c) => acc + c.amount, 0);
  }, [categorySummary]);"""
content = content.replace(memo_target, memo_replacement, 1)

# 3. expandedDealerBills useMemo (we might have lost it too)
dealer_bills_memo = """  const expandedDealerBills = useMemo(() => {
    if (!expandedSelectedDealer || !rawMaterialData.length) return [];
    const bills: any[] = [];
    const processedBills = new Set<string>();

    rawMaterialData.forEach(d => {
      if (d.rawItems) {
        d.rawItems.forEach((item: any) => {
          if (item.dealerName !== expandedSelectedDealer) return;

          let shouldInclude = false;
          if (visibleLines.total && item.matchedReason === 'creation') shouldInclude = true;
          if (visibleLines.paid && item.matchedReason === 'payment') shouldInclude = true;
          if (visibleLines.pending && item.matchedReason === 'creation' && item.status === 'pending') shouldInclude = true;
          if (visibleLines.cancelled && item.matchedReason === 'creation' && item.status === 'cancelled') shouldInclude = true;

          if (shouldInclude && !processedBills.has(item.id)) {
            processedBills.add(item.id);
            bills.push(item);
          }
        });
      }
    });
    return bills.sort((a, b) => new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime());
  }, [rawMaterialData, expandedSelectedDealer, visibleLines]);"""

memo_target2 = """  const processedDataForDonut = useMemo(() => {"""
content = content.replace(memo_target2, dealer_bills_memo + "\n\n" + memo_target2, 1)

# 4. Fix table styling for fixed layout in existing dealer summary tables
# First find the table under dealers summary
import re

content = re.sub(
    r"<table style=\{\{ width: '100%', borderCollapse: 'separate', borderSpacing: '0', fontSize: '13px' \}\}>",
    "<table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: '0', fontSize: '13px' }}>",
    content
)

# 5. Fix dates wrapping in dealers summary
content = content.replace(
    "<td style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#ffffff', textAlign: 'center', padding: '12px 8px', color: '#374151', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6', whiteSpace: 'nowrap' }}>{bill.time ? dayjs(bill.time).format('MMM DD, YYYY HH:mm') : '-'}</td>",
    "<td style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#ffffff', textAlign: 'center', padding: '12px 8px', color: '#374151', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>{bill.time ? dayjs(bill.time).format('MMM DD, YYYY HH:mm') : '-'}</td>"
)
content = content.replace(
    "<td style={{ backgroundColor: i % 2 === 0 ? '#f3f4f6' : '#f9fafb', textAlign: 'center', padding: '12px 8px', color: '#374151', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{paidTimeStr || '-'}</td>",
    "<td style={{ backgroundColor: i % 2 === 0 ? '#f3f4f6' : '#f9fafb', textAlign: 'center', padding: '12px 8px', color: '#374151', borderBottom: '1px solid #f3f4f6', overflow: 'hidden', textOverflow: 'ellipsis' }}>{paidTimeStr || '-'}</td>"
)

# 6. Clickable dealer row in main dealers summary
content = re.sub(
    r"<tr key=\{i\} style=\{\{ borderBottom: '1px solid #e5e7eb' \}\}>(\s+)<td style=\{\{ backgroundColor: i % 2 === 0 \? '#f9fafb' : '#ffffff', textAlign: 'center'",
    r"<tr key={i} onClick={() => setExpandedSelectedDealer(dealer.dealerName)} style={{ borderBottom: '1px solid #e5e7eb', cursor: 'pointer', backgroundColor: expandedSelectedDealer === dealer.dealerName ? '#eef2ff' : 'transparent', outline: expandedSelectedDealer === dealer.dealerName ? '2px solid #6366f1' : 'none', outlineOffset: '-2px' }}>\1<td style={{ backgroundColor: expandedSelectedDealer === dealer.dealerName ? 'transparent' : i % 2 === 0 ? '#f9fafb' : '#ffffff', textAlign: 'center'",
    content,
    count=1
)
content = re.sub(
    r"<td style=\{\{ backgroundColor: i % 2 === 0 \? '#f3f4f6' : '#f9fafb', padding: '12px 8px', color: '#374151', fontWeight: 700, textTransform: 'uppercase'",
    r"<td style={{ backgroundColor: expandedSelectedDealer === dealer.dealerName ? 'transparent' : i % 2 === 0 ? '#f3f4f6' : '#f9fafb', padding: '12px 8px', color: '#374151', fontWeight: 700, textTransform: 'uppercase'",
    content,
    count=1
)
content = re.sub(
    r"<td style=\{\{ backgroundColor: i % 2 === 0 \? '#f9fafb' : '#ffffff', padding: '12px 8px', color: '#111827', fontWeight: 700, fontSize: '14.5px', textAlign: 'left'",
    r"<td style={{ backgroundColor: expandedSelectedDealer === dealer.dealerName ? 'transparent' : i % 2 === 0 ? '#f9fafb' : '#ffffff', padding: '12px 8px', color: '#111827', fontWeight: 700, fontSize: '14.5px', textAlign: 'left'",
    content,
    count=1
)
content = re.sub(
    r"<span style=\{\{ backgroundColor: '#e5e7eb', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' \}\}>\{dealer\.count\}</span>",
    r"<span style={{ backgroundColor: expandedSelectedDealer === dealer.dealerName ? '#c7d2fe' : '#e5e7eb', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', color: expandedSelectedDealer === dealer.dealerName ? '#3730a3' : 'inherit' }}>{dealer.count}</span>",
    content,
    count=1
)
content = re.sub(
    r"<td style=\{\{ backgroundColor: i % 2 === 0 \? '#f3f4f6' : '#f9fafb', padding: '12px 8px', color: '#4b5563', fontWeight: 600, textAlign: 'center'",
    r"<td style={{ backgroundColor: expandedSelectedDealer === dealer.dealerName ? 'transparent' : i % 2 === 0 ? '#f3f4f6' : '#f9fafb', padding: '12px 8px', color: '#4b5563', fontWeight: 600, textAlign: 'center'",
    content,
    count=1
)

# 7. Clickable category row in main category summary
content = re.sub(
    r"<tr key=\{i\} style=\{\{ borderBottom: '1px solid #e5e7eb' \}\}>(\s+)<td style=\{\{ backgroundColor: i % 2 === 0 \? '#f9fafb' : '#ffffff', textAlign: 'center', padding: '12px 8px', color: '#6b7280', fontSize: '12px', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6' \}\}>\{i \+ 1\}</td>(\s+)<td style=\{\{ backgroundColor: i % 2 === 0 \? '#f3f4f6' : '#f9fafb', padding: '12px 8px', color: '#374151', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6' \}\}>\{cat.name\}</td>(\s+)<td style=\{\{ backgroundColor: i % 2 === 0 \? '#f9fafb' : '#ffffff', padding: '12px 8px', color: '#111827', fontWeight: 700, fontSize: '14.5px', textAlign: 'right', borderBottom: '1px solid #f3f4f6' \}\}>₹\{Math.round\(cat.amount\).toLocaleString\('en-IN'\)\}</td>(\s+)</tr>",
    r"""<tr key={i} onClick={() => setExpandedSelectedCategory(cat.name)} style={{ borderBottom: '1px solid #e5e7eb', cursor: 'pointer', backgroundColor: expandedSelectedCategory === cat.name ? '#eef2ff' : 'transparent', outline: expandedSelectedCategory === cat.name ? '2px solid #6366f1' : 'none', outlineOffset: '-2px' }}>\1<td style={{ backgroundColor: expandedSelectedCategory === cat.name ? 'transparent' : i % 2 === 0 ? '#f9fafb' : '#ffffff', textAlign: 'center', padding: '12px 8px', color: '#6b7280', fontSize: '12px', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>{i + 1}</td>\2<td style={{ backgroundColor: expandedSelectedCategory === cat.name ? 'transparent' : i % 2 === 0 ? '#f3f4f6' : '#f9fafb', padding: '12px 8px', color: '#374151', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>{cat.name}</td>\3<td style={{ backgroundColor: expandedSelectedCategory === cat.name ? 'transparent' : i % 2 === 0 ? '#f9fafb' : '#ffffff', padding: '12px 8px', color: '#111827', fontWeight: 700, fontSize: '14.5px', textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>₹{Math.round(cat.amount).toLocaleString('en-IN')}</td>\4</tr>""",
    content,
    count=1
)

# 8. Flex widths
content = content.replace(
    "flex: expandedSummaryView !== 'none' ? '1' : '0 0 calc(75% - 10px)',",
    "flex: expandedSummaryView === 'categories' ? '0 0 25%' : expandedSummaryView === 'dealers' ? '0 0 35%' : expandedSummaryView !== 'none' ? '1' : '0 0 calc(75% - 10px)',"
)

# 9. Inject Dealer Bills table
table_insertion = """              {expandedSummaryView === 'dealers' && expandedSelectedDealer && (
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
                      {expandedSelectedDealer} - Bills
                    </h3>
                    <button onClick={() => setExpandedSelectedDealer(null)} style={{ padding: '4px', cursor: 'pointer', background: 'transparent', border: 'none' }}>
                      <X size={16} className="text-gray-500 hover:text-gray-800" />
                    </button>
                  </div>
                  <div style={{ width: '100%', overflowX: 'auto' }}>
                    <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: '0', fontSize: '13px' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '5%', textAlign: 'center', padding: '12px 8px', color: '#6b7280', fontWeight: 600, borderBottom: '2px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>S.NO</th>
                          <th style={{ backgroundColor: '#f9fafb', width: '25%', textAlign: 'left', padding: '12px 8px', color: '#6b7280', fontWeight: 600, borderBottom: '2px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>Company Name</th>
                          <th style={{ width: '20%', textAlign: 'left', padding: '12px 8px', color: '#6b7280', fontWeight: 600, borderBottom: '2px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>Amount</th>
                          <th style={{ backgroundColor: '#f9fafb', width: '15%', textAlign: 'center', padding: '12px 8px', color: '#6b7280', fontWeight: 600, borderBottom: '2px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>Status</th>
                          <th style={{ width: '17%', textAlign: 'center', padding: '12px 8px', color: '#6b7280', fontWeight: 600, borderBottom: '2px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>Created Time</th>
                          <th style={{ backgroundColor: '#f9fafb', width: '18%', textAlign: 'center', padding: '12px 8px', color: '#6b7280', fontWeight: 600, borderBottom: '2px solid #f3f4f6' }}>Paid Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expandedDealerBills.length > 0 ? expandedDealerBills.map((bill, i) => {
                           const paidTimeStr = bill.payments && bill.payments.length > 0 ? bill.payments.map((p: any) => p.date ? dayjs(p.date).format('MMM DD, YYYY HH:mm') : '').filter(Boolean).join(', ') : (bill.status === 'paid' && bill.updatedAt ? dayjs(bill.updatedAt).format('MMM DD, YYYY HH:mm') : '');
                           
                           return (
                            <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                              <td style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#ffffff', textAlign: 'center', padding: '12px 8px', color: '#6b7280', fontSize: '12px', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>{i + 1}</td>
                              <td style={{ backgroundColor: i % 2 === 0 ? '#f3f4f6' : '#f9fafb', padding: '12px 8px', color: '#374151', fontWeight: 500, textTransform: 'uppercase', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bill.companyName || '-'}</td>
                              <td style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#ffffff', padding: '12px 8px', color: '#111827', fontWeight: 700, fontSize: '14.5px', textAlign: 'left', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>₹{(bill.amount || bill.matchedAmount || 0).toLocaleString('en-IN')}</td>
                              <td style={{ backgroundColor: i % 2 === 0 ? '#f3f4f6' : '#f9fafb', textAlign: 'center', padding: '12px 8px', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>
                                <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '12px', backgroundColor: bill.status === 'paid' ? '#dcfce7' : bill.status === 'pending' ? '#fef9c3' : '#fee2e2', color: bill.status === 'paid' ? '#166534' : bill.status === 'pending' ? '#854d0e' : '#991b1b', textTransform: 'capitalize', fontWeight: 500 }}>{bill.status}</span>
                              </td>
                              <td style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#ffffff', textAlign: 'center', padding: '12px 8px', color: '#374151', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>{bill.time ? dayjs(bill.time).format('MMM DD, YYYY HH:mm') : '-'}</td>
                              <td style={{ backgroundColor: i % 2 === 0 ? '#f3f4f6' : '#f9fafb', textAlign: 'center', padding: '12px 8px', color: '#374151', borderBottom: '1px solid #f3f4f6', overflow: 'hidden', textOverflow: 'ellipsis' }}>{paidTimeStr || '-'}</td>
                            </tr>
                           )
                        }) : (
                          <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>No bills found</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {expandedSummaryView === 'categories' && expandedSelectedCategory && (
                <div style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
                  padding: '20px 16px',
                  flex: expandedSelectedCategoryDealer ? '0 0 25%' : 1,
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
                           <tr 
                             key={i} 
                             onClick={() => setExpandedSelectedCategoryDealer(dealer.dealerName)}
                             style={{ 
                               borderBottom: '1px solid #e5e7eb',
                               cursor: 'pointer',
                               backgroundColor: expandedSelectedCategoryDealer === dealer.dealerName ? '#eef2ff' : 'transparent',
                               outline: expandedSelectedCategoryDealer === dealer.dealerName ? '2px solid #6366f1' : 'none',
                               outlineOffset: '-2px'
                             }}
                           >
                             <td style={{ backgroundColor: expandedSelectedCategoryDealer === dealer.dealerName ? 'transparent' : i % 2 === 0 ? '#f9fafb' : '#ffffff', textAlign: 'center', padding: '12px 8px', color: '#6b7280', fontSize: '12px', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>{i + 1}</td>
                             <td style={{ backgroundColor: expandedSelectedCategoryDealer === dealer.dealerName ? 'transparent' : i % 2 === 0 ? '#f3f4f6' : '#f9fafb', padding: '12px 8px', color: '#374151', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dealer.dealerName || 'Unknown'}</td>
                             <td style={{ backgroundColor: expandedSelectedCategoryDealer === dealer.dealerName ? 'transparent' : i % 2 === 0 ? '#f9fafb' : '#ffffff', padding: '12px 8px', color: '#111827', fontWeight: 700, fontSize: '14.5px', textAlign: 'right', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>₹{Math.round(dealer.amount).toLocaleString('en-IN')}</td>
                             <td style={{ backgroundColor: expandedSelectedCategoryDealer === dealer.dealerName ? 'transparent' : i % 2 === 0 ? '#f3f4f6' : '#f9fafb', padding: '12px 8px', color: '#4b5563', fontWeight: 600, textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>
                               <span style={{ backgroundColor: expandedSelectedCategoryDealer === dealer.dealerName ? '#c7d2fe' : '#e5e7eb', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', color: expandedSelectedCategoryDealer === dealer.dealerName ? '#3730a3' : 'inherit' }}>{dealer.count}</span>
                             </td>
                           </tr>
                        )) : (
                          <tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px' }}>No dealers found</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {expandedSummaryView === 'categories' && expandedSelectedCategoryDealer && (
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
                      {expandedSelectedCategoryDealer} - Bills
                    </h3>
                    <button onClick={() => setExpandedSelectedCategoryDealer(null)} style={{ padding: '4px', cursor: 'pointer', background: 'transparent', border: 'none' }}>
                      <X size={16} className="text-gray-500 hover:text-gray-800" />
                    </button>
                  </div>
                  <div style={{ width: '100%', overflowX: 'auto' }}>
                    <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: '0', fontSize: '13px' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '5%', textAlign: 'center', padding: '12px 8px', color: '#6b7280', fontWeight: 600, borderBottom: '2px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>S.NO</th>
                          <th style={{ backgroundColor: '#f9fafb', width: '25%', textAlign: 'left', padding: '12px 8px', color: '#6b7280', fontWeight: 600, borderBottom: '2px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>Company Name</th>
                          <th style={{ width: '20%', textAlign: 'left', padding: '12px 8px', color: '#6b7280', fontWeight: 600, borderBottom: '2px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>Amount</th>
                          <th style={{ backgroundColor: '#f9fafb', width: '15%', textAlign: 'center', padding: '12px 8px', color: '#6b7280', fontWeight: 600, borderBottom: '2px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>Status</th>
                          <th style={{ width: '17%', textAlign: 'center', padding: '12px 8px', color: '#6b7280', fontWeight: 600, borderBottom: '2px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>Created Time</th>
                          <th style={{ backgroundColor: '#f9fafb', width: '18%', textAlign: 'center', padding: '12px 8px', color: '#6b7280', fontWeight: 600, borderBottom: '2px solid #f3f4f6' }}>Paid Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expandedCategoryDealerBills.length > 0 ? expandedCategoryDealerBills.map((bill, i) => {
                           const paidTimeStr = bill.payments && bill.payments.length > 0 ? bill.payments.map((p: any) => p.date ? dayjs(p.date).format('MMM DD, YYYY HH:mm') : '').filter(Boolean).join(', ') : (bill.status === 'paid' && bill.updatedAt ? dayjs(bill.updatedAt).format('MMM DD, YYYY HH:mm') : '');
                           
                           return (
                            <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                              <td style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#ffffff', textAlign: 'center', padding: '12px 8px', color: '#6b7280', fontSize: '12px', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>{i + 1}</td>
                              <td style={{ backgroundColor: i % 2 === 0 ? '#f3f4f6' : '#f9fafb', padding: '12px 8px', color: '#374151', fontWeight: 500, textTransform: 'uppercase', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bill.companyName || '-'}</td>
                              <td style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#ffffff', padding: '12px 8px', color: '#111827', fontWeight: 700, fontSize: '14.5px', textAlign: 'left', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>₹{(bill.displayAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                              <td style={{ backgroundColor: i % 2 === 0 ? '#f3f4f6' : '#f9fafb', textAlign: 'center', padding: '12px 8px', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>
                                <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '12px', backgroundColor: bill.status === 'paid' ? '#dcfce7' : bill.status === 'pending' ? '#fef9c3' : '#fee2e2', color: bill.status === 'paid' ? '#166534' : bill.status === 'pending' ? '#854d0e' : '#991b1b', textTransform: 'capitalize', fontWeight: 500 }}>{bill.status}</span>
                              </td>
                              <td style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#ffffff', textAlign: 'center', padding: '12px 8px', color: '#374151', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }}>{bill.time ? dayjs(bill.time).format('MMM DD, YYYY HH:mm') : '-'}</td>
                              <td style={{ backgroundColor: i % 2 === 0 ? '#f3f4f6' : '#f9fafb', textAlign: 'center', padding: '12px 8px', color: '#374151', borderBottom: '1px solid #f3f4f6', overflow: 'hidden', textOverflow: 'ellipsis' }}>{paidTimeStr || '-'}</td>
                            </tr>
                           )
                        }) : (
                          <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>No bills found</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}"""

# Replace exactly where `</div>` ends for the summary tables container
import re
# The layout is:
#             <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
#               <div style={{ ... width ... }}>
#                  ... inner tables ...
#               </div>
#               <-- we want to insert here -->
#             </div>

# Let's locate the exact insertion point. 
# We have:
target_insert = """                    </table>
                  )}
                </div>
              </div>"""

content = content.replace(target_insert, target_insert + "\n\n" + table_insertion)

with open('src/app/(frontend)/report-graph/page.tsx', 'w') as f:
    f.write(content)

