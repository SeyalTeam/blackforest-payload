import type { PayloadHandler } from 'payload'

type CallSession = {
  callId: string
  threadId: string
  callerId: string
  callerRole: string
  calleeId: string
  callType: 'audio' | 'video'
  status: 'ringing' | 'accepted' | 'rejected' | 'ended'
  offer?: any
  answer?: any
  callerIce: any[]
  calleeIce: any[]
  createdAt: string
  updatedAt: string
}

// In-memory active call sessions store
const activeCallSessions = new Map<string, CallSession>()

export const callSignalHandler: PayloadHandler = async (req) => {
  if (!req.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    let body: any = {}
    if (req.json) {
      body = await req.json().catch(() => ({}))
    }

    const { action, callId, threadId, calleeId, callType, offer, answer, iceCandidate } = body
    const now = new Date().toISOString()

    const userId = String(req.user.id)
    const userRole = (req.user.role || '').toLowerCase()
    const isAdmin = userRole === 'admin' || userRole === 'superadmin'

    // 1. INITIATE CALL
    if (action === 'initiate') {
      if (!threadId || !calleeId) {
        return Response.json({ error: 'threadId and calleeId are required' }, { status: 400 })
      }

      // Clean up previous ringing sessions for this thread
      for (const [id, s] of activeCallSessions.entries()) {
        if (s.threadId === threadId && s.status === 'ringing') {
          s.status = 'ended'
          activeCallSessions.set(id, s)
        }
      }

      const newCallId = 'call-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7)
      const newSession: CallSession = {
        callId: newCallId,
        threadId,
        callerId: userId,
        callerRole: userRole,
        calleeId: String(calleeId),
        callType: callType === 'video' ? 'video' : 'audio',
        status: 'ringing',
        offer: offer || null,
        callerIce: [],
        calleeIce: [],
        createdAt: now,
        updatedAt: now,
      }

      activeCallSessions.set(newCallId, newSession)

      return Response.json({
        success: true,
        callId: newCallId,
        session: newSession,
      })
    }

    // 2. CHECK INCOMING / POLL CALL STATUS
    if (action === 'check_incoming' || action === 'poll') {
      // If a specific callId is provided and exists
      if (callId && activeCallSessions.has(callId)) {
        return Response.json({
          success: true,
          callId,
          session: activeCallSessions.get(callId),
        })
      }

      // Search for any active call matching callee or thread
      for (const s of activeCallSessions.values()) {
        if (s.status === 'ringing' || s.status === 'accepted') {
          const isTargetCallee =
            s.calleeId === userId ||
            (s.calleeId === 'admin' && isAdmin) ||
            (s.calleeId === 'staff' && !isAdmin) ||
            (threadId && s.threadId === threadId)

          const isCaller = s.callerId === userId

          if (isTargetCallee || isCaller) {
            return Response.json({
              success: true,
              callId: s.callId,
              session: s,
            })
          }
        }
      }

      return Response.json({ success: true, session: null })
    }

    // Require valid callId for mutation actions
    if (!callId || !activeCallSessions.has(callId)) {
      return Response.json({ error: 'Call session not found or expired' }, { status: 404 })
    }

    const session = activeCallSessions.get(callId)!

    // 3. ACCEPT CALL
    if (action === 'accept') {
      session.status = 'accepted'
      if (answer) session.answer = answer
      session.updatedAt = now
      activeCallSessions.set(callId, session)

      return Response.json({ success: true, session })
    }

    // 4. REJECT CALL
    if (action === 'reject') {
      session.status = 'rejected'
      session.updatedAt = now
      activeCallSessions.set(callId, session)

      return Response.json({ success: true, session })
    }

    // 5. END CALL
    if (action === 'end') {
      session.status = 'ended'
      session.updatedAt = now
      activeCallSessions.set(callId, session)

      setTimeout(() => {
        activeCallSessions.delete(callId)
      }, 10000)

      return Response.json({ success: true, session })
    }

    // 6. RELAY ICE CANDIDATES
    if (action === 'ice' && iceCandidate) {
      if (userId === session.callerId) {
        session.callerIce.push(iceCandidate)
      } else {
        session.calleeIce.push(iceCandidate)
      }
      session.updatedAt = now
      activeCallSessions.set(callId, session)

      return Response.json({ success: true, session })
    }

    // 7. RELAY SDP ANSWER / OFFER
    if (action === 'sdp') {
      if (offer) session.offer = offer
      if (answer) session.answer = answer
      session.updatedAt = now
      activeCallSessions.set(callId, session)

      return Response.json({ success: true, session })
    }

    return Response.json({ error: 'Invalid action parameter' }, { status: 400 })
  } catch (err: any) {
    console.error('Call signal error:', err)
    return Response.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
