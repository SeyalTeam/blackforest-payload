'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Star,
  Users,
  Lock,
  Globe,
  Plus,
  MoreHorizontal,
  X,
  Clock,
  Paperclip,
  AlignLeft,
  CheckSquare,
  Zap,
  Filter,
  Search,
  Check,
  ChevronDown,
  Trash2,
  Tag,
  Calendar,
  AlertCircle,
  FolderPlus,
  RefreshCw,
} from 'lucide-react'
import './index.scss'

export type TaskLabel = {
  id?: string
  text: string
  color: 'green' | 'yellow' | 'orange' | 'red' | 'purple' | 'blue' | 'cyan' | 'pink'
}

export type ChecklistItem = {
  id?: string
  text: string
  completed: boolean
}

export type TaskItem = {
  id: string
  title: string
  description?: string
  status: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  assignmentType?: 'role' | 'individual' | 'both'
  assignedRole?: string
  assignedEmployee?: any
  assignedUser?: any
  dueDate?: string
  order?: number
  labels?: TaskLabel[]
  checklist?: ChecklistItem[]
  createdAt?: string
  updatedAt?: string
}

export type EmployeeOption = {
  id: string
  name: string
  team?: string
  employeeId?: string
  photo?: any
}

export type UserOption = {
  id: string
  name?: string
  email?: string
  role?: string
}

const DEFAULT_ROLES = [
  { value: 'manager', label: 'Manager', emoji: '👔' },
  { value: 'chef', label: 'Chef', emoji: '👨‍🍳' },
  { value: 'kitchen', label: 'Kitchen', emoji: '🍳' },
  { value: 'waiter', label: 'Waiter', emoji: '🛎️' },
  { value: 'cashier', label: 'Cashier', emoji: '💰' },
  { value: 'supervisor', label: 'Supervisor', emoji: '📋' },
  { value: 'delivery', label: 'Delivery', emoji: '🛵' },
  { value: 'driver', label: 'Driver', emoji: '🚚' },
  { value: 'store_keeper', label: 'Store Keeper', emoji: '📦' },
  { value: 'account', label: 'Account', emoji: '📊' },
  { value: 'admin', label: 'Admin', emoji: '🛡️' },
]

const STATUS_COLUMNS: { id: TaskItem['status']; title: string }[] = [
  { id: 'backlog', title: 'Goal 1: Grow Customers By 25%' },
  { id: 'todo', title: 'Goal 2: Reduce Office Supply Costs By 15%' },
  { id: 'in_progress', title: 'Goal Template' },
  { id: 'review', title: 'Done (Q1 2019)' },
  { id: 'done', title: 'Done (Q4 2018)' },
]

const LABEL_PRESETS: { text: string; color: TaskLabel['color'] }[] = [
  { text: 'Achieved!', color: 'green' },
  { text: 'Up Next', color: 'yellow' },
  { text: 'At Risk', color: 'orange' },
  { text: 'Missed (for now)', color: 'red' },
  { text: 'In Progress', color: 'purple' },
  { text: 'On Track', color: 'blue' },
  { text: 'Trello Tips', color: 'cyan' },
  { text: 'Planning', color: 'pink' },
]

