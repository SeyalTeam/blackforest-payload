with open('src/app/(frontend)/report-graph/page.tsx', 'r') as f:
    lines = f.readlines()

for i, line in enumerate(lines[2495:2520]):
    print(f"{i+2496}: {line}", end='')
