import re
with open('src/app/(frontend)/report-graph/page.tsx', 'r') as f:
    content = f.read()

# expandedCategoryDealers
target2 = """            if (expandedSelectedCategory === 'Others') {
              const remaining = (item.matchedAmount || 0) - billCategorizedAmount;
              if (remaining > 0.01) {
                 catAmountInBill += remaining;
              }
            }"""
replacement2 = """            if (expandedSelectedCategory === 'Others') {
              const remaining = (item.matchedAmount || 0) - billCategorizedAmount;
              if (remaining > 0.01 || remaining < -0.01) {
                 catAmountInBill += remaining;
              }
            }"""

if target2 in content:
    content = content.replace(target2, replacement2)
else:
    print("target2 not found")

# expandedCategoryDealerBills
target3 = """            if (expandedSelectedCategory === 'Others') {
              const remaining = (item.matchedAmount || 0) - billCategorizedAmount;
              if (remaining > 0.01) {
                 catAmountInBill += remaining;
              }
            }

            if (catAmountInBill > 0.01) {"""
replacement3 = """            if (expandedSelectedCategory === 'Others') {
              const remaining = (item.matchedAmount || 0) - billCategorizedAmount;
              if (remaining > 0.01 || remaining < -0.01) {
                 catAmountInBill += remaining;
              }
            }

            if (catAmountInBill > 0.01 || catAmountInBill < -0.01) {"""

if target3 in content:
    content = content.replace(target3, replacement3)
else:
    print("target3 not found")

with open('src/app/(frontend)/report-graph/page.tsx', 'w') as f:
    f.write(content)