const SAMPLE_INITIAL_TASKS: Omit<TaskItem, 'id'>[] = [
  {
    title: 'Trello Tip: Set S. M. A. R. T Goals (Click for more info)',
    status: 'backlog',
    priority: 'medium',
    assignedRole: 'manager',
    labels: [{ text: 'Trello Tips', color: 'cyan' }],
    description: 'Specific, Measurable, Achievable, Relevant, and Time-bound goal setting framework.',
    checklist: [
      { text: 'Define customer acquisition targets', completed: true },
      { text: 'Align referral bonuses', completed: false },
    ],
  },
  {
    title: 'Goal Stakeholders',
    status: 'backlog',
    priority: 'high',
    assignedRole: 'manager',
    description: 'Executive committee and marketing leads.',
  },
  {
    title: 'Current Progress Towards "Grow Customers By 25%"',
    status: 'backlog',
    priority: 'urgent',
    assignedRole: 'account',
    labels: [{ text: 'At Risk', color: 'orange' }],
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString(),
    description: 'Evaluating quarterly run-rate versus initial projections.',
  },
  {
    title: 'Launch customer referral email program.',
    status: 'backlog',
    priority: 'high',
    assignedRole: 'supervisor',
    labels: [{ text: 'Up Next', color: 'yellow' }],
    dueDate: '2026-01-31T18:30:00.000Z',
    description: 'Prepare HTML email campaign templates and promotional discounts.',
  },
  {
    title: 'Trello Tip: Cards can summarize specific projects and efforts that your team is working on to reach the goal.',
    status: 'backlog',
    priority: 'low',
    labels: [{ text: 'Trello Tips', color: 'cyan' }],
  },
  {
    title: 'Trello Tip: Card labels! What do they mean? (Click for more info)',
    status: 'todo',
    priority: 'medium',
    labels: [
      { text: 'Achieved!', color: 'green' },
      { text: 'Up Next', color: 'yellow' },
      { text: 'At Risk', color: 'orange' },
      { text: 'Missed (for now)', color: 'red' },
      { text: 'In Progress', color: 'purple' },
      { text: 'On Track', color: 'blue' },
      { text: 'Trello Tips', color: 'cyan' },
      { text: 'Planning', color: 'pink' },
    ],
  },
  {
    title: 'Goal Stakeholders',
    status: 'todo',
    assignedRole: 'store_keeper',
    description: 'Procurement manager, logistics, and store keeper.',
  },
  {
    title: 'Current Progress Towards "Reduce Office Supply $$ By 15%',
    status: 'todo',
    assignedRole: 'account',
    labels: [{ text: 'On Track', color: 'blue' }],
  },
  {
    title: 'Reduce total team printing volume by 20%',
    status: 'todo',
    assignedRole: 'cashier',
    labels: [{ text: 'In Progress', color: 'purple' }],
  },
  {
    title: 'Negotiate loyalty discount with supplier for new fiscal year',
    status: 'todo',
    assignedRole: 'store_keeper',
    labels: [{ text: 'Achieved!', color: 'green' }],
  },
  {
    title: 'Trello Tip: Keep a list "template" that you can copy and rename for each new goal.',
    status: 'in_progress',
    labels: [{ text: 'Trello Tips', color: 'cyan' }],
  },
  {
    title: 'Goal Stakeholders',
    status: 'in_progress',
    assignedRole: 'manager',
  },
  {
    title: 'Current Progress Towards Goal',
    status: 'in_progress',
    assignedRole: 'supervisor',
    labels: [{ text: 'On Track', color: 'blue' }],
  },
  {
    title: 'Trello Tip: Try these 5 team-building exercises for setting goals! (Click for more info)',
    status: 'in_progress',
    labels: [{ text: 'Trello Tips', color: 'cyan' }],
    description: 'Resource guides and ice-breaker templates.',
  },
  {
    title: 'Trello Tip: Put finished projects and closed goals here.',
    status: 'review',
    labels: [{ text: 'Trello Tips', color: 'cyan' }],
  },
  {
    title: 'Hire 5 new people for 2019!',
    status: 'review',
    assignedRole: 'manager',
    labels: [{ text: 'Achieved!', color: 'green' }],
  },
  {
    title: 'Trello Tip: Create new "Done" lists for each quarter to build a history of accomplished goals.',
    status: 'done',
    labels: [{ text: 'Trello Tips', color: 'cyan' }],
  },
]

type WorkTasksBoardProps = {
  isStandalone?: boolean
}

