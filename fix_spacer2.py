with open('src/app/(frontend)/report-graph/page.tsx', 'r') as f:
    content = f.read()

target = """              <div style={{ flex: (selectedBill || expandedSummaryView === 'none') ? `0 0 ${selectedCategory === 'all' ? '360px' : '170px'}` : '0 0 0px', display: (selectedBill || expandedSummaryView === 'none') ? 'flex' : 'none', flexDirection: 'column' }}>"""
replacement = """              <div style={{ flex: (selectedBill || expandedSummaryView === 'none' || (expandedSummaryView === 'dealers') || (expandedSummaryView === 'categories' && !expandedCategorySelectedDealer)) ? `0 0 ${selectedCategory === 'all' ? '360px' : '170px'}` : '0 0 0px', display: (selectedBill || expandedSummaryView === 'none' || (expandedSummaryView === 'dealers') || (expandedSummaryView === 'categories' && !expandedCategorySelectedDealer)) ? 'flex' : 'none', flexDirection: 'column' }}>"""

content = content.replace(target, replacement)

with open('src/app/(frontend)/report-graph/page.tsx', 'w') as f:
    f.write(content)

