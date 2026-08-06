export const getPublicServerURL = (): string => {
  if (process.env.PAYLOAD_PUBLIC_SERVER_URL) {
    return process.env.PAYLOAD_PUBLIC_SERVER_URL
  }

  if (process.env.NEXT_PUBLIC_SERVER_URL) {
    return process.env.NEXT_PUBLIC_SERVER_URL
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  return 'http://localhost:3000'
}
