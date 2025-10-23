import { NextRequest, NextResponse } from 'next/server'
import { head } from '@vercel/blob' // Use 'head' instead of 'get'

export async function GET(req: NextRequest) {
  const { pathname } = new URL(req.url)
  const filename = pathname.replace('/api/media/', '') // Extract filename (adjust if using prefix)

  if (!filename) {
    return NextResponse.json({ error: 'Filename required' }, { status: 400 })
  }

  try {
    const blob = await head(filename) // Get metadata (url, contentType, etc.)
    if (!blob.url) {
      throw new Error('Blob not found')
    }

    const response = await fetch(blob.url) // Fetch actual content from public URL
    if (!response.ok) {
      throw new Error('Failed to fetch blob')
    }

    const buffer = await response.arrayBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': blob.contentType || 'application/octet-stream',
        'Content-Disposition': 'inline', // Or 'attachment' for downloads
        'Cache-Control': 'public, max-age=31536000, immutable', // Optional caching
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'File not found or access error' }, { status: 404 })
  }
}