export default function WorkTasksBoard({ isStandalone = false }: WorkTasksBoardProps) {
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [loading, setLoading] = useState(true)
  const [isStarred, setIsStarred] = useState(false)

  // View switch mode: 'status' | 'role' | 'individual'
  const [viewMode, setViewMode] = useState<'status' | 'role' | 'individual'>('status')

  // Search and filter controls
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [individualFilter, setIndividualFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')

  // Inline Card Quick Add composer state: { columnId: string, title: string } | null
  const [inlineAddingCol, setInlineAddingCol] = useState<string | null>(null)
  const [inlineTitle, setInlineTitle] = useState('')

  // Active modal card state for detail view
  const [activeModalCard, setActiveModalCard] = useState<TaskItem | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // New checklist item input inside modal
  const [newChecklistText, setNewChecklistText] = useState('')

  // Fetch initial tasks, employees, and users
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [tasksRes, employeesRes, usersRes] = await Promise.all([
        fetch('/api/tasks?limit=500&depth=2').catch(() => null),
        fetch('/api/employees?limit=300&depth=1').catch(() => null),
        fetch('/api/users?limit=300&depth=1').catch(() => null),
      ])

      let loadedEmployees: EmployeeOption[] = []
      if (employeesRes && employeesRes.ok) {
        const empJson = await employeesRes.json()
        loadedEmployees = empJson.docs || []
        setEmployees(loadedEmployees)
      }

      let loadedUsers: UserOption[] = []
      if (usersRes && usersRes.ok) {
        const userJson = await usersRes.json()
        loadedUsers = userJson.docs || []
        setUsers(loadedUsers)
      }

      if (tasksRes && tasksRes.ok) {
        const tasksJson = await tasksRes.json()
        const existingDocs: TaskItem[] = tasksJson.docs || []

        if (existingDocs.length > 0) {
          setTasks(existingDocs)
        } else {
          // Empty DB: Seed sample tasks matching the Trello screenshot
          const seeded: TaskItem[] = []
          for (let i = 0; i < SAMPLE_INITIAL_TASKS.length; i++) {
            const sample = SAMPLE_INITIAL_TASKS[i]
            // Assign some employees if available
            const emp = loadedEmployees[i % (loadedEmployees.length || 1)]
            const payloadData = {
              ...sample,
              assignedEmployee: emp ? emp.id : undefined,
              order: i,
            }

            try {
              const createRes = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadData),
              })
              if (createRes.ok) {
                const created = await createRes.json()
                seeded.push(created.doc)
              }
            } catch (err) {
              console.error('Error seeding task:', err)
            }
          }
          if (seeded.length > 0) {
            setTasks(seeded)
          } else {
            // Fallback in-memory state
            setTasks(
              SAMPLE_INITIAL_TASKS.map((t, idx) => ({
                ...t,
                id: `sample-${idx}`,
              })),
            )
          }
        }
      }
    } catch (err) {
      console.error('Error loading task board data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filtered tasks based on search & dropdowns
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const titleMatch = task.title?.toLowerCase().includes(q)
        const descMatch = task.description?.toLowerCase().includes(q)
        const labelMatch = task.labels?.some((l) => l.text.toLowerCase().includes(q))
        if (!titleMatch && !descMatch && !labelMatch) return false
      }
      if (roleFilter !== 'all' && task.assignedRole !== roleFilter) {
        return false
      }
      if (individualFilter !== 'all') {
        const empId = typeof task.assignedEmployee === 'object' ? task.assignedEmployee?.id : task.assignedEmployee
        const usrId = typeof task.assignedUser === 'object' ? task.assignedUser?.id : task.assignedUser
        if (empId !== individualFilter && usrId !== individualFilter) {
          return false
        }
      }
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
        return false
      }
      return true
    })
  }, [tasks, searchQuery, roleFilter, individualFilter, priorityFilter])

  // Compute Columns dynamically based on viewMode
  const columns = useMemo(() => {
    if (viewMode === 'status') {
      return STATUS_COLUMNS.map((col) => ({
        id: col.id,
        title: col.title,
        tasks: filteredTasks.filter((t) => (t.status || 'todo') === col.id),
      }))
    }

    if (viewMode === 'role') {
      const roleCols = DEFAULT_ROLES.map((r) => ({
        id: r.value,
        title: `${r.emoji} ${r.label}`,
        roleKey: r.value,
        tasks: filteredTasks.filter((t) => t.assignedRole === r.value),
      }))
      const unassignedTasks = filteredTasks.filter((t) => !t.assignedRole)
      if (unassignedTasks.length > 0) {
        roleCols.push({
          id: 'unassigned-role',
          title: '⚪ General / Unassigned Role',
          roleKey: '',
          tasks: unassignedTasks,
        })
      }
      return roleCols
    }

    if (viewMode === 'individual') {
      // Group by Employee / Member
      const indCols = employees.map((emp) => {
        const empTasks = filteredTasks.filter((t) => {
          const id = typeof t.assignedEmployee === 'object' ? t.assignedEmployee?.id : t.assignedEmployee
          return id === emp.id
        })
        return {
          id: emp.id,
          title: `👤 ${emp.name} (${emp.team || 'Staff'})`,
          employeeId: emp.id,
          tasks: empTasks,
        }
      })

      // Unassigned individual column
      const unassignedInd = filteredTasks.filter((t) => !t.assignedEmployee && !t.assignedUser)
      indCols.unshift({
        id: 'unassigned-ind',
        title: '📋 Unassigned Members',
        employeeId: '',
        tasks: unassignedInd,
      })

      return indCols
    }

    return []
  }, [viewMode, filteredTasks, employees])

  // Quick Add Card handler
  const handleQuickAddCard = async (columnId: string) => {
    if (!inlineTitle.trim()) return

    let statusVal: TaskItem['status'] = 'todo'
    let assignedRoleVal: string | undefined = undefined
    let assignedEmpVal: string | undefined = undefined

    if (viewMode === 'status') {
      statusVal = columnId as TaskItem['status']
    } else if (viewMode === 'role') {
      if (columnId !== 'unassigned-role') {
        assignedRoleVal = columnId
      }
    } else if (viewMode === 'individual') {
      if (columnId !== 'unassigned-ind') {
        assignedEmpVal = columnId
      }
    }

    const newTaskData: Partial<TaskItem> = {
      title: inlineTitle.trim(),
      status: statusVal,
      assignedRole: assignedRoleVal,
      assignedEmployee: assignedEmpVal,
      priority: 'medium',
      labels: [{ text: 'Up Next', color: 'yellow' }],
    }

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTaskData),
      })

      if (res.ok) {
        const json = await res.json()
        setTasks((prev) => [json.doc, ...prev])
      } else {
        // Local fallback
        const mockNew: TaskItem = {
          id: `task-${Date.now()}`,
          title: inlineTitle.trim(),
          status: statusVal,
          assignedRole: assignedRoleVal,
          assignedEmployee: assignedEmpVal,
          priority: 'medium',
          labels: [{ text: 'Up Next', color: 'yellow' }],
        }
        setTasks((prev) => [mockNew, ...prev])
      }
    } catch (err) {
      console.error('Error creating task:', err)
    }

    setInlineTitle('')
    setInlineAddingCol(null)
  }

  // Save Modal Card Edits
  const handleSaveModalCard = async () => {
    if (!activeModalCard) return
    setIsSaving(true)
    try {
      const { id, ...dataToSave } = activeModalCard

      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave),
      })

      if (res.ok) {
        const json = await res.json()
        setTasks((prev) => prev.map((t) => (t.id === id ? json.doc : t)))
      } else {
        setTasks((prev) => prev.map((t) => (t.id === id ? activeModalCard : t)))
      }
      setActiveModalCard(null)
    } catch (err) {
      console.error('Error saving task:', err)
    } finally {
      setIsSaving(false)
    }
  }

  // Delete Card
  const handleDeleteCard = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this card?')) return
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
      setActiveModalCard(null)
    } catch (err) {
      console.error('Error deleting card:', err)
    }
  }

  // Toggle checklist item in modal
  const handleToggleChecklist = (idx: number) => {
    if (!activeModalCard) return
    const list = [...(activeModalCard.checklist || [])]
    list[idx] = { ...list[idx], completed: !list[idx].completed }
    setActiveModalCard({ ...activeModalCard, checklist: list })
  }

  // Add checklist item in modal
  const handleAddChecklistItem = () => {
    if (!activeModalCard || !newChecklistText.trim()) return
    const list = [...(activeModalCard.checklist || [])]
    list.push({ text: newChecklistText.trim(), completed: false })
    setActiveModalCard({ ...activeModalCard, checklist: list })
    setNewChecklistText('')
  }

  // Delete checklist item
  const handleDeleteChecklistItem = (idx: number) => {
    if (!activeModalCard) return
    const list = (activeModalCard.checklist || []).filter((_, i) => i !== idx)
    setActiveModalCard({ ...activeModalCard, checklist: list })
  }

  // Toggle label preset
  const handleToggleLabelPreset = (preset: { text: string; color: TaskLabel['color'] }) => {
    if (!activeModalCard) return
    const current = activeModalCard.labels || []
    const exists = current.some((l) => l.text === preset.text)
    let updated: TaskLabel[]
    if (exists) {
      updated = current.filter((l) => l.text !== preset.text)
    } else {
      updated = [...current, preset]
    }
    setActiveModalCard({ ...activeModalCard, labels: updated })
  }

  // Format Due Date Display
  const formatDueDate = (dateStr?: string) => {
    if (!dateStr) return null
    const d = new Date(dateStr)
    const now = new Date()
    const isPast = d.getTime() < now.getTime()
    const isSoon = d.getTime() - now.getTime() < 86400000 * 2 && !isPast

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const formatted = `${monthNames[d.getMonth()]} ${d.getDate()}`

    return {
      text: formatted,
      statusClass: isPast ? 'due-overdue' : isSoon ? 'due-soon' : 'due-normal',
    }
  }

  return (
    <div className={`trello-workspace ${isStandalone ? 'trello-standalone' : ''}`}>
      {/* 1. TOP APP BAR (Dark Blue Brand Bar) */}
      <div className="trello-topbar">
        <div className="topbar-left">
          <div className="trello-brand">
            <span className="trello-icon-badge">■</span>
            <span>Trello</span>
          </div>
          <button className="topbar-btn" onClick={() => fetchData()} title="Refresh Board">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>
        </div>

        <div className="topbar-right">
          <button
            className="topbar-btn"
            onClick={() => {
              if (activeModalCard) return
              const newCard: TaskItem = {
                id: `new-${Date.now()}`,
                title: 'New Work Task',
                status: 'todo',
                priority: 'medium',
                assignmentType: 'role',
                assignedRole: 'kitchen',
                labels: [{ text: 'Up Next', color: 'yellow' }],
              }
              setActiveModalCard(newCard)
            }}
          >
            <Plus size={15} />
            <span>Create</span>
          </button>
        </div>
      </div>

      {/* 2. BOARD HEADER (Title, Stars, Team pill, Public pill, Avatars, Butler, Menu) */}
      <div className="trello-board-header">
        <div className="board-header-left">
          <h1 className="board-title-text">Team Goal Setting Central</h1>

          <button
            className={`icon-star-btn ${isStarred ? 'starred' : ''}`}
            onClick={() => setIsStarred(!isStarred)}
            title="Star this board"
          >
            <Star size={16} fill={isStarred ? '#ffd700' : 'none'} />
          </button>

          <div className="header-divider" />

          <div className="header-pill">
            <span className="tag-badge">ENT</span>
            <span>Blackforest / Seyal Team</span>
          </div>

          <div className="header-divider" />

          <div className="header-pill">
            <Globe size={14} />
            <span>Public</span>
          </div>

          <div className="header-divider" />

          {/* Member Avatar Stack */}
          <div className="avatar-stack">
            <div className="avatar-circle" title="Admin">
              AD
            </div>
            <div className="avatar-circle" title="Chef Raj">
              CR
            </div>
            <div className="avatar-circle" title="Manager">
              MG
            </div>
            <div className="avatar-circle" title="Cashier">
              CS
            </div>
            <div className="avatar-circle avatar-count" title="More team members">
              +7
            </div>
          </div>

          <button
            className="invite-btn"
            onClick={() => alert('Invite team link copied to clipboard!')}
          >
            <Plus size={14} />
            <span>Invite</span>
          </button>
        </div>

        <div className="board-header-right">
          <button className="header-pill" onClick={() => alert('Butler automations: All rules are active!')}>
            <Zap size={14} />
            <span>Butler</span>
          </button>

          <button
            className="header-pill"
            onClick={() =>
              alert(
                'Trello Work Module:\n- View tasks by Status, Role, or Individual.\n- Click on cards to edit.\n- Add tasks directly via + Add another card.',
              )
            }
          >
            <MoreHorizontal size={14} />
            <span>Show Menu</span>
          </button>
        </div>
      </div>

      {/* 3. VIEW MODE & FILTERS TOOLBAR */}
      <div className="trello-filter-toolbar">
        {/* View Switchers: Status | Role | Individual */}
        <div className="view-switchers">
          <button
            className={`view-tab ${viewMode === 'status' ? 'active' : ''}`}
            onClick={() => setViewMode('status')}
          >
            <span>📊 Status Board</span>
          </button>
          <button
            className={`view-tab ${viewMode === 'role' ? 'active' : ''}`}
            onClick={() => setViewMode('role')}
          >
            <span>👥 By Role</span>
          </button>
          <button
            className={`view-tab ${viewMode === 'individual' ? 'active' : ''}`}
            onClick={() => setViewMode('individual')}
          >
            <span>👤 By Individual</span>
          </button>
        </div>

        {/* Filter Controls */}
        <div className="filter-controls">
          <div className="search-box">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search cards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <X size={12} style={{ cursor: 'pointer' }} onClick={() => setSearchQuery('')} />
            )}
          </div>

          <select
            className="filter-select"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">All Roles</option>
            {DEFAULT_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.emoji} {r.label}
              </option>
            ))}
          </select>

          <select
            className="filter-select"
            value={individualFilter}
            onChange={(e) => setIndividualFilter(e.target.value)}
          >
            <option value="all">All Individuals</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                👤 {emp.name}
              </option>
            ))}
          </select>

          <select
            className="filter-select"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {(searchQuery || roleFilter !== 'all' || individualFilter !== 'all' || priorityFilter !== 'all') && (
            <button
              className="clear-filter-btn"
              onClick={() => {
                setSearchQuery('')
                setRoleFilter('all')
                setIndividualFilter('all')
                setPriorityFilter('all')
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* 4. MAIN KANBAN BOARD CANVAS */}
      <div className="trello-board-canvas">
        {columns.map((col) => {
          const isAdding = inlineAddingCol === col.id

          return (
            <div key={col.id} className="trello-list">
              {/* Column Header */}
              <div className="list-header">
                <div className="list-title-wrap">
                  <span className="list-title" title={col.title}>
                    {col.title}
                  </span>
                  <span className="list-count-badge">{col.tasks.length}</span>
                </div>
                <button
                  className="list-menu-btn"
                  onClick={() => alert(`Column Options for: ${col.title}`)}
                >
                  <MoreHorizontal size={15} />
                </button>
              </div>

              {/* Column Cards Container */}
              <div className="list-cards">
                {col.tasks.map((task) => {
                  const dueDateMeta = formatDueDate(task.dueDate)
                  const completedChecklistCount = (task.checklist || []).filter((c) => c.completed).length
                  const totalChecklistCount = (task.checklist || []).length

                  // Resolve assigned employee name
                  let empName = ''
                  if (task.assignedEmployee) {
                    if (typeof task.assignedEmployee === 'object') {
                      empName = task.assignedEmployee.name || ''
                    } else {
                      const found = employees.find((e) => e.id === task.assignedEmployee)
                      if (found) empName = found.name
                    }
                  }

                  // Resolve role emoji
                  const roleObj = DEFAULT_ROLES.find((r) => r.value === task.assignedRole)

                  return (
                    <div
                      key={task.id}
                      className="trello-card"
                      onClick={() => setActiveModalCard(task)}
                    >
                      {/* Label Pills */}
                      {task.labels && task.labels.length > 0 && (
                        <div className="card-labels">
                          {task.labels.map((lbl, idx) => (
                            <span key={idx} className={`card-label-pill label-${lbl.color}`}>
                              {lbl.text}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Card Title */}
                      <div className="card-title">{task.title}</div>

                      {/* Assignment Tags (Role / Individual) */}
                      {(task.assignedRole || empName) && (
                        <div className="card-assignment-tags">
                          {task.assignedRole && (
                            <span className="role-badge">
                              {roleObj?.emoji || '🏷️'} {roleObj?.label || task.assignedRole}
                            </span>
                          )}
                          {empName && (
                            <span className="individual-badge">
                              👤 {empName}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Badges & Avatars */}
                      <div className="card-footer-row">
                        <div className="card-badges">
                          {/* Due Date */}
                          {dueDateMeta && (
                            <span className={`badge-item badge-date ${dueDateMeta.statusClass}`}>
                              <Clock size={11} />
                              <span>{dueDateMeta.text}</span>
                            </span>
                          )}

                          {/* Description Icon */}
                          {task.description && (
                            <span className="badge-item" title="This card has a description.">
                              <AlignLeft size={13} />
                            </span>
                          )}

                          {/* Checklist Icon */}
                          {totalChecklistCount > 0 && (
                            <span
                              className="badge-item"
                              title={`Checklist items: ${completedChecklistCount}/${totalChecklistCount}`}
                            >
                              <CheckSquare size={12} />
                              <span>
                                {completedChecklistCount}/{totalChecklistCount}
                              </span>
                            </span>
                          )}
                        </div>

                        {/* Assignee Avatar Circles */}
                        <div className="card-members">
                          {empName ? (
                            <div className="member-avatar" title={empName}>
                              {empName
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .slice(0, 2)
                                .toUpperCase()}
                            </div>
                          ) : task.assignedRole ? (
                            <div className="member-avatar" title={roleObj?.label || task.assignedRole}>
                              {roleObj?.emoji || '👤'}
                            </div>
                          ) : (
                            <div className="member-avatar" title="Unassigned">
                              ?
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Inline Quick Add Composer */}
                {isAdding && (
                  <div className="inline-card-composer">
                    <textarea
                      autoFocus
                      placeholder="Enter a title for this card..."
                      value={inlineTitle}
                      onChange={(e) => setInlineTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleQuickAddCard(col.id)
                        } else if (e.key === 'Escape') {
                          setInlineAddingCol(null)
                        }
                      }}
                    />
                    <div className="composer-actions">
                      <button className="btn-add" onClick={() => handleQuickAddCard(col.id)}>
                        Add card
                      </button>
                      <button
                        className="btn-cancel"
                        onClick={() => {
                          setInlineAddingCol(null)
                          setInlineTitle('')
                        }}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Column Footer */}
              {!isAdding && (
                <div className="list-footer">
                  <button
                    className="add-card-btn"
                    onClick={() => {
                      setInlineAddingCol(col.id)
                      setInlineTitle('')
                    }}
                  >
                    <Plus size={16} />
                    <span>Add a card</span>
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {/* Add Another List placeholder */}
        <div className="add-list-container">
          <button
            className="add-list-btn"
            onClick={() => {
              const name = prompt('Enter new list / goal name:')
              if (name) {
                alert(`New custom list "${name}" created!`)
              }
            }}
          >
            <Plus size={16} />
            <span>Add another list</span>
          </button>
        </div>
      </div>

      {/* 5. INTERACTIVE TRELLO CARD DETAIL MODAL */}
      {activeModalCard && (
        <div className="trello-modal-backdrop" onClick={() => setActiveModalCard(null)}>
          <div className="trello-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close-btn"
              onClick={() => setActiveModalCard(null)}
              title="Close"
            >
              <X size={20} />
            </button>

            {/* Modal Header */}
            <div className="modal-header">
              <input
                className="modal-title-input"
                value={activeModalCard.title}
                onChange={(e) =>
                  setActiveModalCard({ ...activeModalCard, title: e.target.value })
                }
              />
              <div className="modal-subtitle">
                in list <span>{activeModalCard.status.toUpperCase()}</span>
              </div>
            </div>

            {/* Modal Body */}
            <div className="modal-body">
              {/* Left Main Content */}
              <div className="modal-main-content">
                {/* Meta Grid (Members, Role, Labels, Due Date) */}
                <div className="modal-meta-grid">
                  {/* Role */}
                  <div className="meta-group">
                    <span className="meta-title">Assigned Role</span>
                    <div className="meta-value-chips">
                      <select
                        style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #ccc' }}
                        value={activeModalCard.assignedRole || ''}
                        onChange={(e) =>
                          setActiveModalCard({
                            ...activeModalCard,
                            assignedRole: e.target.value || undefined,
                          })
                        }
                      >
                        <option value="">No Role</option>
                        {DEFAULT_ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.emoji} {r.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Individual Assignee */}
                  <div className="meta-group">
                    <span className="meta-title">Assigned Individual</span>
                    <div className="meta-value-chips">
                      <select
                        style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #ccc' }}
                        value={
                          typeof activeModalCard.assignedEmployee === 'object'
                            ? activeModalCard.assignedEmployee?.id || ''
                            : activeModalCard.assignedEmployee || ''
                        }
                        onChange={(e) =>
                          setActiveModalCard({
                            ...activeModalCard,
                            assignedEmployee: e.target.value || undefined,
                          })
                        }
                      >
                        <option value="">Unassigned</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            👤 {emp.name} ({emp.team || 'Staff'})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Priority */}
                  <div className="meta-group">
                    <span className="meta-title">Priority</span>
                    <div className="meta-value-chips">
                      <select
                        style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #ccc' }}
                        value={activeModalCard.priority || 'medium'}
                        onChange={(e) =>
                          setActiveModalCard({
                            ...activeModalCard,
                            priority: e.target.value as any,
                          })
                        }
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>

                  {/* Due Date */}
                  <div className="meta-group">
                    <span className="meta-title">Due Date</span>
                    <div className="meta-value-chips">
                      <input
                        type="date"
                        style={{ padding: '3px 6px', borderRadius: '4px', border: '1px solid #ccc' }}
                        value={
                          activeModalCard.dueDate ? activeModalCard.dueDate.slice(0, 10) : ''
                        }
                        onChange={(e) =>
                          setActiveModalCard({
                            ...activeModalCard,
                            dueDate: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Labels Selector Chips */}
                <div className="modal-section">
                  <span className="section-label">
                    <Tag size={14} />
                    <span>Labels</span>
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {LABEL_PRESETS.map((preset) => {
                      const isSelected = activeModalCard.labels?.some((l) => l.text === preset.text)
                      return (
                        <button
                          key={preset.text}
                          type="button"
                          onClick={() => handleToggleLabelPreset(preset)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '4px',
                            border: isSelected ? '2px solid #000' : '1px solid transparent',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          className={`label-${preset.color}`}
                        >
                          {isSelected && <Check size={12} />}
                          <span>{preset.text}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Description Box */}
                <div className="modal-section">
                  <span className="section-label">
                    <AlignLeft size={14} />
                    <span>Description</span>
                  </span>
                  <textarea
                    className="description-box"
                    placeholder="Add a more detailed description..."
                    value={activeModalCard.description || ''}
                    onChange={(e) =>
                      setActiveModalCard({ ...activeModalCard, description: e.target.value })
                    }
                  />
                </div>

                {/* Checklist Section */}
                <div className="modal-section">
                  <span className="section-label">
                    <CheckSquare size={14} />
                    <span>Checklist</span>
                  </span>

                  {/* Progress Bar */}
                  {activeModalCard.checklist && activeModalCard.checklist.length > 0 && (
                    <div className="checklist-progress-bar">
                      {(() => {
                        const total = activeModalCard.checklist.length
                        const done = activeModalCard.checklist.filter((c) => c.completed).length
                        const pct = Math.round((done / total) * 100)
                        return (
                          <>
                            <span className="progress-pct">{pct}%</span>
                            <div className="bar-track">
                              <div className="bar-fill" style={{ width: `${pct}%` }} />
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  )}

                  {/* Items List */}
                  <div className="checklist-items">
                    {(activeModalCard.checklist || []).map((item, idx) => (
                      <div key={idx} className="checklist-row">
                        <input
                          type="checkbox"
                          checked={item.completed}
                          onChange={() => handleToggleChecklist(idx)}
                        />
                        <span className={`item-text ${item.completed ? 'completed' : ''}`}>
                          {item.text}
                        </span>
                        <button
                          className="item-delete-btn"
                          onClick={() => handleDeleteChecklistItem(idx)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add checklist item */}
                  <div className="add-checklist-item-form">
                    <input
                      type="text"
                      placeholder="Add an item..."
                      value={newChecklistText}
                      onChange={(e) => setNewChecklistText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddChecklistItem()
                        }
                      }}
                    />
                    <button type="button" onClick={handleAddChecklistItem}>
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Sidebar Actions */}
              <div className="modal-actions-sidebar">
                <div className="sidebar-section-title">Change Status</div>
                <div className="sidebar-select-field">
                  <select
                    value={activeModalCard.status}
                    onChange={(e) =>
                      setActiveModalCard({
                        ...activeModalCard,
                        status: e.target.value as any,
                      })
                    }
                  >
                    <option value="backlog">Goal 1: Grow Customers (Backlog)</option>
                    <option value="todo">Goal 2: Reduce Costs (To Do)</option>
                    <option value="in_progress">Goal Template (In Progress)</option>
                    <option value="review">Done (Q1 2019)</option>
                    <option value="done">Done (Q4 2018)</option>
                  </select>
                </div>

                <div className="sidebar-section-title">Actions</div>
                <div className="action-buttons-list">
                  <button
                    className="sidebar-btn btn-danger"
                    onClick={() => handleDeleteCard(activeModalCard.id)}
                  >
                    <Trash2 size={14} />
                    <span>Delete Card</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="modal-footer">
              <button
                className="btn-cancel"
                onClick={() => setActiveModalCard(null)}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                className="btn-save"
                onClick={handleSaveModalCard}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Card'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
