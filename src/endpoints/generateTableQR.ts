import bwipjs from 'bwip-js'
import type { PayloadHandler } from 'payload'

const toText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : value === null || value === undefined ? '' : String(value)

const sanitizeFilePart = (value: string, fallback: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || fallback
}

export const generateTableQRHandler: PayloadHandler = async (req): Promise<Response> => {
  if (!req.user) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown> | null = null
  try {
    body = (await req.json?.()) as Record<string, unknown>
  } catch (_error) {
    body = null
  }

  const tableURLValue = toText(body?.tableURL)
  const branchName = toText(body?.branchName)
  const sectionName = toText(body?.sectionName)
  const tableNumber = toText(body?.tableNumber)

  if (!tableURLValue) {
    return Response.json({ message: 'Table URL is required' }, { status: 400 })
  }

  let normalizedURL: URL
  try {
    normalizedURL = new URL(tableURLValue)
  } catch (_error) {
    return Response.json({ message: 'Table URL must be a valid absolute URL' }, { status: 400 })
  }

  try {
    const qrBuffer = await bwipjs.toBuffer({
      bcid: 'qrcode',
      text: normalizedURL.toString(),
      scale: 8,
      paddingwidth: 12,
      paddingheight: 12,
      backgroundcolor: 'FFFFFF',
      includetext: false,
    })

    const fileName = `table-qr-${sanitizeFilePart(branchName, 'branch')}-${sanitizeFilePart(
      sectionName,
      'section',
    )}-${sanitizeFilePart(tableNumber, 'table')}.png`

    return Response.json(
      {
        tableURL: normalizedURL.toString(),
        qrDataURL: `data:image/png;base64,${qrBuffer.toString('base64')}`,
        fileName,
      },
      { status: 200 },
    )
  } catch (error) {
    req.payload.logger.error({
      err: error,
      msg: 'Failed to generate table QR',
    })

    return Response.json({ message: 'Failed to generate table QR' }, { status: 500 })
  }
}
