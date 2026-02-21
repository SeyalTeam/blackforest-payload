import config from '../payload.config'
import { getPayload } from 'payload'

type BillingDoc = {
  id: string
  status?: string
  notes?: unknown
  items?: unknown[]
  customerRewardProcessed?: boolean
  offerCountersProcessed?: boolean
  totalPercentageOfferApplied?: boolean
  totalPercentageOfferDiscount?: unknown
}

const toSafeNonNegativeNumber = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return 0
  }
  return value
}

const hasOfferCounterActivity = (bill: BillingDoc): boolean => {
  const billItems = Array.isArray(bill.items) ? (bill.items as any[]) : []
  const hasProductToProductUsage = billItems.some((item) => item?.isOfferFreeItem === true)
  const hasPriceOfferUsage = billItems.some(
    (item) =>
      item?.isPriceOfferApplied === true &&
      item?.isOfferFreeItem !== true &&
      item?.isRandomCustomerOfferItem !== true,
  )
  const hasTotalPercentageUsage =
    bill.totalPercentageOfferApplied === true &&
    toSafeNonNegativeNumber(bill.totalPercentageOfferDiscount) > 0

  return hasProductToProductUsage || hasPriceOfferUsage || hasTotalPercentageUsage
}

const readFlag = (value: unknown): boolean => value === true

const run = async () => {
  const payload = await getPayload({ config })

  const args = process.argv.slice(2)
  const targetBillIDArg = args.find((arg) => !arg.startsWith('--'))
  const dryRun = args.includes('--dry-run')
  const forceCounterReprocess = args.includes('--force-counter-reprocess')

  const summary = {
    scanned: 0,
    fixed: 0,
    skipped: 0,
    failed: 0,
  }

  const processBill = async (bill: BillingDoc): Promise<void> => {
    summary.scanned += 1

    const billID = bill.id
    const billStatus = String(bill.status || '').toLowerCase()
    const needsRewardProcessing = !readFlag(bill.customerRewardProcessed)
    const needsOfferCounterProcessing = !readFlag(bill.offerCountersProcessed)

    if (billStatus !== 'completed') {
      summary.skipped += 1
      console.log(`[SKIP] ${billID} is not completed (status=${bill.status ?? 'unknown'})`)
      return
    }

    if (!needsRewardProcessing && !needsOfferCounterProcessing) {
      summary.skipped += 1
      console.log(`[SKIP] ${billID} already processed.`)
      return
    }

    const counterActivity = hasOfferCounterActivity(bill)

    if (dryRun) {
      console.log(
        `[DRY-RUN] ${billID} reward=${needsRewardProcessing} offerCounters=${needsOfferCounterProcessing} counterActivity=${counterActivity}`,
      )
      summary.skipped += 1
      return
    }

    try {
      const stableNotes = typeof bill.notes === 'string' ? bill.notes : ''

      if (needsRewardProcessing && !needsOfferCounterProcessing) {
        await payload.update({
          collection: 'billings',
          id: billID,
          data: {
            notes: stableNotes,
          } as any,
          depth: 0,
          overrideAccess: true,
          context: {
            skipOfferCounterProcessing: true,
          },
        })
      } else if (!needsRewardProcessing && needsOfferCounterProcessing) {
        if (!counterActivity) {
          await payload.update({
            collection: 'billings',
            id: billID,
            data: {
              offerCountersProcessed: true,
            } as any,
            depth: 0,
            overrideAccess: true,
            context: {
              skipCustomerRewardProcessing: true,
              skipOfferCounterProcessing: true,
            },
          })
        } else if (forceCounterReprocess) {
          await payload.update({
            collection: 'billings',
            id: billID,
            data: {
              notes: stableNotes,
            } as any,
            depth: 0,
            overrideAccess: true,
            context: {
              skipCustomerRewardProcessing: true,
            },
          })
        } else {
          summary.skipped += 1
          console.log(
            `[SKIP] ${billID} has offer counter activity. Re-run with --force-counter-reprocess if required.`,
          )
          return
        }
      } else {
        if (counterActivity && forceCounterReprocess) {
          await payload.update({
            collection: 'billings',
            id: billID,
            data: {
              notes: stableNotes,
            } as any,
            depth: 0,
            overrideAccess: true,
          })
        } else {
          await payload.update({
            collection: 'billings',
            id: billID,
            data: {
              notes: stableNotes,
            } as any,
            depth: 0,
            overrideAccess: true,
            context: {
              skipOfferCounterProcessing: true,
            },
          })

          if (!counterActivity) {
            await payload.update({
              collection: 'billings',
              id: billID,
              data: {
                offerCountersProcessed: true,
              } as any,
              depth: 0,
              overrideAccess: true,
              context: {
                skipCustomerRewardProcessing: true,
                skipOfferCounterProcessing: true,
              },
            })
          }
        }
      }

      const refreshed = (await payload.findByID({
        collection: 'billings',
        id: billID,
        depth: 0,
        overrideAccess: true,
      })) as BillingDoc

      const rewardDone = readFlag(refreshed.customerRewardProcessed)
      const countersDone = readFlag(refreshed.offerCountersProcessed)

      if (rewardDone && countersDone) {
        summary.fixed += 1
        console.log(`[OK] ${billID} reward=true offerCounters=true`)
        return
      }

      if (!counterActivity && rewardDone && !countersDone) {
        await payload.update({
          collection: 'billings',
          id: billID,
          data: {
            offerCountersProcessed: true,
          } as any,
          depth: 0,
          overrideAccess: true,
          context: {
            skipCustomerRewardProcessing: true,
            skipOfferCounterProcessing: true,
          },
        })
      }

      const verified = (await payload.findByID({
        collection: 'billings',
        id: billID,
        depth: 0,
        overrideAccess: true,
      })) as BillingDoc

      if (readFlag(verified.customerRewardProcessed) && readFlag(verified.offerCountersProcessed)) {
        summary.fixed += 1
        console.log(`[OK] ${billID} reward=true offerCounters=true`)
      } else {
        summary.skipped += 1
        console.log(
          `[PENDING] ${billID} reward=${Boolean(
            verified.customerRewardProcessed,
          )} offerCounters=${Boolean(verified.offerCountersProcessed)}`,
        )
      }
    } catch (error) {
      summary.failed += 1
      console.error(`[FAIL] ${billID}`, error)
    }
  }

  if (targetBillIDArg) {
    const bill = (await payload.findByID({
      collection: 'billings',
      id: targetBillIDArg,
      depth: 0,
      overrideAccess: true,
    })) as BillingDoc

    await processBill(bill)
  } else {
    let page = 1
    let hasNextPage = true

    while (hasNextPage) {
      const result = await payload.find({
        collection: 'billings',
        where: {
          and: [
            {
              status: {
                equals: 'completed',
              },
            },
            {
              or: [
                {
                  customerRewardProcessed: {
                    equals: false,
                  },
                },
                {
                  offerCountersProcessed: {
                    equals: false,
                  },
                },
              ],
            },
          ],
        },
        sort: 'createdAt',
        page,
        limit: 100,
        depth: 0,
        overrideAccess: true,
      })

      for (const bill of result.docs as BillingDoc[]) {
        await processBill(bill)
      }

      hasNextPage = result.hasNextPage
      page += 1
    }
  }

  console.log(
    `Done. scanned=${summary.scanned} fixed=${summary.fixed} skipped=${summary.skipped} failed=${summary.failed}`,
  )

  if (summary.failed > 0) {
    process.exit(1)
  }

  process.exit(0)
}

run()
