const fs = require('fs')

const file = 'src/app/(frontend)/report-graph/page.tsx'
let content = fs.readFileSync(file, 'utf8')

// 1. Add states
content = content.replace(
  `  const [presetKey, setPresetKey] = useState<string>('last7Days')`,
  `  const [presetKey, setPresetKey] = useState<string>('last7Days')\n  const [branches, setBranches] = useState<{ id: string, name: string }[]>([])\n  const [selectedBranch, setSelectedBranch] = useState<string>('all')`
)

// 2. Add fetchBranches useEffect
content = content.replace(
  `  useEffect(() => {`,
  `  useEffect(() => {\n    const fetchBranches = async () => {\n      try {\n        const response = await fetch('/api/branches?limit=1000')\n        const json = await response.json()\n        if (json?.docs) {\n          setBranches(json.docs.map((b: any) => ({ id: b.id, name: b.name })))\n        }\n      } catch (err) {\n        console.error('Error fetching branches:', err)\n      }\n    }\n    fetchBranches()\n  }, [])\n\n  useEffect(() => {`
)

// 3. Update fetchBranchBillingData
content = content.replace(
  `const fetchBranchBillingData = useCallback(async (start: Date, end: Date, currentPreset: string) => {`,
  `const fetchBranchBillingData = useCallback(async (start: Date, end: Date, currentPreset: string, branch: string) => {`
)
content = content.replace(
  `branch: ''`,
  `branch: branch === 'all' ? '' : branch`
)

// 4. Update the effect that calls fetchBranchBillingData
content = content.replace(
  `fetchBranchBillingData(startDate, endDate, presetKey)`,
  `fetchBranchBillingData(startDate, endDate, presetKey, selectedBranch)`
)
content = content.replace(
  `}, [activeMenu, startDate, endDate, presetKey, fetchBranchBillingData])`,
  `}, [activeMenu, startDate, endDate, presetKey, selectedBranch, fetchBranchBillingData])`
)

// 5. Update the toolbar dropdown
content = content.replace(
  `<button style={{ padding: '8px 12px', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '20px', color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>\n                   <span style={{ fontSize: '12px' }}>▼</span>\n                 </button>`,
  `<select \n                   value={selectedBranch}\n                   onChange={(e) => setSelectedBranch(e.target.value)}\n                   style={{ padding: '6px 12px', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '20px', color: '#374151', fontSize: '13px', fontWeight: 600, outline: 'none', cursor: 'pointer', appearance: 'none' }}\n                 >\n                   <option value="all">All Branches</option>\n                   {branches.map(b => (\n                     <option key={b.id} value={b.id}>{b.name}</option>\n                   ))}\n                 </select>`
)

fs.writeFileSync(file, content)
console.log("Done patching")
