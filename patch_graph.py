import re

with open('src/app/(frontend)/report-graph/page.tsx', 'r') as f:
    content = f.read()

# 1. Insert filteredGraphData right before `return (` (or just after `expandedCategoryDealerBills` useMemo)
insertion_target = """  const expandedCategoryDealerBills = useMemo(() => {"""

filtered_graph_data = """  const filteredGraphData = useMemo(() => {
    if (expandedSummaryView === 'none') return rawMaterialData;
    
    return rawMaterialData.map(bin => {
      let filteredItems = bin.rawItems || [];
      
      if (expandedSummaryView === 'dealers' && expandedSelectedDealer) {
        filteredItems = filteredItems.filter((item: any) => item.dealerName === expandedSelectedDealer);
      } else if (expandedSummaryView === 'categories' && expandedSelectedCategory) {
        if (expandedCategorySelectedDealer) {
          filteredItems = filteredItems.filter((item: any) => {
             if (item.dealerName !== expandedCategorySelectedDealer) return false;
             if (!item.rawMaterials) return expandedSelectedCategory === 'Others';
             let hasCat = false;
             item.rawMaterials.forEach((rm: any) => {
                const catName = rm.category ? (categories.find((c: any) => c.id === rm.category)?.name || 'Others') : 'Others';
                if (catName === expandedSelectedCategory) hasCat = true;
             });
             return hasCat || expandedSelectedCategory === 'Others';
          });
        } else {
          filteredItems = filteredItems.filter((item: any) => {
             if (!item.rawMaterials) return expandedSelectedCategory === 'Others';
             let hasCat = false;
             item.rawMaterials.forEach((rm: any) => {
                const catName = rm.category ? (categories.find((c: any) => c.id === rm.category)?.name || 'Others') : 'Others';
                if (catName === expandedSelectedCategory) hasCat = true;
             });
             return hasCat || expandedSelectedCategory === 'Others'; // Wait, what if they bought A but not Others? If expandedSelectedCategory is 'Others', the remaining calculation will include it.
          });
        }
      }

      let totalPaid = 0;
      let paidTotal = 0;
      let pendingTotal = 0;
      let cancelledTotal = 0;

      const adjustedItems = filteredItems.map((item: any) => {
         let amountToAdd = item.matchedAmount || 0;
         
         if (expandedSummaryView === 'categories' && expandedSelectedCategory) {
            let catAmountInBill = 0;
            let billCategorizedAmount = 0;
            if (item.rawMaterials) {
               item.rawMaterials.forEach((rm: any) => {
                 const amt = rm.totalAmount || 0;
                 const billTotal = item.amount || 1;
                 const factor = (item.matchedAmount || 0) / billTotal;
                 const scaledAmt = amt * factor;
                 const catName = rm.category ? (categories.find((c: any) => c.id === rm.category)?.name || 'Others') : 'Others';
                 billCategorizedAmount += scaledAmt;
                 if (catName === expandedSelectedCategory) catAmountInBill += scaledAmt;
               });
            }
            if (expandedSelectedCategory === 'Others') {
               const remaining = (item.matchedAmount || 0) - billCategorizedAmount;
               if (remaining > 0.01 || remaining < -0.01) catAmountInBill += remaining;
            }
            amountToAdd = catAmountInBill;
         }

         if (item.matchedReason === 'creation') {
            totalPaid += amountToAdd;
            if (item.status === 'pending') pendingTotal += amountToAdd;
            if (item.status === 'cancelled') cancelledTotal += amountToAdd;
         }
         if (item.matchedReason === 'payment') {
            paidTotal += amountToAdd;
         }

         return { ...item, matchedAmount: amountToAdd };
      }).filter((item: any) => (item.matchedAmount > 0.01 || item.matchedAmount < -0.01)); // Only keep items that actually have amount for this category!

      return {
        ...bin,
        totalPaid,
        paidTotal,
        pendingTotal,
        cancelledTotal,
        rawItems: adjustedItems
      };
    });
  }, [rawMaterialData, expandedSummaryView, expandedSelectedCategory, expandedCategorySelectedDealer, expandedSelectedDealer, categories]);\n\n"""

content = content.replace(insertion_target, filtered_graph_data + insertion_target)

# 2. Replace ComposedChart data source
chart_target = "<ComposedChart data={rawMaterialData}"
chart_replace = "<ComposedChart data={filteredGraphData}"
content = content.replace(chart_target, chart_replace)

# 3. Fix the "Total" display above the graph which uses rawMaterialData.reduce
# We want those numbers to also match the filteredGraphData!
# Let's see how those numbers are calculated.
# "₹{rawMaterialData.reduce((acc, d) => acc + (d.totalPaid || 0), 0).toLocaleString('en-IN')}"
# I can just replace `rawMaterialData.reduce` with `filteredGraphData.reduce` for those!
content = content.replace("rawMaterialData.reduce(", "filteredGraphData.reduce(")

# Also, there are `<Line>` and `<Area>` conditional checks like:
# rawMaterialData.some(d => d.paidTotal > 0)
# Replace these as well
content = content.replace("rawMaterialData.some(", "filteredGraphData.some(")

with open('src/app/(frontend)/report-graph/page.tsx', 'w') as f:
    f.write(content)
