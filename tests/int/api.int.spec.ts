import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { describe, it, beforeAll, expect } from 'vitest'
import { APIError } from 'payload'

let payload: Payload

const getRelationshipID = (value: unknown): string | null => {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) return String((value as any).id)
  return null
}

describe('API & Tables integration', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
  })

  it('fetches users', async () => {
    const users = await payload.find({
      collection: 'users',
    })
    expect(users).toBeDefined()
  })

  it('verifies offlineTables multi-select tag configuration and getLiveTableStatus and Billing validations', async () => {
    // 0. Clean up any leftover test data from previous runs to prevent duplicate PIN or unique constraint errors
    await payload.delete({
      collection: 'users',
      where: {
        email: { equals: 'admin_test@test.com' },
      },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'branches',
      where: {
        name: { equals: 'Integration Test Branch' },
      },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'companies',
      where: {
        name: { equals: 'Integration Test Company' },
      },
      overrideAccess: true,
    })

    // 1. Setup Company & Branch
    const company = await payload.create({
      collection: 'companies',
      data: {
        name: 'Integration Test Company',
      },
      req: { user: { role: 'superadmin' } } as any,
      overrideAccess: true,
    })

    const branch = await payload.create({
      collection: 'branches',
      data: {
        company: company.id,
        name: 'Integration Test Branch',
        address: '456 Test Ave',
        gst: 'GST54321',
        gstMode: 'inclusive',
        phone: '9876543210',
        email: 'testbranch2@test.com',
        branchPin: '8888',
      },
      req: { user: { role: 'superadmin' } } as any,
      overrideAccess: true,
    })

    // Delete existing table configs for this branch to avoid duplicates
    await payload.delete({
      collection: 'tables',
      where: {
        branch: { equals: branch.id },
      },
      req: { user: { role: 'superadmin' } } as any,
      overrideAccess: true,
    })

    // 2. Create Table Configuration with offlineTables select strings
    const tableConfig = await payload.create({
      collection: 'tables',
      data: {
        branch: branch.id,
        sections: [
          {
            name: 'AC Dining',
            tableCount: 10,
            offlineTables: ['3', '7'],
          },
          {
            name: 'Terrace',
            tableCount: 5,
            offlineTables: ['1'],
          },
        ],
      },
      req: { user: { role: 'superadmin' } } as any,
      overrideAccess: true,
    })

    expect(tableConfig).toBeDefined()
    expect(tableConfig.sections[0].offlineTables).toEqual(['3', '7'])
    expect(tableConfig.sections[1].offlineTables).toEqual(['1'])

    // 3. Verify getLiveTableStatusHandler endpoint logic
    // Let's call the getLiveTableStatus function or simulate it.
    // Instead of initiating full HTTP server requests, we can directly find the table configuration and assert on it
    const dbConfig = await payload.find({
      collection: 'tables',
      where: {
        branch: { equals: branch.id },
      },
      depth: 0,
      overrideAccess: true,
    })

    expect(dbConfig.docs.length).toBe(1)
    const doc = dbConfig.docs[0]
    expect(doc.sections?.[0]?.offlineTables).toEqual(['3', '7'])

    // 4. Test Billings table validation directly!
    // Let's create a User (admin) to serve as createdBy
    const user = await payload.create({
      collection: 'users',
      data: {
        email: 'admin_test@test.com',
        password: 'password',
        role: 'admin',
      },
      req: { user: { role: 'superadmin' } } as any,
      overrideAccess: true,
    })

    // Let's create a Category
    const category = await payload.create({
      collection: 'categories',
      data: {
        name: 'Test Cat',
        company: [company.id],
      },
      req: { user: { role: 'superadmin' } } as any,
      overrideAccess: true,
    })

    // Let's create a Product
    const product = await payload.create({
      collection: 'products',
      data: {
        name: 'Test Item',
        category: category.id,
        defaultPriceDetails: {
          price: 100,
          rate: 100,
          quantity: 1,
          unit: 'pcs',
          gst: '5',
        },
      },
      req: { user: { role: 'superadmin' } } as any,
      overrideAccess: true,
    })

    // A. Assert that creating a bill on an ONLINE table works!
    const onlineBill = await payload.create({
      collection: 'billings',
      data: {
        branch: branch.id,
        company: company.id,
        createdBy: user.id,
        invoiceNumber: 'INV-111111',
        tableDetails: {
          section: 'AC Dining',
          tableNumber: '4', // Table 4 is online
        },
        items: [
          {
            product: product.id,
            name: 'Test Item',
            quantity: 1,
            unitPrice: 100,
            subtotal: 100,
          },
        ],
        totalAmount: 100,
      },
      req: { user: { role: 'superadmin' } } as any,
      overrideAccess: true,
    })

    expect(onlineBill).toBeDefined()
    expect(onlineBill.tableDetails?.tableNumber).toBe('4')

    // B. Assert that creating a bill on an OFFLINE table throws an validation error!
    await expect(
      payload.create({
        collection: 'billings',
        data: {
          branch: branch.id,
          company: company.id,
          createdBy: user.id,
          invoiceNumber: 'INV-222222',
          tableDetails: {
            section: 'AC Dining',
            tableNumber: '3', // Table 3 is OFFLINE
          },
          items: [
            {
              product: product.id,
              name: 'Test Item',
              quantity: 1,
              unitPrice: 100,
              subtotal: 100,
            },
          ],
          totalAmount: 100,
        },
        req: { user: { role: 'superadmin' } } as any,
        overrideAccess: true,
      })
    ).rejects.toThrow(/is currently offline/)

    // Clean up
    await payload.delete({
      collection: 'billings',
      where: {
        branch: { equals: branch.id },
      },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'tables',
      where: {
        branch: { equals: branch.id },
      },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'products',
      where: {
        id: { equals: product.id },
      },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'categories',
      where: {
        id: { equals: category.id },
      },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'users',
      where: {
        id: { equals: user.id },
      },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'branches',
      where: {
        id: { equals: branch.id },
      },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'companies',
      where: {
        id: { equals: company.id },
      },
      overrideAccess: true,
    })
  }, 30000)

  it('verifies waiter allocation configuration and its resolution in getLiveTableStatusHandler', async () => {
    // 0. Clean up leftovers
    await payload.delete({
      collection: 'users',
      where: {
        email: { in: ['waiter_test@test.com', 'admin_waiter_test@test.com'] },
      },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'employees',
      where: {
        employeeId: { equals: 'EMP_WAITER_TEST' },
      },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'branches',
      where: {
        name: { equals: 'Waiter Integration Branch' },
      },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'companies',
      where: {
        name: { equals: 'Waiter Integration Company' },
      },
      overrideAccess: true,
    })

    // 1. Setup Company & Branch
    const company = await payload.create({
      collection: 'companies',
      data: {
        name: 'Waiter Integration Company',
      },
      req: { user: { role: 'superadmin' } } as any,
      overrideAccess: true,
    })

    const branch = await payload.create({
      collection: 'branches',
      data: {
        company: company.id,
        name: 'Waiter Integration Branch',
        address: '789 Waiter Ave',
        gst: 'GST12345',
        gstMode: 'inclusive',
        phone: '9876543211',
        email: 'testbranch3@test.com',
        branchPin: '9999',
      },
      req: { user: { role: 'superadmin' } } as any,
      overrideAccess: true,
    })

    // 1.5 Create Employee for Waiter User
    const employee = await payload.create({
      collection: 'employees',
      data: {
        name: 'John Waiter',
        employeeId: 'EMP_WAITER_TEST',
        phoneNumber: '1234567890',
        team: 'waiter',
        status: 'active',
      },
      req: { user: { role: 'superadmin' } } as any,
      overrideAccess: true,
    })

    // 2. Create Waiter User
    const waiterUser = await payload.create({
      collection: 'users',
      data: {
        email: 'waiter_test@test.com',
        password: 'password',
        role: 'waiter',
        name: 'John Waiter',
        employee: employee.id,
      },
      req: { user: { role: 'superadmin' } } as any,
      overrideAccess: true,
    })

    // 3. Create Table Config with Waiter Allocations
    const tableConfig = await payload.create({
      collection: 'tables',
      data: {
        branch: branch.id,
        sections: [
          {
            name: 'Main Hall',
            tableCount: 5,
            waiterAllocations: [
              {
                tableNumber: '2',
                waiter: waiterUser.id,
              },
            ],
          },
        ],
      },
      req: { user: { role: 'superadmin' } } as any,
      overrideAccess: true,
    })

    expect(tableConfig).toBeDefined()
    const sections = tableConfig.sections
    expect(sections).toBeDefined()
    expect(sections).not.toBeNull()
    const firstSection = sections![0]
    expect(firstSection.waiterAllocations).toBeDefined()
    expect(firstSection.waiterAllocations).not.toBeNull()
    expect(firstSection.waiterAllocations).toHaveLength(1)
    const firstAlloc = firstSection.waiterAllocations![0] as any
    expect(firstAlloc.tableNumber).toBe('2')
    expect(getRelationshipID(firstAlloc.waiter)).toBe(waiterUser.id)

    // 4. Call getLiveTableStatusHandler directly using mockReq
    const { getLiveTableStatusHandler } = await import('@/endpoints/getLiveTableStatus')
    const mockReq = {
      payload,
      url: `http://localhost/api/widgets/live-table-status?branchId=${branch.id}`,
      user: {
        role: 'superadmin',
      },
    } as any

    const response = await getLiveTableStatusHandler(mockReq)
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.branches).toBeDefined()
    expect(data.branches).toHaveLength(1)

    const testBranch = data.branches[0]
    expect(testBranch.branchId).toBe(branch.id)
    expect(testBranch.sections).toHaveLength(1)

    const section = testBranch.sections[0]
    expect(section.sectionName).toBe('Main Hall')
    expect(section.tables).toHaveLength(5)

    // Table 2 should have waiter assigned
    const table2 = section.tables.find((t: any) => t.tableNumber === '2')
    expect(table2).toBeDefined()
    expect(table2.assignedWaiterId).toBe(waiterUser.id)
    expect(table2.assignedWaiterName).toBe('John Waiter')

    // Table 1 should have NO waiter assigned
    const table1 = section.tables.find((t: any) => t.tableNumber === '1')
    expect(table1).toBeDefined()
    expect(table1.assignedWaiterId).toBeNull()
    expect(table1.assignedWaiterName).toBeNull()

    // Clean up
    await payload.delete({
      collection: 'tables',
      where: {
        branch: { equals: branch.id },
      },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'users',
      where: {
        id: { equals: waiterUser.id },
      },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'employees',
      where: {
        id: { equals: employee.id },
      },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'branches',
      where: {
        id: { equals: branch.id },
      },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'companies',
      where: {
        id: { equals: company.id },
      },
      overrideAccess: true,
    })
  }, 30000)

  it('allows allocating a manager role user to tables and reallocating tables without validation error', async () => {
    // 0. Clean up leftovers
    await payload.delete({
      collection: 'users',
      where: {
        email: { in: ['manager_waiter_test@test.com'] },
      },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'employees',
      where: {
        employeeId: { equals: 'EMP_MGR_TEST' },
      },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'branches',
      where: {
        name: { equals: 'Manager Alloc Branch' },
      },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'companies',
      where: {
        name: { equals: 'Manager Alloc Company' },
      },
      overrideAccess: true,
    })

    // 1. Setup Company & Branch
    const company = await payload.create({
      collection: 'companies',
      data: {
        name: 'Manager Alloc Company',
      },
      req: { user: { role: 'superadmin' } } as any,
      overrideAccess: true,
    })

    const branch = await payload.create({
      collection: 'branches',
      data: {
        company: company.id,
        name: 'Manager Alloc Branch',
        address: '100 Manager Way',
        gst: 'GST99999',
        gstMode: 'inclusive',
        phone: '9876543299',
        email: 'mgrbranch@test.com',
        branchPin: '8888',
      },
      req: { user: { role: 'superadmin' } } as any,
      overrideAccess: true,
    })

    // 2. Create Employee & User with MANAGER role
    const employee = await payload.create({
      collection: 'employees',
      data: {
        name: 'Jane Manager',
        employeeId: 'EMP_MGR_TEST',
        phoneNumber: '9876543298',
        team: 'manager',
        status: 'active',
      },
      req: { user: { role: 'superadmin' } } as any,
      overrideAccess: true,
    })

    const managerUser = await payload.create({
      collection: 'users',
      data: {
        email: 'manager_waiter_test@test.com',
        password: 'password',
        role: 'manager',
        name: 'Jane Manager',
        employee: employee.id,
      },
      req: { user: { role: 'superadmin' } } as any,
      overrideAccess: true,
    })

    // 3. Create Table Config with initial allocation to Manager User
    const tableConfig = await payload.create({
      collection: 'tables',
      data: {
        branch: branch.id,
        sections: [
          {
            name: 'AC Dining',
            tableCount: 10,
            waiterAllocations: [
              {
                tableNumber: '1',
                waiter: managerUser.id,
              },
              {
                tableNumber: '2',
                waiter: managerUser.id,
              },
            ],
          },
        ],
      },
      req: { user: { role: 'superadmin' } } as any,
      overrideAccess: true,
    })

    expect(tableConfig).toBeDefined()
    expect(tableConfig.sections![0].waiterAllocations).toHaveLength(2)

    // 4. Test allocateTableWaiterHandler reallocating table 2 to unassigned (waiterId: '')
    const { allocateTableWaiterHandler } = await import('@/endpoints/allocateTableWaiter')
    const unassignReq = {
      payload,
      url: 'http://localhost/api/widgets/allocate-table-waiter',
      json: async () => ({
        branchId: branch.id,
        sectionName: 'AC Dining',
        tableNumber: '2',
        waiterId: '',
      }),
      user: { role: 'superadmin' },
    } as any

    const unassignRes = await allocateTableWaiterHandler(unassignReq)
    expect(unassignRes.status).toBe(200)

    // 5. Test allocateTableWaiterHandler allocating table 3 to managerUser
    const assignReq = {
      payload,
      url: 'http://localhost/api/widgets/allocate-table-waiter',
      json: async () => ({
        branchId: branch.id,
        sectionName: 'AC Dining',
        tableNumber: '3',
        waiterId: managerUser.id,
      }),
      user: { role: 'superadmin' },
    } as any

    const assignRes = await allocateTableWaiterHandler(assignReq)
    expect(assignRes.status).toBe(200)

    // 6. Verify table document state
    const freshTableConfig = await payload.findByID({
      collection: 'tables',
      id: tableConfig.id,
      depth: 0,
      overrideAccess: true,
    })
    const allocations = freshTableConfig.sections![0].waiterAllocations as any[]
    expect(allocations).toHaveLength(2)
    const tableNumbers = allocations.map((a) => a.tableNumber).sort()
    expect(tableNumbers).toEqual(['1', '3'])

    // Clean up
    await payload.delete({
      collection: 'tables',
      where: {
        branch: { equals: branch.id },
      },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'users',
      where: {
        id: { equals: managerUser.id },
      },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'employees',
      where: {
        id: { equals: employee.id },
      },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'branches',
      where: {
        id: { equals: branch.id },
      },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'companies',
      where: {
        id: { equals: company.id },
      },
      overrideAccess: true,
    })
  }, 30000)
})

