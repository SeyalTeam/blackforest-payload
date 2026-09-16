import re

with open('src/app/(frontend)/report-graph/page.tsx', 'r') as f:
    content = f.read()

pattern = r'<tr key=\{i\} style=\{\{ borderBottom: \'1px solid #e5e7eb\' \}\}>(\s+)<td style=\{\{ backgroundColor: i % 2 === 0 \? \'#f9fafb\' : \'#ffffff\', textAlign: \'center\''
replacement = r'<tr key={i} onClick={() => setExpandedSelectedCategory(cat.name)} style={{ borderBottom: \'1px solid #e5e7eb\', cursor: \'pointer\', backgroundColor: expandedSelectedCategory === cat.name ? \'#eef2ff\' : \'transparent\', outline: expandedSelectedCategory === cat.name ? \'2px solid #6366f1\' : \'none\', outlineOffset: \'-2px\' }}>\1<td style={{ backgroundColor: expandedSelectedCategory === cat.name ? \'transparent\' : i % 2 === 0 ? \'#f9fafb\' : \'#ffffff\', textAlign: \'center\''

content = re.sub(pattern, replacement, content, count=1)

with open('src/app/(frontend)/report-graph/page.tsx', 'w') as f:
    f.write(content)

