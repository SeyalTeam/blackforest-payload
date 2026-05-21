import { createServer } from 'node:http'
import { parse } from 'node:url'
import nextEnv from '@next/env'
import next from 'next'
import { getPayload } from 'payload'
import { createRealtimeGateway, getRealtimeEndpointPath } from './realtime/wsGateway'

const parsePort = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const isDevelopment = process.env.NODE_ENV !== 'production'
const host = process.env.HOST || process.env.HOSTNAME || '127.0.0.1'
const port = parsePort(process.env.PORT, 3000)

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd(), isDevelopment)

const app = next({
  dev: isDevelopment,
  hostname: host,
  port,
})

const bootstrap = async (): Promise<void> => {
  const payloadConfig = (await import('./payload.config')).default
  const payload = await getPayload({ config: payloadConfig })
  const realtimeGateway = createRealtimeGateway(payload)

  await app.prepare()
  const requestHandler = app.getRequestHandler()
  const upgradeHandler = app.getUpgradeHandler()

  const server = createServer((request, response) => {
    const parsedURL = parse(request.url || '/', true)
    void requestHandler(request, response, parsedURL).catch((error) => {
      console.error('[server] request handling failed', error)
      if (!response.headersSent) {
        response.statusCode = 500
        response.setHeader('content-type', 'application/json; charset=utf-8')
        response.end(JSON.stringify({ error: 'internal_server_error' }))
      } else {
        response.end()
      }
    })
  })

  server.on('upgrade', (request, socket, head) => {
    void (async () => {
      const handledByRealtime = await realtimeGateway.handleUpgrade(request, socket, head)
      if (handledByRealtime) return
      await upgradeHandler(request, socket, head)
    })().catch((error) => {
      console.error('[server] upgrade handling failed', error)
      socket.destroy()
    })
  })

  server.listen(port, host, () => {
    console.log(
      `[server] running on http://${host}:${port} | realtime path ${getRealtimeEndpointPath()}`,
    )
  })
}

void bootstrap().catch((error) => {
  console.error('[server] bootstrap failed', error)
  process.exit(1)
})
