with open('src/app/(frontend)/report-graph/page.tsx', 'r') as f:
    content = f.read()

import re

# We need to change categorySummary to accumulate OTHERS and sort it at the bottom.
