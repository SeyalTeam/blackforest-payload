export interface LogEntry {
  timestamp: string
  text: string
  stream: 'stdout' | 'stderr'
}

const logBuffer: LogEntry[] = []
const MAX_LOG_LINES = 100

const stripAnsi = (text: string): string => {
  return text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
}

export const addLog = (chunk: string, stream: 'stdout' | 'stderr') => {
  const cleaned = stripAnsi(chunk)
  if (!cleaned.trim()) return

  const lines = cleaned.split('\n').filter((line) => line.trim())
  lines.forEach((line) => {
    logBuffer.push({
      timestamp: new Date().toISOString(),
      text: line,
      stream,
    })
  })

  while (logBuffer.length > MAX_LOG_LINES) {
    logBuffer.shift()
  }
}

let hooked = false
export const initLogHook = () => {
  if (hooked) return
  hooked = true

  const originalStdoutWrite = process.stdout.write
  process.stdout.write = function (chunk: any, ...args: any[]): boolean {
    try {
      addLog(chunk.toString(), 'stdout')
    } catch (_e) {
      // Safe fallback
    }
    return originalStdoutWrite.apply(process.stdout, [chunk, ...args] as any)
  }

  const originalStderrWrite = process.stderr.write
  process.stderr.write = function (chunk: any, ...args: any[]): boolean {
    try {
      addLog(chunk.toString(), 'stderr')
    } catch (_e) {
      // Safe fallback
    }
    return originalStderrWrite.apply(process.stderr, [chunk, ...args] as any)
  }
}

export const getBufferedLogs = () => {
  return logBuffer
}
