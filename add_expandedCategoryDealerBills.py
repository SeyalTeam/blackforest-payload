with open('src/app/(frontend)/report-graph/page.tsx', 'r') as f:
    content = f.read()

target = """  const totalCategoryAmount = useMemo(() => {"""

insertion = """  const expandedCategoryDealerBills = useMemo(() => {
    if (!expandedSelectedCategory || !expandedCategorySelectedDealer || !rawMaterialData.length) return [];
    
    const bills: any[] = [];
    const processedBills = new Set<string>();

    rawMaterialData.forEach(d => {
      if (d.rawItems) {
        d.rawItems.forEach((item: any) => {
          if (item.dealerName !== expandedCategorySelectedDealer) return;
          
          let shouldInclude = false;
          if (visibleLines.total && item.matchedReason === 'creation') shouldInclude = true;
          if (visibleLines.paid && item.matchedReason === 'payment') shouldInclude = true;
          if (visibleLines.pending && item.matchedReason === 'creation' && item.status === 'pending') shouldInclude = true;
          if (visibleLines.cancelled && item.matchedReason === 'creation' && item.status === 'cancelled') shouldInclude = true;
          
          if (shouldInclude && !processedBills.has(item.id)) {
            let matchesCategory = false;
            let catAmountInBill = 0;
            if (item.rawMaterials) {
              item.rawMaterials.forEach((rm: any) => {
                if (!rm.category) return;
                const catName = categories.find((c: any) => c.id === rm.category)?.name || 'Unknown Category';
                if (catName === expandedSelectedCategory) {
                  matchesCategory = true;
                  const amt = rm.totalAmount || 0;
                  const billTotal = item.amount || 1;
                  const factor = item.matchedAmount / billTotal;
                  catAmountInBill += (amt * factor);
                }
              });
            }

            if (matchesCategory) {
               processedBills.add(item.id);
               bills.push({ ...item, categorySpecificAmount: catAmountInBill });
            }
          }
        });
      }
    });

    return bills.sort((a, b) => new Date(b.matchedDate || b.date || b.time || 0).getTime() - new Date(a.matchedDate || a.date || a.time || 0).getTime());
  }, [rawMaterialData, expandedSelectedCategory, expandedCategorySelectedDealer, visibleLines, categories]);

  const totalCategoryAmount = useMemo(() => {"""

content = content.replace(target, insertion)

with open('src/app/(frontend)/report-graph/page.tsx', 'w') as f:
    f.write(content)

