import { PayloadHandler } from 'payload'

export const updateItemStatus: PayloadHandler = async (req): Promise<Response> => {
  const { payload, json } = req
  const { id } = req.routeParams as { id: string }

  try {
    if (!json) {
      return Response.json({ error: 'Invalid request' }, { status: 400 })
    }
    const body = await json()
    console.log('[updateItemStatus] Received body:', body)

    const itemId = body.itemId || body.id
    const status = body.status

    if (!itemId) {
      return Response.json({ error: 'Missing itemId (or id)' }, { status: 400 })
    }
    if (!status) {
      return Response.json({ error: 'Missing status' }, { status: 400 })
    }

    // 1. Fetch the bill
    const bill = await payload.findByID({
      collection: 'billings',
      id,
      depth: 0,
    })

    if (!bill) {
      return Response.json({ error: 'Bill not found' }, { status: 404 })
    }

    console.log('[updateItemStatus] Fetched bill items:', JSON.stringify(bill.items, null, 2))

    // 2. Find and update the item status
    let itemFound = false
    const updatedItems = (bill.items || []).map((item: any) => {
      if (item.id === itemId) {
        itemFound = true
        return {
          ...item,
          status: status,
        }
      }
      return item
    })

    if (!itemFound) {
      return Response.json({ error: 'Item not found in bill' }, { status: 404 })
    }

    console.log(
      '[updateItemStatus] Items payload for update:',
      JSON.stringify(updatedItems, null, 2),
    )

    // 3. Save the updated bill
    const updatedBill = await payload.update({
      collection: 'billings',
      id,
      data: {
        items: updatedItems,
      },
    })

    return Response.json(updatedBill, { status: 200 })
  } catch (error) {
    console.error('Error updating item status:', error)
    return Response.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
