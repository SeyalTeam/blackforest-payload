import re
with open('src/app/(frontend)/report-graph/page.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "if (catAmountInBill > 0) {",
    "if (catAmountInBill > 0.01 || catAmountInBill < -0.01) {"
)

content = content.replace(
    "if (catAmountInBill > 0.01) {",
    "if (catAmountInBill > 0.01 || catAmountInBill < -0.01) {"
)

with open('src/app/(frontend)/report-graph/page.tsx', 'w') as f:
    f.write(content)
