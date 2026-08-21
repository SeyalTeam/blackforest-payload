import { PayloadHandler } from 'payload'
import { computeDescriptor } from '../services/faceRecognition'

export const testFaceHandler: PayloadHandler = async (req) => {
  try {
    const id = req.query.id as string
    if (!id) return Response.json({ error: 'No ID' }, { status: 400 })
    
    const employee = await req.payload.findByID({
      collection: 'employees',
      id,
      depth: 1,
    })

    if (!employee) return Response.json({ error: 'No employee' }, { status: 404 })

    const media = employee.photo as any
    if (!media || !media.url) return Response.json({ error: 'No photo URL' }, { status: 400 })

    const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
    const imageUrl = media.url.startsWith('http') ? media.url : `${baseUrl}${media.url}`

    const response = await fetch(imageUrl)
    if (!response.ok) return Response.json({ error: 'Fetch failed', status: response.status, url: imageUrl }, { status: 500 })

    const arrayBuffer = await response.arrayBuffer()
    const imageBuffer = Buffer.from(arrayBuffer)
    
    const descriptor = await computeDescriptor(imageBuffer)

    if (descriptor) {
      await req.payload.update({
        collection: 'employees',
        id: employee.id,
        data: { 
          // @ts-ignore
          faceDescriptor: Array.from(descriptor) 
        },
      })
      return Response.json({ success: true, descriptorLength: descriptor.length })
    } else {
      return Response.json({ error: 'No face detected in photo' })
    }
  } catch (err: any) {
    return Response.json({ error: 'Exception', details: err.message, stack: err.stack })
  }
}
