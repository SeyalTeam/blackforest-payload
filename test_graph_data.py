with open('src/app/(frontend)/report-graph/page.tsx', 'r') as f:
    content = f.read()

import re

# Let's find where rawMaterialData is used for rendering the graph
