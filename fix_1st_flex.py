with open('src/app/(frontend)/report-graph/page.tsx', 'r') as f:
    content = f.read()

target = """                padding: '20px 16px',
                flex: expandedSummaryView !== 'none' ? '0 0 35%' : 1,
                minWidth: 0,"""
replacement = """                padding: '20px 16px',
                flex: (expandedSummaryView === 'categories' && expandedCategorySelectedDealer) ? '0 0 25%' : (expandedSummaryView !== 'none' ? '0 0 35%' : 1),
                minWidth: 0,"""

content = content.replace(target, replacement)

with open('src/app/(frontend)/report-graph/page.tsx', 'w') as f:
    f.write(content)

