import type { PayloadHandler } from 'payload'
import { computeDescriptor, findBestMatch, loadModels } from '../services/faceRecognition'

export const faceRecognizeHandler: PayloadHandler = async (req) => {
  try {
    // 1. Auth check
    if (!req.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Ensure models are loaded
    await loadModels()

    // 3. Get the uploaded file from the request
    const formData = await req.formData?.()
    if (!formData) {
      return Response.json({ error: 'No form data received' }, { status: 400 })
    }

    const file = formData.get('image') as File | null
    if (!file) {
      return Response.json({ error: 'No image file provided. Send as multipart with field name "image"' }, { status: 400 })
    }

    // 4. Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const imageBuffer = Buffer.from(arrayBuffer)

    // 5. Compute face descriptor from the selfie
    const selfieDescriptor = await computeDescriptor(imageBuffer)
    if (!selfieDescriptor) {
      return Response.json({
        matched: false,
        error: 'No face detected in the uploaded image. Please try again with a clearer photo.',
      }, { status: 200 })
    }

    // 6. Fetch all employees who have a stored face descriptor
    const employeeResult = await req.payload.find({
      collection: 'employees',
      where: {
        faceDescriptor: { exists: true },
        status: { equals: 'active' },
      },
      limit: 500,
      depth: 0,
    })

    const employeesWithDescriptors = employeeResult.docs
      .filter((emp: any) => emp.faceDescriptor && Array.isArray(emp.faceDescriptor) && emp.faceDescriptor.length === 128)
      .map((emp: any) => ({
        id: emp.id,
        employeeId: emp.employeeId,
        name: emp.name,
        faceDescriptor: emp.faceDescriptor,
      }))

    if (employeesWithDescriptors.length === 0) {
      return Response.json({
        matched: false,
        error: 'No employees have face data registered yet. Please upload employee photos first.',
      }, { status: 200 })
    }

    // 7. Find best match (0.65 is more lenient than 0.6)
    const match = findBestMatch(selfieDescriptor, employeesWithDescriptors, 0.65)

    if (!match.matched || !match.employeeDocId) {
      return Response.json({
        matched: false,
        confidence: match.confidence,
        error: 'Face not recognized. No matching employee found.',
      }, { status: 200 })
    }

    // 8. Handle punch in / punch out logic
    const today = new Date()
    const dateString = today.toISOString().split('T')[0] // YYYY-MM-DD

    // Find today's attendance record for this employee
    // Attendance uses 'user' (relationship to users), but we matched an 'employee'.
    // We need to find/create attendance based on the employee.
    // For now, let's use the employee doc ID directly since attendance.user references users collection.
    // We'll create attendance records using the requesting user's context.

    const punchTime = new Date().toISOString()

    // Check if there's an existing attendance record for today
    const existingAttendance = await req.payload.find({
      collection: 'attendance',
      where: {
        dateString: { equals: dateString },
        user: { equals: req.user.id },
      },
      limit: 1,
      depth: 0,
    })

    let action: 'punch_in' | 'punch_out' = 'punch_in'
    let attendanceDoc: any = null

    if (existingAttendance.docs.length > 0) {
      attendanceDoc = existingAttendance.docs[0]
      const activities = attendanceDoc.activities || []

      // Find the last activity
      const lastActivity = activities[activities.length - 1]

      if (lastActivity && lastActivity.status === 'active' && !lastActivity.punchOut) {
        // There's an active session without punch out → this is a punch out
        action = 'punch_out'

        // Update the last activity with punchOut time
        const punchInTime = new Date(lastActivity.punchIn).getTime()
        const punchOutTime = new Date(punchTime).getTime()
        const durationSeconds = Math.round((punchOutTime - punchInTime) / 1000)

        activities[activities.length - 1] = {
          ...lastActivity,
          punchOut: punchTime,
          status: 'closed',
          durationSeconds,
        }

        await req.payload.update({
          collection: 'attendance',
          id: attendanceDoc.id,
          data: {
            activities,
          },
        })
      } else {
        // Last activity is closed or no activities → new punch in
        action = 'punch_in'
        activities.push({
          type: 'session',
          punchIn: punchTime,
          status: 'active',
        })

        await req.payload.update({
          collection: 'attendance',
          id: attendanceDoc.id,
          data: {
            activities,
          },
        })
      }
    } else {
      // No attendance record for today → create one with punch in
      action = 'punch_in'
      const todayMidnight = new Date(today)
      todayMidnight.setHours(0, 0, 0, 0)

      await req.payload.create({
        collection: 'attendance',
        data: {
          user: req.user.id,
          date: todayMidnight.toISOString(),
          dateString,
          activities: [
            {
              type: 'session',
              punchIn: punchTime,
              status: 'active',
            },
          ],
        },
      })
    }

    // 9. Return the result
    return Response.json({
      matched: true,
      confidence: match.confidence,
      employee: {
        id: match.employeeDocId,
        employeeId: match.employeeId,
        name: match.employeeName,
      },
      action,
      punchTime,
    })
  } catch (error: any) {
    console.error('[FaceRecognize] Error:', error)
    return Response.json(
      { error: 'Internal server error during face recognition', details: error.message },
      { status: 500 },
    )
  }
}
