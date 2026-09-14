'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Star,
  Users,
  Globe,
  Plus,
  MoreHorizontal,
  X,
  Clock,
  Paperclip,
  AlignLeft,
  CheckSquare,
  Zap,
  Search,
  Check,
  Trash2,
  Tag,
  RefreshCw,
  Edit2,
  Columns,
  ShieldAlert,
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

export type TaskColumn = {
  id: string
  title: string
  order?: number
  role?: string
  color?: string
}

export type TaskItem = {
  id: string
  title: string
  description?: string
  column?: any // string ID or TaskColumn object
  status?: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done'
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

type WorkTasksBoardProps = {
  isStandalone?: boolean
}

export default function WorkTasksBoard({ isStandalone = false }: WorkTasksBoardProps) {
  const [currentUser, setCurrentUser] = useState<UserOption | null>(null)
  const [columnsData, setColumnsData] = useState<TaskColumn[]>([])
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [loading, setLoading] = useState(true)
  const [isStarred, setIsStarred] = useState(false)

  // View switch mode: 'board' (Custom lists created by superadmin) | 'role' | 'individual'
  const [viewMode, setViewMode] = useState<'board' | 'role' | 'individual'>('board')

  // Search and filter controls
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [individualFilter, setIndividualFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')

  // Superadmin new list inline form state
  const [isAddingList, setIsAddingList] = useState(false)
  const [newColumnTitle, setNewColumnTitle] = useState('')

  // Column options menu popover state
  const [activeColumnMenu, setActiveColumnMenu] = useState<string | null>(null)

  // Inline Card Quick Add composer state: columnId or null
  const [inlineAddingCol, setInlineAddingCol] = useState<string | null>(null)
  const [inlineTitle, setInlineTitle] = useState('')

  // Active modal card state for detail view
  const [activeModalCard, setActiveModalCard] = useState<TaskItem | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // New checklist item input inside modal
  const [newChecklistText, setNewChecklistText] = useState('')

  // Determine if logged-in user is Superadmin or Admin
  const isSuperAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'admin'

  // Fetch initial user, columns, tasks, employees
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [meRes, colsRes, tasksRes, employeesRes, usersRes] = await Promise.all([
        fetch('/api/users/me').catch(() => null),
        fetch('/api/task-columns?limit=100&sort=order').catch(() => null),
        fetch('/api/tasks?limit=500&depth=2').catch(() => null),
        fetch('/api/employees?limit=300&depth=1').catch(() => null),
        fetch('/api/users?limit=300&depth=1').catch(() => null),
      ])

      if (meRes && meRes.ok) {
        const meJson = await meRes.json()
        if (meJson?.user) {
          setCurrentUser(meJson.user)
        }
      }

      if (colsRes && colsRes.ok) {
        const colsJson = await colsRes.json()
        setColumnsData(colsJson.docs || [])
      }

      if (employeesRes && employeesRes.ok) {
        const empJson = await employeesRes.json()
        setEmployees(empJson.docs || [])
      }

      if (usersRes && usersRes.ok) {
        const userJson = await usersRes.json()
        setUsers(userJson.docs || [])
      }

      if (tasksRes && tasksRes.ok) {
        const tasksJson = await tasksRes.json()
        // DO NOT AUTOMATICALLY SEED! Load only tasks created by superadmin
        setTasks(tasksJson.docs || [])
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

  // Helper to extract column ID from task
  const getTaskColumnId = (task: TaskItem): string | null => {
    if (!task.column) return null
    if (typeof task.column === 'object') return task.column.id || null
    return String(task.column)
  }

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
    if (viewMode === 'board') {
      // Dynamic lists created by Superadmin
      const cols = columnsData.map((col) => ({
        id: col.id,
        title: col.title,
        isCustom: true,
        tasks: filteredTasks.filter((t) => getTaskColumnId(t) === col.id),
      }))

      // If there are tasks without a column, show an Uncategorized column
      const unassignedTasks = filteredTasks.filter((t) => !getTaskColumnId(t))
      if (unassignedTasks.length > 0 && cols.length > 0) {
        cols.push({
          id: 'unassigned-col',
          title: '📋 Uncategorized Tasks',
          isCustom: false,
          tasks: unassignedTasks,
        })
      }
      return cols
    }

    if (viewMode === 'role') {
      const roleCols = DEFAULT_ROLES.map((r) => ({
        id: r.value,
        title: `${r.emoji} ${r.label}`,
        isCustom: false,
        tasks: filteredTasks.filter((t) => t.assignedRole === r.value),
      }))
      const unassignedTasks = filteredTasks.filter((t) => !t.assignedRole)
      if (unassignedTasks.length > 0) {
        roleCols.push({
          id: 'unassigned-role',
          title: '⚪ General / Unassigned Role',
          isCustom: false,
          tasks: unassignedTasks,
        })
      }
      return roleCols
    }

    if (viewMode === 'individual') {
      const indCols = employees.map((emp) => {
        const empTasks = filteredTasks.filter((t) => {
          const id = typeof t.assignedEmployee === 'object' ? t.assignedEmployee?.id : t.assignedEmployee
          return id === emp.id
        })
        return {
          id: emp.id,
          title: `👤 ${emp.name} (${emp.team || 'Staff'})`,
          isCustom: false,
          tasks: empTasks,
        }
      })

      const unassignedInd = filteredTasks.filter((t) => !t.assignedEmployee && !t.assignedUser)
      if (unassignedInd.length > 0 || indCols.length === 0) {
        indCols.unshift({
          id: 'unassigned-ind',
          title: '📋 Unassigned Members',
          isCustom: false,
          tasks: unassignedInd,
        })
      }

      return indCols
    }

    return []
  }, [viewMode, columnsData, filteredTasks, employees])

  // Superadmin: Add New Column List
  const handleAddColumn = async () => {
    if (!newColumnTitle.trim()) return
    if (!isSuperAdmin) {
      alert('Only Superadmin can create columns.')
      return
    }

    try {
      const res = await fetch('/api/task-columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newColumnTitle.trim(),
          order: columnsData.length,
        }),
      })

      if (res.ok) {
        const json = await res.json()
        setColumnsData((prev) => [...prev, json.doc])
        setNewColumnTitle('')
        setIsAddingList(false)
      } else {
        alert('Failed to create list. Ensure you are logged in as Superadmin.')
      }
    } catch (err) {
      console.error('Error creating column:', err)
    }
  }

  // Superadmin: Rename Column List
  const handleRenameColumn = async (colId: string) => {
    if (!isSuperAdmin) {
      alert('Only Superadmin can rename columns.')
      return
    }
    const current = columnsData.find((c) => c.id === colId)
    const newTitle = prompt('Enter new title for this list:', current?.title || '')
    if (!newTitle || !newTitle.trim() || newTitle === current?.title) return

    try {
      const res = await fetch(`/api/task-columns/${colId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      })

      if (res.ok) {
        const json = await res.json()
        setColumnsData((prev) => prev.map((c) => (c.id === colId ? json.doc : c)))
      }
    } catch (err) {
      console.error('Error renaming column:', err)
    } finally {
      setActiveColumnMenu(null)
    }
  }

  // Superadmin: Delete Column List
  const handleDeleteColumn = async (colId: string) => {
    if (!isSuperAdmin) {
      alert('Only Superadmin can delete columns.')
      return
    }
    if (!confirm('Are you sure you want to delete this list?')) return

    try {
      const res = await fetch(`/api/task-columns/${colId}`, { method: 'DELETE' })
      if (res.ok) {
        setColumnsData((prev) => prev.filter((c) => c.id !== colId))
      }
    } catch (err) {
      console.error('Error deleting column:', err)
    } finally {
      setActiveColumnMenu(null)
    }
  }

  // Superadmin: Quick Add Card
  const handleQuickAddCard = async (columnId: string) => {
    if (!inlineTitle.trim()) return
    if (!isSuperAdmin) {
      alert('Only Superadmin can create tasks.')
      return
    }

    let targetColId: string | undefined = undefined
    let assignedRoleVal: string | undefined = undefined
    let assignedEmpVal: string | undefined = undefined

    if (viewMode === 'board') {
      if (columnId !== 'unassigned-col') {
        targetColId = columnId
      }
    } else if (viewMode === 'role') {
      if (columnId !== 'unassigned-role') {
        assignedRoleVal = columnId
      }
      // Pick first column if available
      if (columnsData.length > 0) {
        targetColId = columnsData[0].id
      }
    } else if (viewMode === 'individual') {
      if (columnId !== 'unassigned-ind') {
        assignedEmpVal = columnId
      }
      if (columnsData.length > 0) {
        targetColId = columnsData[0].id
      }
    }

    const newTaskData: Partial<TaskItem> = {
      title: inlineTitle.trim(),
      column: targetColId,
      status: 'todo',
      assignedRole: assignedRoleVal,
      assignedEmployee: assignedEmpVal,
      priority: 'medium',
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
        alert('Failed to create task. Ensure you have Superadmin privileges.')
      }
    } catch (err) {
      console.error('Error creating task:', err)
    }

    setInlineTitle('')
    setInlineAddingCol(null)
  }

  // Superadmin: Save Modal Card Edits
  const handleSaveModalCard = async () => {
    if (!activeModalCard) return
    setIsSaving(true)
    try {
      const { id, ...dataToSave } = activeModalCard

      // Normalize column reference to string ID
      if (typeof dataToSave.column === 'object' && dataToSave.column !== null) {
        dataToSave.column = dataToSave.column.id
      }
      if (typeof dataToSave.assignedEmployee === 'object' && dataToSave.assignedEmployee !== null) {
        dataToSave.assignedEmployee = dataToSave.assignedEmployee.id
      }
      if (typeof dataToSave.assignedUser === 'object' && dataToSave.assignedUser !== null) {
        dataToSave.assignedUser = dataToSave.assignedUser.id
      }

      if (id.startsWith('new-')) {
        // Create new card from modal
        if (!isSuperAdmin) {
          alert('Only Superadmin can create tasks.')
          setIsSaving(false)
          return
        }
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataToSave),
        })
        if (res.ok) {
          const json = await res.json()
          setTasks((prev) => [json.doc, ...prev])
        }
      } else {
        // Update existing card
        const res = await fetch(`/api/tasks/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataToSave),
        })

        if (res.ok) {
          const json = await res.json()
          setTasks((prev) => prev.map((t) => (t.id === id ? json.doc : t)))
        }
      }
      setActiveModalCard(null)
    } catch (err) {
      console.error('Error saving task:', err)
    } finally {
      setIsSaving(false)
    }
  }

  // Superadmin: Delete Card
  const handleDeleteCard = async (taskId: string) => {
    if (!isSuperAdmin) {
      alert('Only Superadmin can delete tasks.')
      return
    }
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
          {isSuperAdmin && (
            <button
              className="topbar-btn"
              onClick={() => {
                if (activeModalCard) return
                const defaultCol = columnsData[0]?.id
                const newCard: TaskItem = {
                  id: `new-${Date.now()}`,
                  title: 'New Work Task',
                  column: defaultCol,
                  status: 'todo',
                  priority: 'medium',
                  assignmentType: 'role',
                  assignedRole: 'kitchen',
                  labels: [],
                }
                setActiveModalCard(newCard)
              }}
            >
              <Plus size={15} />
              <span>Create Task</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. BOARD HEADER (Title, Stars, Team pill, Public pill, Avatars, Butler, Menu) */}
      <div className="trello-board-header">
        <div className="board-header-left">
          <h1 className="board-title-text">Work Task Board</h1>

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
            <span>Workspace</span>
          </div>

          <div className="header-divider" />

          {/* Member Avatar Stack */}
          <div className="avatar-stack">
            {employees.slice(0, 4).map((emp, i) => (
              <div key={emp.id || i} className="avatar-circle" title={emp.name}>
                {emp.name.slice(0, 2).toUpperCase()}
              </div>
            ))}
            {employees.length > 4 && (
              <div className="avatar-circle avatar-count" title="More team members">
                +{employees.length - 4}
              </div>
            )}
          </div>
        </div>

        <div className="board-header-right">
          {currentUser && (
            <div className="header-pill" title={`Logged in as ${currentUser.role || 'user'}`}>
              <Users size={14} />
              <span>
                {currentUser.name || currentUser.email} ({currentUser.role || 'user'})
              </span>
            </div>
          )}

          <button className="header-pill" onClick={() => alert('Butler automations: All rules are active!')}>
            <Zap size={14} />
            <span>Butler</span>
          </button>

          <button
            className="header-pill"
            onClick={() =>
              alert(
                'Trello Work Module:\n- Only Superadmin can create/edit columns and create/delete tasks.\n- View tasks by Custom Lists, by Role, or by Individual.',
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
        {/* View Switchers: Board Lists | By Role | By Individual */}
        <div className="view-switchers">
          <button
            className={`view-tab ${viewMode === 'board' ? 'active' : ''}`}
            onClick={() => setViewMode('board')}
          >
            <Columns size={13} />
            <span>Board Lists ({columnsData.length})</span>
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
      <div className="trello-board-canvas" onClick={() => setActiveColumnMenu(null)}>
        {/* EMPTY STATE: When Superadmin has not created any columns yet */}
        {viewMode === 'board' && columnsData.length === 0 && (
          <div className="empty-board-banner">
            <div className="banner-icon">
              <Columns size={28} />
            </div>
            <h3>No Lists Created Yet</h3>
            {isSuperAdmin ? (
              <>
                <p>
                  As Superadmin, you have full control over the board. Create your first column list to get started.
                </p>
                <button onClick={() => setIsAddingList(true)}>
                  <Plus size={16} />
                  <span>Add First List</span>
                </button>
              </>
            ) : (
              <p>
                No task lists have been configured for this board. Please contact a Superadmin to create columns.
              </p>
            )}
          </div>
        )}

        {/* COLUMNS */}
        {columns.map((col) => {
          const isAddingCard = inlineAddingCol === col.id
          const isMenuOpen = activeColumnMenu === col.id

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

                {/* Superadmin Menu for Custom Columns */}
                {viewMode === 'board' && col.isCustom && isSuperAdmin && (
                  <div
                    className="column-menu-wrapper"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="list-menu-btn"
                      onClick={() => setActiveColumnMenu(isMenuOpen ? null : col.id)}
                      title="List actions"
                    >
                      <MoreHorizontal size={15} />
                    </button>

                    {isMenuOpen && (
                      <div className="column-menu-popover">
                        <div className="popover-header">
                          <span>List Actions</span>
                          <button onClick={() => setActiveColumnMenu(null)}>
                            <X size={14} />
                          </button>
                        </div>
                        <button
                          className="popover-item"
                          onClick={() => handleRenameColumn(col.id)}
                        >
                          <Edit2 size={13} />
                          <span>Rename List</span>
                        </button>
                        <button
                          className="popover-item danger"
                          onClick={() => handleDeleteColumn(col.id)}
                        >
                          <Trash2 size={13} />
                          <span>Delete List</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
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
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Inline Quick Add Composer (Superadmin Only) */}
                {isAddingCard && isSuperAdmin && (
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

              {/* Column Footer: Only Superadmin can add cards */}
              {!isAddingCard && isSuperAdmin && (
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

        {/* Superadmin: Add Another List button & form */}
        {viewMode === 'board' && isSuperAdmin && (
          <div className="add-list-container">
            {isAddingList ? (
              <div className="inline-add-list-form">
                <input
                  autoFocus
                  placeholder="Enter list title..."
                  value={newColumnTitle}
                  onChange={(e) => setNewColumnTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddColumn()
                    } else if (e.key === 'Escape') {
                      setIsAddingList(false)
                    }
                  }}
                />
                <div className="form-actions">
                  <button className="btn-primary" onClick={handleAddColumn}>
                    Add list
                  </button>
                  <button
                    className="btn-cancel"
                    onClick={() => {
                      setIsAddingList(false)
                      setNewColumnTitle('')
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            ) : (
              <button className="add-list-btn" onClick={() => setIsAddingList(true)}>
                <Plus size={16} />
                <span>Add another list</span>
              </button>
            )}
          </div>
        )}
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
                disabled={!isSuperAdmin}
                onChange={(e) =>
                  setActiveModalCard({ ...activeModalCard, title: e.target.value })
                }
              />
              <div className="modal-subtitle">
                in list{' '}
                <span>
                  {(() => {
                    const colId = getTaskColumnId(activeModalCard)
                    const found = columnsData.find((c) => c.id === colId)
                    return found?.title || 'Uncategorized'
                  })()}
                </span>
              </div>
            </div>

            {/* Modal Body */}
            <div className="modal-body">
              {/* Left Main Content */}
              <div className="modal-main-content">
                {/* Meta Grid (Column, Members, Role, Due Date) */}
                <div className="modal-meta-grid">
                  {/* Column List Selector */}
                  <div className="meta-group">
                    <span className="meta-title">List / Column</span>
                    <div className="meta-value-chips">
                      <select
                        style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #ccc' }}
                        value={getTaskColumnId(activeModalCard) || ''}
                        disabled={!isSuperAdmin}
                        onChange={(e) =>
                          setActiveModalCard({
                            ...activeModalCard,
                            column: e.target.value || undefined,
                          })
                        }
                      >
                        <option value="">None / Uncategorized</option>
                        {columnsData.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Role */}
                  <div className="meta-group">
                    <span className="meta-title">Assigned Role</span>
                    <div className="meta-value-chips">
                      <select
                        style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #ccc' }}
                        value={activeModalCard.assignedRole || ''}
                        disabled={!isSuperAdmin}
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
                        disabled={!isSuperAdmin}
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
                        disabled={!isSuperAdmin}
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
                        disabled={!isSuperAdmin}
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
                          disabled={!isSuperAdmin}
                          onClick={() => handleToggleLabelPreset(preset)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '4px',
                            border: isSelected ? '2px solid #000' : '1px solid transparent',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: '12px',
                            cursor: isSuperAdmin ? 'pointer' : 'default',
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
                    disabled={!isSuperAdmin}
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
                        {isSuperAdmin && (
                          <button
                            className="item-delete-btn"
                            onClick={() => handleDeleteChecklistItem(idx)}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add checklist item */}
                  {isSuperAdmin && (
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
                  )}
                </div>
              </div>

              {/* Right Sidebar Actions */}
              <div className="modal-actions-sidebar">
                <div className="sidebar-section-title">Change List</div>
                <div className="sidebar-select-field">
                  <select
                    value={getTaskColumnId(activeModalCard) || ''}
                    disabled={!isSuperAdmin}
                    onChange={(e) =>
                      setActiveModalCard({
                        ...activeModalCard,
                        column: e.target.value || undefined,
                      })
                    }
                  >
                    <option value="">Uncategorized</option>
                    {columnsData.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                {isSuperAdmin && (
                  <>
                    <div className="sidebar-section-title">Superadmin Actions</div>
                    <div className="action-buttons-list">
                      <button
                        className="sidebar-btn btn-danger"
                        onClick={() => handleDeleteCard(activeModalCard.id)}
                      >
                        <Trash2 size={14} />
                        <span>Delete Card</span>
                      </button>
                    </div>
                  </>
                )}
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
