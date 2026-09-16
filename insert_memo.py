with open('src/app/(frontend)/report-graph/page.tsx', 'r') as f:
    content = f.read()

target = """    return Object.entries(map)
      .map(([dealerName, data]) => ({ dealerName, amount: data.amount, count: data.count }))
      .sort((a, b) => b.amount - a.amount);
  }, [rawMaterialData, expandedSelectedCategory, visibleLines, categories]);"""

insertion = target + """

  const expandedCategoryDealerBills = useMemo(() => {
    if (!expandedSelectedCategory || !expandedCategorySelectedDealer || !rawMaterialData.length) return [];
    
    const bills: any[] = [];
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
            if (item.dealerName === expandedCategorySelectedDealer) {
              let hasCategory = false;
              let catAmountInBill = 0;
              if (item.rawMaterials) {
                item.rawMaterials.forEach((rm: any) => {
                  if (!rm.category) return;
                  const catName = categories.find((c: any) => c.id === rm.category)?.name || 'Unknown Category';
                  if (catName === expandedSelectedCategory) {
                    hasCategory = true;
                    const amt = rm.totalAmount || 0;
                    const billTotal = item.amount || 1;
                    const factor = item.matchedAmount / billTotal;
                    catAmountInBill += (amt * factor);
                  }
                });
              }
              
              if (hasCategory) {
                processedBills.add(item.id);
                bills.push({...item, amountForCategory: catAmountInBill});
              }
            }
          }
        });
      }
    });

    return bills.sort((a, b) => new Date(b.matchedDate || b.date || b.time || 0).getTime() - new Date(a.matchedDate || a.date || a.time || 0).getTime());
  }, [rawMaterialData, expandedSelectedCategory, expandedCategorySelectedDealer, visibleLines, categories]);"""

content = content.replace(target, insertion)

with open('src/app/(frontend)/report-graph/page.tsx', 'w') as f:
    f.write(content)
