with open('src/app/(frontend)/report-graph/page.tsx', 'r') as f:
    content = f.read()

target = """             const remaining = (item.matchedAmount || 0) - billCategorizedAmount;
             if (remaining > 0.01) {
                map['Others'] = (map['Others'] || 0) + remaining;
             }"""

replacement = """             const remaining = (item.matchedAmount || 0) - billCategorizedAmount;
             if (remaining > 0.01 || remaining < -0.01) {
                map['Others'] = (map['Others'] || 0) + remaining;
             }"""

if target in content:
    content = content.replace(target, replacement)
else:
    print("Not found")

with open('src/app/(frontend)/report-graph/page.tsx', 'w') as f:
    f.write(content)
