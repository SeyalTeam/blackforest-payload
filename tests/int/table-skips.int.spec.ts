import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { describe, it, beforeAll, expect } from 'vitest'
import { updateItemStatus } from '@/endpoints/updateItemStatus'

let payload: Payload

describe('Table Order Workflow skips integration', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
  })

  it('automatically skips supervisor and waiter steps when settings are enabled', async () => {
    const adminReq = { req: { user: { role: 'superadmin' } } as any, overrideAccess: true }

    // 0. Clean up any leftover test data
    await payload.delete({
      collection: 'users',
      where: { email: { equals: 'chef_skips_test@test.com' } },
      ...adminReq,
    })
    await payload.delete({
      collection: 'employees',
      where: { employeeId: { equals: 'EMP_CHEF_SKIPS_TEST' } },
      ...adminReq,
    })
    await payload.delete({
      collection: 'branches',
      where: {
        or: [
          { name: { equals: 'Skips Test Branch' } },
          { branchPin: { equals: '4921' } }
        ]
      },
      ...adminReq,
    })
    await payload.delete({
      collection: 'companies',
      where: { name: { equals: 'Skips Test Company' } },
      ...adminReq,
    })

    // 1. Setup Company & Branch with skip settings enabled
    const company = await payload.create({
      collection: 'companies',
      data: { name: 'Skips Test Company' },
      ...adminReq,
    })

    const branch = await payload.create({
      collection: 'branches',
      data: {
        company: company.id,
        name: 'Skips Test Branch',
        address: '123 Skip St',
        gst: 'GSTSKIP123',
        gstMode: 'inclusive',
        phone: '1112223333',
        email: 'skipbranch@test.com',
        branchPin: '4921',
        tableOrderWorkflow: {
          skipSupervisor: true,
          skipWaiter: true,
        },
      },
      ...adminReq,
    })

    // 1.5 Create Employee for Chef User
    const employee = await payload.create({
      collection: 'employees',
      data: {
        name: 'Test Chef',
        employeeId: 'EMP_CHEF_SKIPS_TEST',
        phoneNumber: '1112224444',
        team: 'chef',
        status: 'active',
      },
      ...adminReq,
    })

    // 2. Setup user/chef
    const chefUser = await payload.create({
      collection: 'users',
      data: {
        email: 'chef_skips_test@test.com',
        password: 'password',
        role: 'chef',
        name: 'Test Chef',
        branch: branch.id,
        employee: employee.id,
      },
      ...adminReq,
    })

    // 3. Setup Category & Product
    const category = await payload.create({
      collection: 'categories',
      data: {
        name: 'Skips Cat',
        company: [company.id],
      },
      ...adminReq,
    })

    const product = await payload.create({
      collection: 'products',
      data: {
        name: 'Skips Item',
        category: category.id,
        defaultPriceDetails: {
          price: 150,
          rate: 150,
          quantity: 1,
          unit: 'pcs',
          gst: '5',
        },
      },
      ...adminReq,
    })

    // 4. Create Billing
    const bill = await payload.create({
      collection: 'billings',
      data: {
        branch: branch.id,
        company: company.id,
        createdBy: chefUser.id,
        invoiceNumber: 'INV-SKIPS-1',
        tableDetails: {
          section: 'Main',
          tableNumber: '1',
        },
        items: [
          {
            product: product.id,
            name: 'Skips Item',
            quantity: 2,
            unitPrice: 150,
            subtotal: 300,
            status: 'ordered',
          },
        ],
        totalAmount: 300,
      },
      ...adminReq,
    })

    const item = bill.items?.[0]
    expect(item).toBeDefined()
    const itemId = (item as any).id
    expect(itemId).toBeDefined()

    // 5. Call updateItemStatus with 'prepared' status representing the Chef finishing preparation
    const mockReq = {
      payload,
      routeParams: { id: bill.id },
      user: chefUser,
      json: async () => ({
        itemId: itemId,
        status: 'prepared',
        actorUserId: chefUser.id,
      }),
    } as any

    const response = await updateItemStatus(mockReq)
    expect(response.status).toBe(200)

    const updatedBill = await response.json()
    expect(updatedBill.items).toBeDefined()
    expect(updatedBill.items).toHaveLength(1)

    const updatedItem = updatedBill.items[0]
    // Since skipSupervisor and skipWaiter are true, status must cascade to 'delivered'
    expect(updatedItem.status).toBe('delivered')

    // Confirm intermediate steps populated correctly with chef's user ID and display timestamp
    expect(updatedItem.preparedBy).toBe(chefUser.id)
    expect(updatedItem.preparedAt).toBeDefined()

    expect(updatedItem.confirmedBy).toBe(chefUser.id)
    expect(updatedItem.confirmedAt).toBeDefined()

    expect(updatedItem.deliveredBy).toBe(chefUser.id)
    expect(updatedItem.deliveredAt).toBeDefined()

    // Clean up
    await payload.delete({
      collection: 'billings',
      where: { branch: { equals: branch.id } },
      ...adminReq,
    })
    await payload.delete({
      collection: 'products',
      where: { id: { equals: product.id } },
      ...adminReq,
    })
    await payload.delete({
      collection: 'categories',
      where: { id: { equals: category.id } },
      ...adminReq,
    })
    await payload.delete({
      collection: 'users',
      where: { id: { equals: chefUser.id } },
      ...adminReq,
    })
    await payload.delete({
      collection: 'employees',
      where: { id: { equals: employee.id } },
      ...adminReq,
    })
    await payload.delete({
      collection: 'branches',
      where: { id: { equals: branch.id } },
      ...adminReq,
    })
    await payload.delete({
      collection: 'companies',
      where: { id: { equals: company.id } },
      ...adminReq,
    })
  }, 30000)
})
