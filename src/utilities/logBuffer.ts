export interface LogEntry {
  timestamp: string
  text: string
  stream: 'stdout' | 'stderr'
}

export const addLog = (_chunk: string, _stream: 'stdout' | 'stderr') => {
  // No-op: Disabled to prevent event loop blocking
}

export const initLogHook = () => {
  // No-op: Native stdout/stderr used directly without array shifting
}

export const getBufferedLogs = (): LogEntry[] => {
  return []
}
