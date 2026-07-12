import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { describe, it, beforeAll, expect, afterAll } from 'vitest'

let payload: Payload
let companyId: string

describe('Raw Material Dealers Compliance Validation', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    // Clean up existing test data
    await payload.delete({
      collection: 'raw-material-dealers',
      where: {
        companyName: { equals: 'Test Compliance Dealer' },
      },
      overrideAccess: true,
    })

    await payload.delete({
      collection: 'companies',
      where: {
        name: { equals: 'Test Compliance Company' },
      },
      overrideAccess: true,
    })

    // Create a test company
    const company = await payload.create({
      collection: 'companies',
      data: {
        name: 'Test Compliance Company',
      },
      overrideAccess: true,
    })
    companyId = company.id
  })

  afterAll(async () => {
    // Clean up
    await payload.delete({
      collection: 'raw-material-dealers',
      where: {
        companyName: { equals: 'Test Compliance Dealer' },
      },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'companies',
      where: {
        id: { equals: companyId },
      },
      overrideAccess: true,
    })
  })

  it('allows creating GST registered dealer WITHOUT PAN', async () => {
    const dealer = await payload.create({
      collection: 'raw-material-dealers',
      data: {
        companyName: 'Test Compliance Dealer',
        address: '123 compliance road',
        phoneNumber: '9999999999',
        email: 'dealer@test.com',
        isGSTRegistered: true,
        gst: '22AAAAA0000A1Z5', // Valid GST
        pan: '', // Empty PAN
        allowedCompanies: [companyId],
        contactPerson: {
          name: 'Contact Name',
        },
        hasBankAccount: false,
        preferredPaymentMethod: 'cash',
        status: 'active',
      },
      overrideAccess: true,
    })

    expect(dealer.id).toBeDefined()
    expect(dealer.gst).toBe('22AAAAA0000A1Z5')
    expect(dealer.pan).toBeNull()

    // Clean up this dealer
    await payload.delete({
      collection: 'raw-material-dealers',
      id: dealer.id,
      overrideAccess: true,
    })
  })

  it('allows creating GST registered dealer WITH valid PAN', async () => {
    const dealer = await payload.create({
      collection: 'raw-material-dealers',
      data: {
        companyName: 'Test Compliance Dealer',
        address: '123 compliance road',
        phoneNumber: '9999999999',
        email: 'dealer@test.com',
        isGSTRegistered: true,
        gst: '22AAAAA0000A1Z5',
        pan: 'ABCDE1234F', // Valid PAN format
        allowedCompanies: [companyId],
        contactPerson: {
          name: 'Contact Name',
        },
        hasBankAccount: false,
        preferredPaymentMethod: 'cash',
        status: 'active',
      },
      overrideAccess: true,
    })

    expect(dealer.id).toBeDefined()
    expect(dealer.pan).toBe('ABCDE1234F')

    // Clean up
    await payload.delete({
      collection: 'raw-material-dealers',
      id: dealer.id,
      overrideAccess: true,
    })
  })

  it('rejects GST registered dealer with INVALID PAN format', async () => {
    await expect(
      payload.create({
        collection: 'raw-material-dealers',
        data: {
          companyName: 'Test Compliance Dealer',
          address: '123 compliance road',
          phoneNumber: '9999999999',
          email: 'dealer@test.com',
          isGSTRegistered: true,
          gst: '22AAAAA0000A1Z5',
          pan: 'INVALIDPAN123', // Invalid format
          allowedCompanies: [companyId],
          contactPerson: {
            name: 'Contact Name',
          },
          hasBankAccount: false,
          preferredPaymentMethod: 'cash',
          status: 'active',
        },
        overrideAccess: true,
      })
    ).rejects.toThrow('Invalid PAN format')
  })
})
