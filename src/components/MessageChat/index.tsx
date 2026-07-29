'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MessageSquare,
  Search,
  Paperclip,
  Send,
  RefreshCw,
  CheckCheck,
  Image as ImageIcon,
  Video as VideoIcon,
  X,
  Building2,
  Phone,
  Video,
  PhoneOff,
  Mic,
  MicOff,
  VideoOff,
} from 'lucide-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import './index.scss'

dayjs.extend(relativeTime)

type BranchRef = {
  id: string
  name?: string
}

type StaffUser = {
  id: string
  name?: string
  email?: string
  role?: string
  branch?: BranchRef | string
  lastLoginBranch?: BranchRef | string
}

type Employee = {
  id: string
  name?: string
  code?: string
  designation?: string
  branch?: {
    id: string
    name?: string
  }
}

type MessageThread = {
  id: string
  participantName: string
  staffUser?: StaffUser | string
  employee?: Employee | string
  status: 'open' | 'archived'
  lastMessageAt?: string
  lastMessageText?: string
  lastMessageByUser?: StaffUser | string
  lastMessageByRole?: string
  adminLastReadAt?: string
  staffLastReadAt?: string
  updatedAt?: string
  createdAt?: string
  isVirtual?: boolean
}

type Attachment = {
  id: string
  filename?: string
  url?: string
  attachmentType?: 'image' | 'video'
  mimeType?: string
}

type Message = {
  id: string
  thread: string | MessageThread
  seq: number
  staffUser?: StaffUser | string
  employee?: Employee | string
  senderUser?: StaffUser | string
  senderRole: string
  recipientAudience: 'admins' | 'staff'
  messageType: 'text' | 'image' | 'video'
  attachment?: Attachment | string
  text?: string
  createdAt: string
}

