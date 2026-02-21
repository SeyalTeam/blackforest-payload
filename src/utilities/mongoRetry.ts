const delay = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

export const isMongoWriteConflictError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false

  const e = error as {
    code?: unknown
    codeName?: unknown
    message?: unknown
    errorResponse?: {
      code?: unknown
      codeName?: unknown
      errmsg?: unknown
    }
  }

  const code =
    typeof e.code === 'number'
      ? e.code
      : typeof e.errorResponse?.code === 'number'
        ? e.errorResponse.code
        : null

  const codeName =
    typeof e.codeName === 'string'
      ? e.codeName
      : typeof e.errorResponse?.codeName === 'string'
        ? e.errorResponse.codeName
        : ''

  const message =
    typeof e.message === 'string'
      ? e.message
      : typeof e.errorResponse?.errmsg === 'string'
        ? e.errorResponse.errmsg
        : ''

  return (
    code === 112 ||
    codeName.toLowerCase() === 'writeconflict' ||
    message.toLowerCase().includes('write conflict')
  )
}

export const withWriteConflictRetry = async <T>(
  task: () => Promise<T>,
  attempts = 3,
  initialDelayMs = 100,
): Promise<T> => {
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task()
    } catch (error) {
      lastError = error

      if (!isMongoWriteConflictError(error) || attempt >= attempts) {
        throw error
      }

      await delay(initialDelayMs * attempt)
    }
  }

  throw lastError
}
