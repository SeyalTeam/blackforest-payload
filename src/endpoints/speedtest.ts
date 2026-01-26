import { PayloadHandler, PayloadRequest } from 'payload'
import crypto from 'crypto'

export const downloadHandler: PayloadHandler = async (_req: PayloadRequest): Promise<Response> => {
  // Create a 10MB buffer of random, uncompressible data
  const data = crypto.randomBytes(10 * 1024 * 1024)

  return new Response(data, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': data.length.toString(),
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Content-Encoding': 'identity',
      'x-no-compression': '1',
    },
  })
}

export const uploadHandler: PayloadHandler = async (req: PayloadRequest): Promise<Response> => {
  // We don't actually need to do anything with the data,
  // just consuming the stream is enough to measure speed from the client side.
  const reader = req.body?.getReader()
  if (reader) {
    while (true) {
      const { done } = await reader.read()
      if (done) break
    }
  }

  return Response.json({ success: true })
}

export const pingHandler: PayloadHandler = async (_req: PayloadRequest): Promise<Response> => {
  return new Response('ok', {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    },
  })
}
