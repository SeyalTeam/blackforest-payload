import re

with open('src/app/(frontend)/report-graph/page.tsx', 'r') as f:
    content = f.read()

# 1. Patch categorySummary
cat_summary_target = """          if (shouldInclude && !processedBills.has(item.id)) {
             processedBills.add(item.id);
             if (item.rawMaterials) {
               item.rawMaterials.forEach((rm: any) => {
                  if (!rm.category) return;
                  const catName = categories.find(c => c.id === rm.category)?.name || 'Unknown Category';
                  const amt = rm.totalAmount || 0;
                  const billTotal = item.amount || 1;
                  const factor = item.matchedAmount / billTotal;
                  map[catName] = (map[catName] || 0) + (amt * factor);
               });
             }
          }"""

cat_summary_replace = """          if (shouldInclude && !processedBills.has(item.id)) {
             processedBills.add(item.id);
             let billCategorizedAmount = 0;
             if (item.rawMaterials) {
               item.rawMaterials.forEach((rm: any) => {
                  const amt = rm.totalAmount || 0;
                  const billTotal = item.amount || 1;
                  const factor = item.matchedAmount / billTotal;
                  const scaledAmt = amt * factor;
                  
                  let catName = 'Others';
                  if (rm.category) {
                    catName = categories.find(c => c.id === rm.category)?.name || 'Others';
                  }
                  map[catName] = (map[catName] || 0) + scaledAmt;
                  billCategorizedAmount += scaledAmt;
               });
             }
             const remaining = (item.matchedAmount || 0) - billCategorizedAmount;
             if (remaining > 0.01) {
                map['Others'] = (map['Others'] || 0) + remaining;
             }
          }"""

if cat_summary_target in content:
    content = content.replace(cat_summary_target, cat_summary_replace)
else:
    print("Failed to find cat_summary_target")

cat_summary_return_target = """    return Object.entries(map).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  }, [rawMaterialData, activeMenu, visibleLines, categories]);"""

cat_summary_return_replace = """    const sorted = Object.entries(map).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
    const others = sorted.find(c => c.name === 'Others');
    const rest = sorted.filter(c => c.name !== 'Others');
    return others ? [...rest, others] : rest;
  }, [rawMaterialData, activeMenu, visibleLines, categories]);"""

if cat_summary_return_target in content:
    content = content.replace(cat_summary_return_target, cat_summary_return_replace)
else:
    print("Failed to find cat_summary_return_target")


# 2. Patch expandedCategoryDealers
expanded_dealers_target = """          if (shouldInclude && !processedBills.has(item.id)) {
            processedBills.add(item.id);
            
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
            }"""

expanded_dealers_replace = """          if (shouldInclude && !processedBills.has(item.id)) {
            processedBills.add(item.id);
            
            let catAmountInBill = 0;
            let billCategorizedAmount = 0;
            if (item.rawMaterials) {
              item.rawMaterials.forEach((rm: any) => {
                const amt = rm.totalAmount || 0;
                const billTotal = item.amount || 1;
                const factor = item.matchedAmount / billTotal;
                const scaledAmt = amt * factor;
                
                let catName = 'Others';
                if (rm.category) {
                  catName = categories.find((c: any) => c.id === rm.category)?.name || 'Others';
                }
                
                billCategorizedAmount += scaledAmt;
                if (catName === expandedSelectedCategory) {
                  catAmountInBill += scaledAmt;
                }
              });
            }
            if (expandedSelectedCategory === 'Others') {
              const remaining = (item.matchedAmount || 0) - billCategorizedAmount;
              if (remaining > 0.01) {
                 catAmountInBill += remaining;
              }
            }"""

if expanded_dealers_target in content:
    content = content.replace(expanded_dealers_target, expanded_dealers_replace)
else:
    print("Failed to find expanded_dealers_target")


# 3. Patch expandedCategoryDealerBills
expanded_bills_target = """          if (shouldInclude && !processedBills.has(item.id)) {
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

            if (matchesCategory) {"""

expanded_bills_replace = """          if (shouldInclude && !processedBills.has(item.id)) {
            let catAmountInBill = 0;
            let billCategorizedAmount = 0;
            if (item.rawMaterials) {
              item.rawMaterials.forEach((rm: any) => {
                const amt = rm.totalAmount || 0;
                const billTotal = item.amount || 1;
                const factor = item.matchedAmount / billTotal;
                const scaledAmt = amt * factor;
                
                let catName = 'Others';
                if (rm.category) {
                  catName = categories.find((c: any) => c.id === rm.category)?.name || 'Others';
                }
                
                billCategorizedAmount += scaledAmt;
                if (catName === expandedSelectedCategory) {
                  catAmountInBill += scaledAmt;
                }
              });
            }

            if (expandedSelectedCategory === 'Others') {
              const remaining = (item.matchedAmount || 0) - billCategorizedAmount;
              if (remaining > 0.01) {
                 catAmountInBill += remaining;
              }
            }

            if (catAmountInBill > 0.01) {"""

if expanded_bills_target in content:
    content = content.replace(expanded_bills_target, expanded_bills_replace)
else:
    print("Failed to find expanded_bills_target")

with open('src/app/(frontend)/report-graph/page.tsx', 'w') as f:
    f.write(content)