export default function MessageChat() {
  const [threads, setThreads] = useState<MessageThread[]>([])
  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [inputText, setInputText] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [loadingThreads, setLoadingThreads] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [sending, setSending] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // WebRTC Calling Refs & States
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)

  const [activeCall, setActiveCall] = useState<{
    callId: string
    callType: 'audio' | 'video'
    status: 'ringing' | 'accepted' | 'rejected' | 'ended'
  } | null>(null)

  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [callTimer, setCallTimer] = useState(0)

  // End WebRTC Call
  const endWebRTCCall = useCallback(() => {
    if (activeCall?.callId) {
      fetch('/api/call-signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'end',
          callId: activeCall.callId,
        }),
      }).catch(() => {})
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }

    setActiveCall(null)
    setIsMuted(false)
    setIsVideoOff(false)
    setCallTimer(0)
  }, [activeCall?.callId])

  // Scroll messages viewport to bottom
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior })
    }
  }

  // Helper to resolve User details
  const resolveUser = (userRef: StaffUser | string | undefined): StaffUser | null => {
    if (!userRef) return null
    if (typeof userRef === 'object') return userRef
    return null
  }

  // Helper to resolve Employee details
  const resolveEmployee = (empRef: Employee | string | undefined): Employee | null => {
    if (!empRef) return null
    if (typeof empRef === 'object') return empRef
    return null
  }

  // Fetch Unread Receipts
  const fetchUnreadCounts = useCallback(async () => {
    try {
      const res = await fetch(
        '/api/message-receipts?where[recipientAudience][equals]=admins&where[status][not_equals]=read&limit=500',
        { headers: { 'Content-Type': 'application/json' } },
      )
      if (!res.ok) return
      const data = await res.json()
      const docs = data.docs || []
      const counts: Record<string, number> = {}

      docs.forEach((rcpt: any) => {
        const tId = typeof rcpt.thread === 'object' ? rcpt.thread?.id : rcpt.thread
        if (tId) {
          counts[tId] = (counts[tId] || 0) + 1
        }
      })

      setUnreadCounts(counts)
    } catch (_e) {}
  }, [])

  // Mark Thread Receipts As Read
  const markThreadAsRead = useCallback(async (threadId: string) => {
    try {
      const res = await fetch(
        '/api/message-receipts?where[thread][equals]=' +
          threadId +
          '&where[recipientAudience][equals]=admins&where[status][not_equals]=read',
        { headers: { 'Content-Type': 'application/json' } },
      )
      if (!res.ok) return
      const data = await res.json()
      const docs = data.docs || []

      if (docs.length > 0) {
        await Promise.all(
          docs.map((rcpt: any) =>
            fetch('/api/message-receipts/' + rcpt.id, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'read' }),
            }),
          ),
        )
      }

      setUnreadCounts((prev) => {
        const next = { ...prev }
        delete next[threadId]
        return next
      })
    } catch (_e) {}
  }, [])

  // Fetch Threads & Staff Candidates
  const fetchThreads = useCallback(async (isQuiet = false) => {
    if (!isQuiet) setLoadingThreads(true)
    else setRefreshing(true)
    setErrorMsg(null)

    try {
      const [threadsRes, usersRes] = await Promise.all([
        fetch('/api/message-threads?sort=-lastMessageAt&limit=100&depth=3', {
          headers: { 'Content-Type': 'application/json' },
        }),
        fetch('/api/users?limit=300&depth=2', {
          headers: { 'Content-Type': 'application/json' },
        }),
      ])

      if (!threadsRes.ok) throw new Error('Failed to load threads: ' + threadsRes.statusText)

      const threadsData = await threadsRes.json().catch(() => ({}))
      const usersData = await usersRes.json().catch(() => ({}))

      const threadDocs: MessageThread[] = threadsData.docs || []
      const userDocs: any[] = usersData.docs || []

      // Track existing staff user IDs that already have a thread
      const existingStaffUserIds = new Set<string>()
      threadDocs.forEach((t) => {
        const uId = typeof t.staffUser === 'object' ? t.staffUser?.id : t.staffUser
        if (uId) existingStaffUserIds.add(String(uId))
      })

      // Generate virtual candidate threads for staff users without an existing thread
      const virtualThreads: MessageThread[] = []
      userDocs.forEach((u) => {
        if (u.id && !existingStaffUserIds.has(String(u.id)) && u.employee) {
          virtualThreads.push({
            id: 'virtual-' + u.id,
            participantName: u.name || u.email || 'Staff Member',
            staffUser: u,
            employee: u.employee,
            status: 'open',
            isVirtual: true,
          })
        }
      })

      const combinedThreads = [...threadDocs, ...virtualThreads]
      setThreads(combinedThreads)

      // Only auto-select from threads that already have messages
      const messagedDocs = threadDocs.filter((t) => Boolean(t.lastMessageAt || t.lastMessageText))

      // Auto-select first thread if none selected
      setSelectedThread((prev) => {
        if (!prev && messagedDocs.length > 0) return messagedDocs[0]
        if (prev) {
          const updated = combinedThreads.find((t) => t.id === prev.id)
          return updated || prev
        }
        return null
      })

      fetchUnreadCounts()
    } catch (err: any) {
      console.error('Fetch threads error:', err)
      if (!isQuiet) setErrorMsg(err.message || 'Failed to fetch conversation threads')
    } finally {
      setLoadingThreads(false)
      setRefreshing(false)
    }
  }, [fetchUnreadCounts])

  // Select Thread (Auto-creates real thread in DB if candidate/virtual thread clicked)
  const handleSelectThread = async (thread: MessageThread) => {
    if (thread.isVirtual || thread.id.startsWith('virtual-')) {
      const staffUserObj = resolveUser(thread.staffUser)
      const staffUserId = staffUserObj?.id || (typeof thread.staffUser === 'string' ? thread.staffUser : null)
      if (!staffUserId) return

      setLoadingMessages(true)
      setErrorMsg(null)

      try {
        const createRes = await fetch('/api/message-threads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ staffUser: staffUserId }),
        })

        if (!createRes.ok) {
          const errData = await createRes.json().catch(() => ({}))
          throw new Error(errData.errors?.[0]?.message || 'Failed to create conversation thread')
        }

        const createdData = await createRes.json()
        const newThreadDoc: MessageThread = createdData.doc || createdData

        setSelectedThread(newThreadDoc)
        await fetchThreads(true)
      } catch (err: any) {
        console.error('Create thread error:', err)
        setErrorMsg(err.message || 'Could not start conversation with selected staff user.')
      } finally {
        setLoadingMessages(false)
      }
    } else {
      setSelectedThread(thread)
    }
  }
  // Start WebRTC Call
  const startWebRTCCall = async (callType: 'audio' | 'video') => {
    if (!selectedThread) return
    const staffUserObj = resolveUser(selectedThread.staffUser)
    const calleeId = staffUserObj?.id || (typeof selectedThread.staffUser === 'string' ? selectedThread.staffUser : null)
    if (!calleeId) {
      setErrorMsg('Cannot call selected participant: staff ID missing')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video',
      })

      localStreamRef.current = stream
      if (localVideoRef.current && callType === 'video') {
        localVideoRef.current.srcObject = stream
      }

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      })
      peerConnectionRef.current = pc

      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          if (remoteVideoRef.current && callType === 'video') {
            remoteVideoRef.current.srcObject = event.streams[0]
          }
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = event.streams[0]
          }
        }
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const res = await fetch('/api/call-signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'initiate',
          threadId: selectedThread.id,
          calleeId,
          callType,
          offer,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to initiate call signal')
      }

      const callId = data.callId
      setActiveCall({ callId, callType, status: 'ringing' })

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          fetch('/api/call-signal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'ice',
              callId,
              iceCandidate: event.candidate,
            }),
          }).catch(() => {})
        }
      }
    } catch (err: any) {
      console.error('Start call error:', err)
      setErrorMsg(err.message || 'Could not access microphone/camera or start call.')
      endWebRTCCall()
    }
  }

  // Poll call status & relay signals
  useEffect(() => {
    if (!activeCall?.callId || activeCall.status === 'ended') return

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/call-signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'poll',
            callId: activeCall.callId,
          }),
        })

        if (!res.ok) return
        const data = await res.json()
        const session = data.session

        if (session) {
          setActiveCall((prev) => (prev ? { ...prev, status: session.status } : null))

          if (session.status === 'accepted' && session.answer && peerConnectionRef.current) {
            if (!peerConnectionRef.current.currentRemoteDescription) {
              const remoteDesc = new RTCSessionDescription(session.answer)
              await peerConnectionRef.current.setRemoteDescription(remoteDesc)
            }
          }

          if (session.calleeIce && session.calleeIce.length > 0 && peerConnectionRef.current) {
            for (const cand of session.calleeIce) {
              try {
                await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(cand))
              } catch (_e) {}
            }
          }

          if (session.status === 'rejected' || session.status === 'ended') {
            endWebRTCCall()
          }
        }
      } catch (_e) {}
    }, 1500)

    return () => clearInterval(interval)
  }, [activeCall?.callId, activeCall?.status, endWebRTCCall])

  // Call timer interval
  useEffect(() => {
    if (activeCall?.status !== 'accepted') {
      setCallTimer(0)
      return
    }

    const timer = setInterval(() => {
      setCallTimer((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [activeCall?.status])

  // Toggle Mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMuted
      })
      setIsMuted(!isMuted)
    }
  }

  // Toggle Video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = isVideoOff
      })
      setIsVideoOff(!isVideoOff)
    }
  }

  const formatCallTimer = (sec: number): string => {
    const mins = Math.floor(sec / 60)
    const s = sec % 60
    return (mins < 10 ? '0' : '') + mins + ':' + (s < 10 ? '0' : '') + s
  }

  // Fetch Messages for active thread
  const fetchMessages = useCallback(async (threadId: string, isQuiet = false) => {
    if (!threadId) return
    if (!isQuiet) setLoadingMessages(true)

    try {
      const res = await fetch(
        '/api/messages?where[thread][equals]=' + threadId + '&sort=seq&limit=200&depth=2',
        {
          headers: { 'Content-Type': 'application/json' },
        },
      )

      if (!res.ok) throw new Error('Failed to load messages: ' + res.statusText)

      const data = await res.json()
      const docs: Message[] = data.docs || []
      setMessages(docs)
    } catch (err: any) {
      console.error('Fetch messages error:', err)
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchThreads()
  }, [fetchThreads])

  // Load messages & mark read when thread changes
  useEffect(() => {
    if (selectedThread?.id) {
      fetchMessages(selectedThread.id)
      markThreadAsRead(selectedThread.id)
    } else {
      setMessages([])
    }
  }, [selectedThread?.id, fetchMessages, markThreadAsRead])

  // Auto-scroll when messages update
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom('auto')
    }
  }, [messages.length])

  // Polling every 4 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      fetchThreads(true)
      if (selectedThread?.id) {
        fetchMessages(selectedThread.id, true)
        markThreadAsRead(selectedThread.id)
      }
    }, 4000)

    return () => clearInterval(timer)
  }, [fetchThreads, fetchMessages, markThreadAsRead, selectedThread?.id])

  // Filtered threads list:
  // - When NOT searching: show messaged participants only
  // - When SEARCHING: search across ALL participants (including unmessaged staff/employees) to message new persons
  const filteredThreads = useMemo(() => {
    const hasSearch = searchQuery.trim().length > 0

    if (!hasSearch) {
      return threads.filter((t) => Boolean(t.lastMessageAt || t.lastMessageText))
    }

    const q = searchQuery.toLowerCase().trim()
    return threads.filter((t) => {
      const pName = (t.participantName || '').toLowerCase()
      const emp = resolveEmployee(t.employee)
      const empName = (emp?.name || '').toLowerCase()
      const empCode = (emp?.code || '').toLowerCase()
      const staffUser = resolveUser(t.staffUser)
      const staffName = (staffUser?.name || '').toLowerCase()
      const staffEmail = (staffUser?.email || '').toLowerCase()
      const lastText = (t.lastMessageText || '').toLowerCase()

      return (
        pName.includes(q) ||
        empName.includes(q) ||
        empCode.includes(q) ||
        staffName.includes(q) ||
        staffEmail.includes(q) ||
        lastText.includes(q)
      )
    })
  }, [threads, searchQuery])

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
    }
  }

  // Handle Send Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!selectedThread?.id) return

    const textToSend = inputText.trim()
    const fileToSend = selectedFile
    if (!textToSend && !fileToSend) return

    // Immediately clear input fields for instant UI responsiveness
    setInputText('')
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''

    // Optimistically create temporary message bubble
    const tempMsgId = 'temp-' + Date.now()
    const tempMsg: Message = {
      id: tempMsgId,
      thread: selectedThread.id,
      seq: messages.length + 1,
      senderRole: 'admin',
      recipientAudience: 'staff',
      messageType: fileToSend
        ? fileToSend.type.startsWith('video/')
          ? 'video'
          : 'image'
        : 'text',
      text: textToSend,
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, tempMsg])
    setTimeout(() => scrollToBottom('smooth'), 50)

    setSending(true)
    setErrorMsg(null)

    try {
      let attachmentId: string | null = null

      // Step 1: Upload attachment if file was selected
      if (fileToSend) {
        const formData = new FormData()
        formData.append('file', fileToSend)
        formData.append('thread', selectedThread.id)
        formData.append('_payload', JSON.stringify({ thread: selectedThread.id }))

        const uploadRes = await fetch('/api/message-attachments', {
          method: 'POST',
          body: formData,
        })

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}))
          throw new Error(errData.errors?.[0]?.message || 'Failed to upload attachment file')
        }

        const uploadData = await uploadRes.json()
        attachmentId = uploadData.doc?.id || uploadData.id
      }

      // Step 2: Post message
      const payloadBody: any = {
        thread: selectedThread.id,
        text: textToSend,
      }

      if (attachmentId) {
        payloadBody.attachment = attachmentId
      }

      const msgRes = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadBody),
      })

      if (!msgRes.ok) {
        const errData = await msgRes.json().catch(() => ({}))
        throw new Error(errData.errors?.[0]?.message || 'Failed to send message')
      }

      // Refresh real messages & threads
      await fetchMessages(selectedThread.id, true)
      await fetchThreads(true)
    } catch (err: any) {
      console.error('Send message error:', err)
      setErrorMsg(err.message || 'Could not send message. Please try again.')
      // Remove temp message if failed
      setMessages((prev) => prev.filter((m) => m.id !== tempMsgId))
    } finally {
      setSending(false)
    }
  }

  // Formatting Helper Utilities
  const getInitials = (name?: string): string => {
    if (!name) return '?'
    const parts = name.trim().split(' ')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  const formatRoleLabel = (role?: string): string => {
    if (!role) return 'User'
    const clean = role.trim().toLowerCase()
    if (clean === 'superadmin') return 'Superadmin'
    if (clean === 'admin') return 'Admin'
    if (clean === 'staff') return 'Staff'
    if (clean === 'cashier') return 'Cashier'
    if (clean === 'waiter') return 'Waiter'
    if (clean === 'chef') return 'Chef'
    return role.charAt(0).toUpperCase() + role.slice(1)
  }

  const getRoleBadgeClass = (role?: string): string => {
    if (!role) return ''
    const clean = role.trim().toLowerCase()
    if (clean === 'superadmin') return 'superadmin'
    if (clean === 'admin') return 'admin'
    if (clean === 'staff') return 'staff'
    return ''
  }

  const formatMessageTime = (dateStr?: string): string => {
    if (!dateStr) return ''
    const d = dayjs(dateStr)
    const now = dayjs()
    if (d.isSame(now, 'day')) {
      return d.format('hh:mm A')
    }
    if (d.isSame(now.subtract(1, 'day'), 'day')) {
      return 'Yesterday'
    }
    return d.format('MMM D, hh:mm A')
  }

  const resolveLastLoginBranchName = (thread: MessageThread): string | null => {
    const staffUser = resolveUser(thread.staffUser)
    const employee = resolveEmployee(thread.employee)

    if (
      staffUser?.lastLoginBranch &&
      typeof staffUser.lastLoginBranch === 'object' &&
      'name' in staffUser.lastLoginBranch
    ) {
      return (staffUser.lastLoginBranch as BranchRef).name || null
    }

    if (staffUser?.branch && typeof staffUser.branch === 'object' && 'name' in staffUser.branch) {
      return (staffUser.branch as BranchRef).name || null
    }

    if (employee?.branch && typeof employee.branch === 'object' && 'name' in employee.branch) {
      return (employee.branch as BranchRef).name || null
    }

    return null
  }

  // Active Participant User & Employee Details
  const activeStaffUser = selectedThread ? resolveUser(selectedThread.staffUser) : null
  const activeEmployee = selectedThread ? resolveEmployee(selectedThread.employee) : null

  const getSubtext = () => {
    if (!activeEmployee) return 'Staff Member'
    const parts = []
    if (activeEmployee.designation) parts.push(activeEmployee.designation)
    if (activeEmployee.code) parts.push('ID: ' + activeEmployee.code)
    if (activeEmployee.branch?.name) parts.push(activeEmployee.branch.name)
    return parts.join(' • ') || 'Staff Member'
  }

  const getUnreadCount = (thread: MessageThread): number => {
    if (unreadCounts[thread.id] !== undefined) {
      return unreadCounts[thread.id]
    }
    if (thread.lastMessageAt) {
      if (!thread.adminLastReadAt || thread.lastMessageAt > thread.adminLastReadAt) {
        return 1
      }
    }
    return 0
  }

  return (
    <div className="whatsapp-chat-container">
      {/* Left Sidebar - Conversation Threads List */}
      <div className="chat-sidebar">
        <div className="sidebar-header">
          <div className="header-title">
            <MessageSquare size={22} />
            <span>Message Chat</span>
          </div>
          <button
            type="button"
            className={'refresh-btn' + (refreshing ? ' spinning' : '')}
            onClick={() => fetchThreads(false)}
            title="Refresh conversations"
          >
            <RefreshCw size={17} />
          </button>
        </div>

        {/* Search Input */}
        <div className="sidebar-search">
          <div className="search-box">
            <Search />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Threads List */}
        <div className="threads-list">
          {loadingThreads ? (
            <div className="no-threads">Loading conversations...</div>
          ) : filteredThreads.length === 0 ? (
            <div className="no-threads">No conversations found</div>
          ) : (
            filteredThreads.map((thread) => {
              const isSelected = selectedThread?.id === thread.id
              const staffUser = resolveUser(thread.staffUser)
              const staffRole = staffUser?.role || ''
              const branchName = resolveLastLoginBranchName(thread)
              const unreadCount = getUnreadCount(thread)

              return (
                <div
                  key={thread.id}
                  className={'thread-item' + (isSelected ? ' active' : '')}
                  onClick={() => handleSelectThread(thread)}
                >
                  <div className="participant-avatar">
                    {getInitials(thread.participantName)}
                  </div>

                  <div className="thread-info">
                    <div className="thread-top">
                      <span className="participant-name">{thread.participantName}</span>
                      <span className="message-time">{formatMessageTime(thread.lastMessageAt || thread.updatedAt)}</span>
                    </div>

                    <div className="thread-meta-row">
                      <div className="meta-left">
                        {staffRole && (
                          <span className={'sender-role-tag ' + getRoleBadgeClass(staffRole)}>
                            {formatRoleLabel(staffRole)}
                          </span>
                        )}
                        {branchName && (
                          <span className="branch-tag">
                            <Building2 size={11} />
                            {branchName}
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <span className="unread-badge">{unreadCount}</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Right Main Chat Pane */}
      <div className="chat-main">
        {selectedThread ? (
          <>
            {/* Header */}
            <div className="chat-header">
              <div className="header-user-info">
                <div className="user-avatar">
                  {getInitials(selectedThread.participantName)}
                </div>

                <div className="user-details">
                  <div className="user-name">
                    <span>{selectedThread.participantName}</span>
                    {activeStaffUser?.role && (
                      <span className={'sender-role-tag ' + getRoleBadgeClass(activeStaffUser.role)}>
                        {formatRoleLabel(activeStaffUser.role)}
                      </span>
                    )}
                  </div>
                  <div className="user-subtext">{getSubtext()}</div>
                </div>
              </div>

              <div className="header-actions">
                <button
                  type="button"
                  className="call-header-btn audio"
                  title="Audio Call Staff App"
                  onClick={() => startWebRTCCall('audio')}
                >
                  <Phone size={18} />
                </button>
                <button
                  type="button"
                  className="call-header-btn video"
                  title="Video Call Staff App"
                  onClick={() => startWebRTCCall('video')}
                >
                  <Video size={18} />
                </button>
                <div className={'status-pill ' + selectedThread.status}>
                  {selectedThread.status}
                </div>
              </div>
            </div>

            {/* Error Notification */}
            {errorMsg && (
              <div
                style={{
                  padding: '8px 16px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#f87171',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>{errorMsg}</span>
                <X size={16} style={{ cursor: 'pointer' }} onClick={() => setErrorMsg(null)} />
              </div>
            )}

            {/* Messages Viewport */}
            <div className="messages-viewport">
              {loadingMessages ? (
                <div className="no-messages-selected">Loading message history...</div>
              ) : messages.length === 0 ? (
                <div className="no-messages-selected">
                  <MessageSquare size={36} />
                  <h3>No messages in this conversation yet</h3>
                  <p>Send a message below to start chatting.</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const sender = resolveUser(msg.senderUser)
                  const senderName = sender?.name || sender?.email || 'User'
                  const isOutgoing = msg.recipientAudience === 'staff' // Sent from Admin to Staff
                  const attachmentObj = typeof msg.attachment === 'object' ? (msg.attachment as Attachment) : null

                  return (
                    <div
                      key={msg.id}
                      className={'message-wrapper ' + (isOutgoing ? 'outgoing' : 'incoming')}
                    >
                      <div className="chat-bubble">
                        <div className="sender-header">
                          <span className="sender-name">{senderName}</span>
                          <span className={'role-badge ' + getRoleBadgeClass(msg.senderRole)}>
                            {formatRoleLabel(msg.senderRole)}
                          </span>
                        </div>

                        {/* Media Attachment View */}
                        {attachmentObj && (
                          <div className="media-attachment">
                            {attachmentObj.attachmentType === 'video' ||
                            (attachmentObj.mimeType && attachmentObj.mimeType.startsWith('video/')) ? (
                              <video controls src={attachmentObj.url} />
                            ) : (
                              <img
                                src={attachmentObj.url}
                                alt={attachmentObj.filename || 'Attachment'}
                                onClick={() => attachmentObj.url && window.open(attachmentObj.url, '_blank')}
                              />
                            )}
                          </div>
                        )}

                        {/* Message Text */}
                        {msg.text && <div className="message-body">{msg.text}</div>}

                        {/* Message Metadata (Time & Ticks) */}
                        <div className="bubble-meta">
                          <span>{formatMessageTime(msg.createdAt)}</span>
                          <span className="status-icon read">
                            <CheckCheck size={14} />
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Bar */}
            <form className="chat-input-bar" onSubmit={handleSendMessage}>
              {selectedFile && (
                <div className="attachment-preview-bar">
                  <div className="preview-info">
                    {selectedFile.type.startsWith('video/') ? (
                      <VideoIcon size={16} />
                    ) : (
                      <ImageIcon size={16} />
                    )}
                    <span>{selectedFile.name + ' (' + (selectedFile.size / 1024 / 1024).toFixed(2) + ' MB)'}</span>
                  </div>
                  <button
                    type="button"
                    className="remove-attach-btn"
                    onClick={() => {
                      setSelectedFile(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              <div className="input-row">
                <button
                  type="button"
                  className="attach-btn"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach Image or Video"
                >
                  <Paperclip size={20} />
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                />

                <textarea
                  className="chat-textarea"
                  rows={1}
                  placeholder="Type a message..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                />

                <button
                  type="submit"
                  className="send-btn"
                  disabled={!inputText.trim() && !selectedFile}
                  title="Send Message"
                >
                  <Send size={18} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="no-messages-selected" style={{ margin: 'auto' }}>
            <MessageSquare size={48} style={{ color: '#00a884', opacity: 0.5, marginBottom: 12 }} />
            <h3 style={{ color: '#e9edef', fontWeight: 600 }}>WhatsApp Web Message Center</h3>
            <p style={{ color: '#8696a0', fontSize: '0.9rem' }}>
              Select a conversation thread on the left to start messaging.
            </p>
          </div>
        )}
      </div>

      {/* Active Call Modal Overlay */}
      {activeCall && (
        <div className="active-call-overlay">
          <div className="call-card">
            <div className="call-card-header">
              <span className="call-name">{selectedThread?.participantName}</span>
              <span className="call-status-label">
                {activeCall.status === 'ringing'
                  ? 'Ringing staff mobile app...'
                  : activeCall.status === 'accepted'
                    ? 'In Call • ' + formatCallTimer(callTimer)
                    : activeCall.status}
              </span>
            </div>

            <div className="call-video-container">
              {activeCall.callType === 'video' ? (
                <>
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="remote-video"
                  />
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="local-video-preview"
                  />
                </>
              ) : (
                <div className="audio-call-placeholder">
                  <div className="audio-avatar">
                    {getInitials(selectedThread?.participantName)}
                  </div>
                  <p>{selectedThread?.participantName}</p>
                  <audio ref={remoteAudioRef} autoPlay />
                </div>
              )}
            </div>

            <div className="call-controls">
              <button
                type="button"
                className={'control-btn ' + (isMuted ? 'active' : '')}
                onClick={toggleMute}
                title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
              >
                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>

              {activeCall.callType === 'video' && (
                <button
                  type="button"
                  className={'control-btn ' + (isVideoOff ? 'active' : '')}
                  onClick={toggleVideo}
                  title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
                >
                  {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
                </button>
              )}

              <button
                type="button"
                className="control-btn end-call"
                onClick={endWebRTCCall}
                title="End Call"
              >
                <PhoneOff size={22} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
