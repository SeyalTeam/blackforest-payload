with open('src/app/(frontend)/report-graph/page.tsx', 'r') as f:
    lines = f.readlines()

for i, line in enumerate(lines[2400:2500]):
    print(f"{i+2401}: {line}", end='')
