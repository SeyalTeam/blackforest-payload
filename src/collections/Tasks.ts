import type { CollectionConfig } from 'payload'

export const ROLE_OPTIONS = [
  { label: 'Superadmin', value: 'superadmin' },
  { label: 'Admin', value: 'admin' },
  { label: 'Manager', value: 'manager' },
  { label: 'Account', value: 'account' },
  { label: 'Delivery', value: 'delivery' },
  { label: 'Branch', value: 'branch' },
  { label: 'Company', value: 'company' },
  { label: 'Factory', value: 'factory' },
  { label: 'Kitchen', value: 'kitchen' },
  { label: 'Chef', value: 'chef' },
  { label: 'Cashier', value: 'cashier' },
  { label: 'Waiter', value: 'waiter' },
  { label: 'Supervisor', value: 'supervisor' },
  { label: 'Driver', value: 'driver' },
  { label: 'Store Keeper', value: 'store_keeper' },
]

export const Tasks: CollectionConfig = {
  slug: 'tasks',
  admin: {
    useAsTitle: 'title',
    group: 'Work',
    defaultColumns: ['title', 'status', 'assignedRole', 'priority', 'dueDate', 'createdAt'],
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => user?.role === 'superadmin' || user?.role === 'admin',
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => user?.role === 'superadmin' || user?.role === 'admin',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Task Title',
    },
    {
      name: 'column',
      type: 'relationship',
      relationTo: 'task-columns' as any,
      label: 'Column / List',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Description / Notes',
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'todo',
      options: [
        { label: 'Backlog', value: 'backlog' },
        { label: 'To Do', value: 'todo' },
        { label: 'In Progress', value: 'in_progress' },
        { label: 'Review / At Risk', value: 'review' },
        { label: 'Done', value: 'done' },
      ],
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'priority',
      type: 'select',
      defaultValue: 'medium',
      options: [
        { label: 'Low', value: 'low' },
        { label: 'Medium', value: 'medium' },
        { label: 'High', value: 'high' },
        { label: 'Urgent', value: 'urgent' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'assignmentType',
      type: 'select',
      defaultValue: 'role',
      options: [
        { label: 'By Role', value: 'role' },
        { label: 'By Individual', value: 'individual' },
        { label: 'Both (Role & Individual)', value: 'both' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'assignedRole',
      type: 'select',
      label: 'Assigned Role',
      options: ROLE_OPTIONS,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'assignedEmployee',
      type: 'relationship',
      relationTo: 'employees',
      label: 'Assigned Employee (Individual)',
      hasMany: false,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'assignedUser',
      type: 'relationship',
      relationTo: 'users',
      label: 'Assigned User Account',
      hasMany: false,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'dueDate',
      type: 'date',
      label: 'Due Date',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
      label: 'Branch (Optional)',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'order',
      type: 'number',
      label: 'Column Order',
      defaultValue: 0,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'labels',
      type: 'array',
      label: 'Card Labels',
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'text',
              type: 'text',
              required: true,
              label: 'Label Text',
              admin: { width: '60%' },
            },
            {
              name: 'color',
              type: 'select',
              label: 'Color',
              defaultValue: 'green',
              options: [
                { label: 'Green (Achieved)', value: 'green' },
                { label: 'Yellow (Up Next)', value: 'yellow' },
                { label: 'Orange (At Risk)', value: 'orange' },
                { label: 'Red (Missed)', value: 'red' },
                { label: 'Purple (In Progress)', value: 'purple' },
                { label: 'Blue (On Track)', value: 'blue' },
                { label: 'Cyan (Trello Tips)', value: 'cyan' },
                { label: 'Pink (Planning)', value: 'pink' },
              ],
              admin: { width: '40%' },
            },
          ],
        },
      ],
    },
    {
      name: 'checklist',
      type: 'array',
      label: 'Checklist / Subtasks',
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'text',
              type: 'text',
              required: true,
              admin: { width: '80%' },
            },
            {
              name: 'completed',
              type: 'checkbox',
              defaultValue: false,
              admin: { width: '20%' },
            },
          ],
        },
      ],
    },
  ],
  timestamps: true,
}

export default Tasks
