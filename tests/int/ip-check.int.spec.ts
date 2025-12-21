import { describe, it, expect } from 'vitest'
import { isIPAllowed } from '../../src/utilities/ipCheck'

describe('IP Check Utility', () => {
  it('allows exact match', () => {
    expect(isIPAllowed('192.168.1.5', '192.168.1.5')).toBe(true)
    expect(isIPAllowed('192.168.1.5', '192.168.1.6')).toBe(false)
  })

  it('allows from comma-separated list', () => {
    expect(isIPAllowed('192.168.1.5', '192.168.1.1, 192.168.1.5, 192.168.1.10')).toBe(true)
    expect(isIPAllowed('192.168.1.6', '192.168.1.1, 192.168.1.5, 192.168.1.10')).toBe(false)
  })

  it('allows from range', () => {
    expect(isIPAllowed('192.168.2.1', '192.168.2.1-192.168.2.250')).toBe(true)
    expect(isIPAllowed('192.168.2.100', '192.168.2.1-192.168.2.250')).toBe(true)
    expect(isIPAllowed('192.168.2.250', '192.168.2.1-192.168.2.250')).toBe(true)
    expect(isIPAllowed('192.168.2.251', '192.168.2.1-192.168.2.250')).toBe(false)
    expect(isIPAllowed('192.168.1.1', '192.168.2.1-192.168.2.250')).toBe(false)
  })

  it('allows mixed ranges and individual IPs', () => {
    const list = '10.0.0.1, 192.168.1.1-192.168.1.5, 172.16.0.10'
    expect(isIPAllowed('10.0.0.1', list)).toBe(true)
    expect(isIPAllowed('192.168.1.3', list)).toBe(true)
    expect(isIPAllowed('172.16.0.10', list)).toBe(true)
    expect(isIPAllowed('192.168.1.6', list)).toBe(false)
  })

  it('allows from array of IPs and ranges', () => {
    const list = ['10.0.0.1', '192.168.1.1-192.168.1.5', '172.16.0.10']
    expect(isIPAllowed('10.0.0.1', list)).toBe(true)
    expect(isIPAllowed('192.168.1.3', list)).toBe(true)
    expect(isIPAllowed('172.16.0.10', list)).toBe(true)
    expect(isIPAllowed('192.168.1.6', list)).toBe(false)
  })

  it('allows all when wildcard is used in array', () => {
    expect(isIPAllowed('1.2.3.4', ['192.168.1.1', '*'])).toBe(true)
  })

  it('allows all when wildcard is used', () => {
    expect(isIPAllowed('any.ip', '*')).toBe(true)
    expect(isIPAllowed('1.2.3.4', '192.168.1.1, *')).toBe(true)
  })

  it('handles empty or whitespace strings', () => {
    expect(isIPAllowed('1.2.3.4', '')).toBe(false)
    expect(isIPAllowed('1.2.3.4', '  ')).toBe(false)
  })
})
