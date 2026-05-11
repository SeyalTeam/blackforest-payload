import { getPayload } from 'payload'
import config from '../payload.config'

type BillingCustomerRow = {
  id: string
  phoneNumber?: string | null
  name?: string | null
  lastBillId?: string
}

const normalizeText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const run = async () => {
  const payload = await getPayload({ config })
  const nowISO = new Date().toISOString()

  const byPhone = new Map<string, BillingCustomerRow>()
  const existingByPhone = new Map<string, { id: string; name: string | null; lastBillId?: string }>()

  console.log('Loading existing billing-customers...')
  let existingPage = 1
  while (true) {
    const existing = await payload.find({
      collection: 'billing-customers' as any,
      depth: 0,
      limit: 500,
      page: existingPage,
      overrideAccess: true,
    })

    for (const row of existing.docs as any[]) {
      const phoneNumber = normalizeText(row?.phoneNumber)
      if (!phoneNumber) continue

      const lastBillId =
        typeof row?.lastBill === 'string'
          ? row.lastBill
          : row?.lastBill && typeof row.lastBill === 'object' && typeof row.lastBill.id === 'string'
            ? row.lastBill.id
            : undefined

      existingByPhone.set(phoneNumber, {
        id: String(row.id),
        name: normalizeText(row?.name),
        lastBillId,
      })
    }

    if (!existing.hasNextPage) break
    existingPage += 1
  }
  console.log(`Loaded ${existingByPhone.size} existing billing-customer rows.`)

  console.log('Scanning billings for customer details...')
  let page = 1
  let scannedBills = 0

  while (true) {
    const bills = await payload.find({
      collection: 'billings',
      depth: 0,
      limit: 500,
      page,
      sort: '-createdAt',
      overrideAccess: true,
    })

    for (const bill of bills.docs as any[]) {
      scannedBills += 1
      const phoneNumber = normalizeText(bill?.customerDetails?.phoneNumber)
      if (!phoneNumber) continue

      const customerName = normalizeText(bill?.customerDetails?.name) || phoneNumber
      if (!byPhone.has(phoneNumber)) {
        byPhone.set(phoneNumber, {
          id: '',
          phoneNumber,
          name: customerName,
          lastBillId: String(bill.id),
        })
      }
    }

    if (page % 10 === 0) {
      console.log(`Scanned ${scannedBills} bills so far...`)
    }

    if (!bills.hasNextPage) break
    page += 1
  }

  console.log(`Scanned ${scannedBills} bills total.`)
  console.log(`Found ${byPhone.size} unique phone numbers from billings.`)

  let created = 0
  let updated = 0
  let unchanged = 0
  let failed = 0

  for (const [phoneNumber, candidate] of byPhone.entries()) {
    const existing = existingByPhone.get(phoneNumber)
    const targetName = candidate.name || phoneNumber

    try {
      if (!existing) {
        await payload.create({
          collection: 'billing-customers' as any,
          data: {
            name: targetName,
            phoneNumber,
            lastBill: candidate.lastBillId,
            lastSyncedAt: nowISO,
          } as any,
          depth: 0,
          overrideAccess: true,
        })
        created += 1
        continue
      }

      const shouldUpdateName = normalizeText(existing.name) !== targetName
      const shouldUpdateLastBill =
        typeof candidate.lastBillId === 'string' &&
        candidate.lastBillId.length > 0 &&
        existing.lastBillId !== candidate.lastBillId

      if (!shouldUpdateName && !shouldUpdateLastBill) {
        unchanged += 1
        continue
      }

      await payload.update({
        collection: 'billing-customers' as any,
        id: existing.id,
        data: {
          ...(shouldUpdateName ? { name: targetName } : {}),
          ...(shouldUpdateLastBill ? { lastBill: candidate.lastBillId } : {}),
          lastSyncedAt: nowISO,
        } as any,
        depth: 0,
        overrideAccess: true,
      })
      updated += 1
    } catch (error) {
      failed += 1
      console.error('Failed to backfill phone:', phoneNumber, error)
    }
  }

  console.log('Backfill complete.')
  console.log(
    JSON.stringify(
      {
        scannedBills,
        uniquePhonesFromBillings: byPhone.size,
        existingBefore: existingByPhone.size,
        created,
        updated,
        unchanged,
        failed,
      },
      null,
      2,
    ),
  )
}

void run()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('Billing customer backfill failed:', error)
    process.exit(1)
  })
