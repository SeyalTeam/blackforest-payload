with open('src/app/(frontend)/report-graph/page.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "flex: 1,",
    "flex: expandedSelectedCategoryDealer ? '0 0 30%' : 1,", 
    1 # Wait, what if there are other flex: 1? I shouldn't just replace the first one. Let me be exact.
)
