const fs = require('fs')

const file = 'src/app/(frontend)/report-graph/page.tsx'
let content = fs.readFileSync(file, 'utf8')

const target = `              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  {selectedBranch === 'all' ? (
                    <AreaChart data={chartData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        {branches.map((b, i) => {
                          const color = \`hsl(\${Math.round(i * (360 / branches.length))}, 75%, 55%)\`
                          return (
                            <linearGradient key={\`grad-\${b.id}\`} id={\`color-\${b.id}\`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={color} stopOpacity={0.4}/>
                              <stop offset="95%" stopColor={color} stopOpacity={0}/>
                            </linearGradient>
                          )
                        })}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} dy={10} minTickGap={30} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} dx={-10} tickFormatter={(val) => \`\${(val/1000).toFixed(0)}k\`} orientation="right" />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontSize: '13px', fontWeight: 500 }}
                        formatter={(value: number, name: string) => {
                          const branch = branches.find(b => b.id === name)
                          return [\`₹\${value.toLocaleString()}\`, branch ? branch.name : name]
                        }}
                        labelStyle={{ color: '#6b7280', marginBottom: '4px' }}
                      />
                      {branches.map((b, i) => {
                        const color = \`hsl(\${Math.round(i * (360 / branches.length))}, 75%, 55%)\`
                        return <Area key={b.id} type="monotone" dataKey={b.id} stroke={color} strokeWidth={2} fillOpacity={1} fill={\`url(#color-\${b.id})\`} activeDot={{ r: 4, strokeWidth: 0, fill: color }} />
                      })}
                    </AreaChart>
                  ) : (
                    <AreaChart data={chartData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} dy={10} minTickGap={30} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} dx={-10} tickFormatter={(val) => \`\${(val/1000).toFixed(0)}k\`} orientation="right" />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontSize: '13px', fontWeight: 500 }}
                        formatter={(value: number) => [\`₹\${value.toLocaleString()}\`, 'Total Amount']}
                        labelStyle={{ color: '#6b7280', marginBottom: '4px' }}
                      />
                      <Area type="monotone" dataKey="totalAmount" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorAmount)" activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }} />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              ) : (`

const replacement = `              ) : chartData.length > 0 ? (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      {selectedBranch === 'all' ? (
                        <AreaChart data={chartData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                          <defs>
                            {branchesWithTotals.map(b => (
                              <linearGradient key={\`grad-\${b.id}\`} id={\`color-\${b.id}\`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={b.color} stopOpacity={0.4}/>
                                <stop offset="95%" stopColor={b.color} stopOpacity={0}/>
                              </linearGradient>
                            ))}
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} dy={10} minTickGap={30} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} dx={-10} tickFormatter={(val) => \`\${(val/1000).toFixed(0)}k\`} orientation="right" />
                          <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontSize: '13px', fontWeight: 500 }}
                            formatter={(value: number, name: string) => {
                              const branch = branches.find(b => b.id === name)
                              return [\`₹\${value.toLocaleString()}\`, branch ? branch.name : name]
                            }}
                            labelStyle={{ color: '#6b7280', marginBottom: '4px' }}
                          />
                          {branchesWithTotals.map(b => (
                            <Area key={b.id} type="monotone" dataKey={b.id} stroke={b.color} strokeWidth={2} fillOpacity={1} fill={\`url(#color-\${b.id})\`} activeDot={{ r: 4, strokeWidth: 0, fill: b.color }} />
                          ))}
                        </AreaChart>
                      ) : (
                        <AreaChart data={chartData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} dy={10} minTickGap={30} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} dx={-10} tickFormatter={(val) => \`\${(val/1000).toFixed(0)}k\`} orientation="right" />
                          <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontSize: '13px', fontWeight: 500 }}
                            formatter={(value: number) => [\`₹\${value.toLocaleString()}\`, 'Total Amount']}
                            labelStyle={{ color: '#6b7280', marginBottom: '4px' }}
                          />
                          <Area type="monotone" dataKey="totalAmount" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorAmount)" activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }} />
                        </AreaChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                  {selectedBranch === 'all' && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '16px 20px', justifyContent: 'center', backgroundColor: '#fff', borderTop: '1px solid #e5e7eb', maxHeight: '120px', overflowY: 'auto' }}>
                      {branchesWithTotals.map(b => (
                        <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: '#f3f4f6', borderRadius: '16px', fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: b.color }} />
                          {b.name} <span style={{ color: '#6b7280', fontWeight: 400 }}>₹{(b.total/1000).toFixed(1)}k</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (`

if (content.includes(target)) {
  fs.writeFileSync(file, content.replace(target, replacement))
  console.log('Done')
} else {
  console.log('Could not find target content')
}
